import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Article } from '../entities/article.entity';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  getSiteConfig,
  PAYWALL_INDICATORS,
  GENERIC_CONTENT_SELECTORS,
  KNOWN_PAYWALL_SOURCES,
} from './constants';

interface ScrapingResult {
  success: boolean;
  content?: string;
  status: string;
  error?: string;
}

// Simple semaphore for concurrency control
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}

@Injectable()
export class ArticleScraperService {
  private readonly logger = new Logger(ArticleScraperService.name);
  private readonly semaphore = new Semaphore(5); // Limit to 5 concurrent requests

  constructor(
    @InjectRepository(Article)
    private readonly _articleRepository: Repository<Article>,
  ) {}

  async scrapeArticlesContent(articles?: Article[]): Promise<void> {
    this.logger.log('Starting article content scraping...');

    let totalSuccessCount = 0;
    let totalFailCount = 0;
    let batchNumber = 0;

    // If articles are provided, process them directly
    if (articles) {
      articles = articles.slice(0, 50); // Limit provided articles to 50
      const results = await this.processArticleBatch(articles, batchNumber);
      totalSuccessCount += results.successCount;
      totalFailCount += results.failCount;
    } else {
      // Process all articles without content in batches of 50
      let hasMoreArticles = true;

      while (hasMoreArticles) {
        batchNumber++;
        const batchArticles = await this._articleRepository.find({
          where: { content: IsNull() },
          order: { createdAt: 'DESC' },
          take: 50, // Process 50 articles per batch
        });

        if (batchArticles.length === 0) {
          hasMoreArticles = false;
          break;
        }

        this.logger.log(
          `Processing batch ${batchNumber}: ${batchArticles.length} articles`,
        );

        const results = await this.processArticleBatch(
          batchArticles,
          batchNumber,
        );
        totalSuccessCount += results.successCount;
        totalFailCount += results.failCount;

        // If we got less than 50 articles, we've processed all available articles
        if (batchArticles.length < 50) {
          hasMoreArticles = false;
        }
      }
    }

    this.logger.log(
      `Article content scraping completed. Total Success: ${totalSuccessCount}, Total Failed: ${totalFailCount}, Batches: ${batchNumber}`,
    );

    if (totalSuccessCount + totalFailCount > 0) {
      const overallSuccessRate = (
        (totalSuccessCount / (totalSuccessCount + totalFailCount)) *
        100
      ).toFixed(1);
      this.logger.log(`Overall success rate: ${overallSuccessRate}%`);
    }
  }

  private async processArticleBatch(
    articles: Article[],
    batchNumber: number,
  ): Promise<{ successCount: number; failCount: number }> {
    this.logger.log(
      `Found ${articles.length} articles to scrape content for in batch ${batchNumber}`,
    );

    // Separate articles into paywall and non-paywall sources
    const paywallArticles: Article[] = [];
    const scrapableArticles: Article[] = [];

    articles.forEach((article) => {
      if (this.isKnownPaywallSource(article.source)) {
        paywallArticles.push(article);
      } else {
        scrapableArticles.push(article);
      }
    });

    // Handle known paywall sources immediately (no HTTP requests needed)
    if (paywallArticles.length > 0) {
      this.logger.log(
        `Skipping ${paywallArticles.length} articles from known paywall sources: ${paywallArticles.map((a) => a.source).join(', ')}`,
      );

      const paywallPromises = paywallArticles.map(async (article) => {
        await this.updateArticleScrapingStatus(
          article.id,
          'paywall_skipped',
          null,
          'Known paywall source - auto-skipped',
        );
        return {
          success: false,
          status: 'paywall_skipped',
          error: 'Known paywall source - auto-skipped',
        };
      });

      await Promise.all(paywallPromises);
    }

    // Only scrape articles from non-paywall sources
    let successCount = 0;
    let failCount = 0;
    const sourceStats: Record<string, { success: number; failed: number }> = {};

    if (scrapableArticles.length > 0) {
      this.logger.log(
        `Processing ${scrapableArticles.length} articles from scrapable sources`,
      );

      // Scrape articles concurrently with rate limiting
      const scrapingPromises = scrapableArticles.map((article) =>
        this.scrapeArticleWithSemaphore(article),
      );

      const results = await Promise.allSettled(scrapingPromises);

      // Count results and track by source
      results.forEach((result, index) => {
        const article = scrapableArticles[index];
        const source = article.source;

        if (!sourceStats[source]) {
          sourceStats[source] = { success: 0, failed: 0 };
        }

        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          sourceStats[source].success++;
        } else {
          failCount++;
          sourceStats[source].failed++;
        }
      });
    }

    // Add paywall articles to fail count
    failCount += paywallArticles.length;

    // Log batch statistics
    this.logger.log(
      `Batch ${batchNumber} completed: ${successCount} success, ${failCount} failed (${paywallArticles.length} paywall skipped)`,
    );

    Object.entries(sourceStats).forEach(([source, stats]) => {
      this.logger.log(
        `  ${source}: ${stats.success} success, ${stats.failed} failed`,
      );
    });

