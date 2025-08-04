import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Parser from 'rss-parser';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../entities/article.entity';
import * as crypto from 'crypto';

@Injectable()
export class ScrapingService {
  private readonly parser: Parser;
  private readonly logger = new Logger(ScrapingService.name);
  private lastRunTime: Date | null = null;

  constructor(
    @InjectRepository(Article)
    private readonly _articleRepository: Repository<Article>,
  ) {
    this.parser = new Parser();
  }

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'scrapeAll',
  })
  async scrapeAll() {
    this.logger.log('Starting hourly scraping...');
    this.lastRunTime = new Date();

    const sources = [
      { name: 'idnes.cz', url: 'http://servis.idnes.cz/rss.asp' },
      { name: 'hn.cz-byznys', url: 'https://byznys.hn.cz/?m=rss' },
      { name: 'hn.cz-domaci', url: 'https://domaci.hn.cz/?m=rss' },
      { name: 'hn.cz-zahranicni', url: 'https://zahranicni.hn.cz/?m=rss' },
      { name: 'hn.cz-nazory', url: 'https://nazory.hn.cz/?m=rss' },
      { name: 'hn.cz-tech', url: 'https://tech.hn.cz/?m=rss' },
      { name: 'aktualne.cz', url: 'https://www.aktualne.cz/rss/?BBX_DEVICE=desktop&BBX_REAL_DEVICE=desktop' },
      { name: 'novinky.cz', url: 'https://www.novinky.cz/rss' },
      { name: 'blesk.cz', url: 'https://www.blesk.cz/rss' },
    ];

    // Scrape all sources concurrently
    const scrapingPromises = sources.map(({ name, url }) =>
      this.scrapeSource(name, url).catch(error => {
        this.logger.error(`Failed to scrape ${name}:`, error);
        return null;
      })
    );

    await Promise.all(scrapingPromises);
    this.logger.log('Hourly scraping completed');
  }

  async scrapeImmediately(source?: string) {
    this.logger.log(`Scheduling immediate scraping${source ? ` for ${source}` : ' for all sources'}...`);
    this.lastRunTime = new Date();

    const sources: Record<string, string> = {
      'idnes.cz': 'http://servis.idnes.cz/rss.asp',
      'hn.cz-byznys': 'https://byznys.hn.cz/?m=rss',
      'hn.cz-domaci': 'https://domaci.hn.cz/?m=rss',
      'hn.cz-zahranicni': 'https://zahranicni.hn.cz/?m=rss',
      'hn.cz-nazory': 'https://nazory.hn.cz/?m=rss',
      'hn.cz-tech': 'https://tech.hn.cz/?m=rss',
      'aktualne.cz': 'https://www.aktualne.cz/rss/?BBX_DEVICE=desktop&BBX_REAL_DEVICE=desktop',
      'novinky.cz': 'https://www.novinky.cz/rss',
      'blesk.cz': 'https://www.blesk.cz/rss',
    };

    // Validate source if provided
    if (source && !sources[source]) {
      throw new Error(`Invalid source: ${source}. Valid sources are: ${Object.keys(sources).join(', ')}`);
    }

    // Run scraping in background
    setImmediate(async () => {
      try {
        if (source) {
          await this.scrapeSource(source, sources[source]);
          this.logger.log(`Background scraping completed for ${source}`);
        } else {
          // Scrape all sources concurrently
          const scrapingPromises = Object.entries(sources).map(([sourceName, url]) =>
            this.scrapeSource(sourceName, url).catch(error => {
              this.logger.error(`Failed to scrape ${sourceName}:`, error);
              return null;
            })
          );

          await Promise.all(scrapingPromises);
          this.logger.log('Background scraping completed for all sources');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Background scraping failed${source ? ` for ${source}` : ''}`, errorMessage);
      }
    });

    // Return job details immediately
    return {
      jobId: `scrape_${Date.now()}`,
      status: 'scheduled',
      source: source || 'all',
      scheduledAt: this.lastRunTime,
      message: `Scraping scheduled${source ? ` for ${source}` : ' for all sources'}`,
    };
  }

  private async scrapeSource(source: string, url: string) {
    this.logger.log(`Scraping ${source}...`);
    try {
      const feed = await this.parser.parseURL(url);
      let newArticles = 0;
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;

        // Extract content from various possible fields
        const content = item.content ?? item.summary ?? item.description ?? '';
        const contentHash = crypto
          .createHash('sha256')
          .update(content)
          .digest('hex');
        const existingArticle = await this._articleRepository.findOne({
          where: { contentHash },
        });

        if (!existingArticle) {
          const article = new Article();
          article.title = item.title;
          article.url = item.link;
          article.contentHash = contentHash;
          article.source = source;

          // Extract additional data
          const description = this.extractDescription(item);
          const author = this.extractAuthor(item);
          const publishedAt = this.extractPublishedDate(item);
          const imageUrl = this.extractImageUrl(item);

          if (description) article.description = description;
          if (author) article.author = author;
          if (publishedAt) article.publishedAt = publishedAt;
          if (imageUrl) article.imageUrl = imageUrl;

          await this._articleRepository.save(article);
          newArticles++;
        }
      }
      this.logger.log(`Found ${newArticles} new articles from ${source}.`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to scrape ${source}`, errorMessage);
    }
  }

  private extractDescription(item: any): string | null {
    // Try different possible description fields
    const description = item.content ?? item.summary ?? item.description ?? null;

    if (!description) return null;

    // Remove HTML tags if present
    return description.replace(/<[^>]*>/g, '').trim();
  }

  private extractAuthor(item: any): string | null {
    // Try different possible author fields
    return item.creator ?? item.author ?? item['dc:creator'] ?? null;
  }

  private extractPublishedDate(item: any): Date | null {
    // Try different possible date fields
    const dateStr = item.pubDate ?? item.published ?? item['dc:date'] ?? null;

    if (!dateStr) return null;

    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  private extractImageUrl(item: any): string | null {
    // Try to extract image URL from various sources
    if (item['media:content'] && item['media:content'].url) {
      return item['media:content'].url;
    }

    if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }

    // Try to extract from description if it contains an image
    const description = item.content ?? item.summary ?? item.description ?? '';
    const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
    return imgMatch ? imgMatch[1] : null;
  }

  getLastRunTime(): Date | null {
    return this.lastRunTime;
  }

  async getScrapingStats() {
    const totalArticles = await this._articleRepository.count();
    const articlesBySource = await this._articleRepository
      .createQueryBuilder('article')
      .select('article.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('article.source')
      .getRawMany();

    const sourceStats: Record<string, number> = {};
    for (const item of articlesBySource) {
      if (typeof item.source === 'string' && typeof item.count === 'string') {
        sourceStats[item.source] = parseInt(item.count, 10);
      }
    }

    return {
      totalArticles,
      articlesBySource: sourceStats,
      lastRun: this.lastRunTime,
      nextRun: this.getNextRunTime(),
    };
  }

  private getNextRunTime(): Date {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    nextHour.setMinutes(0, 0, 0);
    return nextHour;
  }
}
