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
  ) { }

  async scrapeArticlesContent(articles?: Article[]): Promise<void> {
    this.logger.log('Starting article content scraping...');

    // If no articles provided, get articles without content, limited to 50
    if (!articles) {
      articles = await this._articleRepository.find({
        where: { content: IsNull() },
        order: { createdAt: 'DESC' },
        take: 50, // Always limit to 50 articles
      });
    } else {
      // If articles are provided, still limit to 50
      articles = articles.slice(0, 50);
    }

    if (articles.length === 0) {
      this.logger.log('No articles to scrape content for');
      return;
    }

    this.logger.log(`Found ${articles.length} articles to scrape content for`);

    // Scrape articles concurrently with rate limiting
    const scrapingPromises = articles.map((article) =>
      this.scrapeArticleWithSemaphore(article),
    );

    const results = await Promise.allSettled(scrapingPromises);

    // Count results
    let successCount = 0;
    let failCount = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        failCount++;
      }
    });

    this.logger.log(
      `Article content scraping completed. Success: ${successCount}, Failed: ${failCount}`,
    );
  }

  private async scrapeArticleWithSemaphore(article: Article): Promise<ScrapingResult> {
    await this.semaphore.acquire();

    try {
      const result = await this.scrapeArticleContent(article);

      if (result.success) {
        this.logger.log(`Successfully scraped content for: ${article.title}`);
      } else {
        this.logger.warn(
          `Failed to scrape content for: ${article.title} - ${result.status}`,
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
        `Error scraping content for ${article.title}: ${errorMessage}`,
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

      if (!content || content.trim().length < 50) {
        return {
          success: false,
          status: 'no_content',
          error: 'No meaningful content found',
        };
      }

      // Check for paywall indicators
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
        if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            status: 'timeout',
            error: 'Request timeout',
          };
        }
        if (error.response?.status === 404) {
          return {
            success: false,
            status: 'not_found',
            error: 'Article not found (404)',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            status: 'forbidden',
            error: 'Access forbidden (403)',
          };
        }
      }

      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private extractContentGeneric($: cheerio.CheerioAPI): string {
    // Try to find the main content area using generic selectors
    for (const selector of GENERIC_CONTENT_SELECTORS) {
      const element = $(selector);
      if (element.length > 0) {
        return element.text().trim();
      }
    }

    // Fallback: get all paragraphs
    const paragraphs = $('p')
      .map((_, el) => $(el).text().trim())
      .get();
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