    return { successCount, failCount };
  }

  private async scrapeArticleWithSemaphore(
    article: Article,
  ): Promise<ScrapingResult> {
    await this.semaphore.acquire();

    try {
      const result = await this.scrapeArticleContent(article);

      if (result.success) {
        this.logger.log(
          `Successfully scraped content for [${article.source}]: ${article.title}`,
        );
      } else {
        this.logger.warn(
          `Failed to scrape content for [${article.source}]: ${article.title} - ${result.status}`,
        );
      }

      // Add delay between requests to be respectful
      const config = getSiteConfig(article.source);
      if (config.delay) {
        await this.delay(config.delay);
      } else {
        await this.delay(500); // Default delay
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error scraping content for [${article.source}] ${article.title}: ${errorMessage}`,
      );

      // Update article with error status
      await this.updateArticleScrapingStatus(
        article.id,
        'failed',
        null,
        errorMessage,
      );

      return {
        success: false,
        status: 'error',
        error: errorMessage,
      };
    } finally {
      this.semaphore.release();
    }
  }

  private isKnownPaywallSource(source: string): boolean {
    return KNOWN_PAYWALL_SOURCES.includes(source);
  }

  private async scrapeArticleContent(
    article: Article,
  ): Promise<ScrapingResult> {
    try {
      const config = getSiteConfig(article.source);

      const response = await axios.get(article.url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent':
            config.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      if (response.status !== 200) {
        return {
          success: false,
          status: 'http_error',
          error: `HTTP ${response.status}`,
        };
      }

      const $ = cheerio.load(response.data);

      // Remove unwanted elements
      if (config.removeSelectors) {
        config.removeSelectors.forEach((selector) => {
          $(selector).remove();
        });
      }

      // Try to find content using configured selectors
      let content = '';
      for (const selector of config.selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          content = elements
            .map((_, el) => $(el).text().trim())
            .get()
            .join('\n\n');
          break;
        }
      }

      // If no content found with selectors, try generic approach
      if (!content) {
        content = this.extractContentGeneric($);
      }

      if (!content || content.trim().length < 30) {
        return {
          success: false,
          status: 'no_content',
          error: 'No meaningful content found',
        };
      }

      // Check for paywall indicators (very restrictive now)
      if (this.isPaywallContent($, content)) {
        return {
          success: false,
          status: 'paywall',
          error: 'Content appears to be behind paywall',
        };
      }

      // Clean and normalize content
      const cleanedContent = this.cleanContent(content);

      // Update article with scraped content
      await this.updateArticleScrapingStatus(
        article.id,
        'success',
        cleanedContent,
        null,
      );

      return {
        success: true,
        content: cleanedContent,
        status: 'success',
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.code || error.message;
        this.logger.error(`Failed to scrape ${article.url}: ${errorMessage}`);

        await this.updateArticleScrapingStatus(
          article.id,
          'error',
          null,
          errorMessage,
        );

        return {
          success: false,
          status: 'network_error',
          error: errorMessage,
        };
      } else {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Unexpected error scraping ${article.url}: ${errorMessage}`,
        );

        await this.updateArticleScrapingStatus(
          article.id,
          'error',
          null,
          errorMessage,
        );

        return {
          success: false,
          status: 'unknown_error',
          error: errorMessage,
        };
      }
    }
  }

  private extractContentGeneric($: cheerio.CheerioAPI): string {
    // Try to find the main content area using generic selectors
    for (const selector of GENERIC_CONTENT_SELECTORS) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 30) {
          return text;
        }
      }
    }

    // Try to find content in article tags
    const articles = $('article');
    if (articles.length > 0) {
      const text = articles.text().trim();
      if (text.length > 30) {
        return text;
      }
    }

    // Try to find content in main tags
    const main = $('main');
    if (main.length > 0) {
      const text = main.text().trim();
      if (text.length > 30) {
        return text;
      }
    }

    // Fallback: get all paragraphs
    const paragraphs = $('p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 10); // Filter out very short paragraphs
    return paragraphs.join('\n\n');
  }

  private isPaywallContent($: cheerio.CheerioAPI, content: string): boolean {
    const lowerContent = content.toLowerCase();
    const pageText = $.text().toLowerCase();

    return PAYWALL_INDICATORS.some(
      (indicator) =>
        lowerContent.includes(indicator) || pageText.includes(indicator),
    );
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
      .trim();
  }

  private async updateArticleScrapingStatus(
    articleId: number,
    status: string,
    content: string | null,
    _error?: string | null,
  ): Promise<void> {
    const updateData: Partial<Article> = {
      contentScrapingStatus: status,
      contentScrapedAt: new Date(),
    };

    if (content) {
      updateData.content = content;
      updateData.contentLength = content.length;
    } else if (status === 'paywall_skipped') {
      // Set placeholder content for paywall articles to prevent infinite loops
      updateData.content = '[PAYWALL_SKIPPED]';
      updateData.contentLength = 0;
    }

    await this._articleRepository.update(articleId, updateData);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getScrapingStats(): Promise<{
    total: number;
    withContent: number;
    withoutContent: number;
    byStatus: Record<string, number>;
  }> {
    const total = await this._articleRepository.count();
    const withContent = await this._articleRepository.count({
      where: { content: Not(IsNull()) },
    });

    const statusStats = await this._articleRepository
      .createQueryBuilder('article')
      .select('article.contentScrapingStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('article.contentScrapingStatus IS NOT NULL')
      .groupBy('article.contentScrapingStatus')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    statusStats.forEach((stat) => {
      byStatus[stat.status] = parseInt(stat.count, 10);
    });

    return {
      total,
      withContent,
      withoutContent: total - withContent,
      byStatus,
    };
  }
}
