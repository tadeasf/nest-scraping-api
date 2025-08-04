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

    await this.scrapeSource('idnes.cz', 'http://servis.idnes.cz/rss.asp');
    await this.scrapeSource('hn.cz', 'https://rss.hn.cz/');
    await this.scrapeSource(
      'aktualne.cz',
      'https://www.aktualne.cz/export-rss/r~b:article:rss/',
    );
    await this.scrapeSource('novinky.cz', 'https://www.novinky.cz/rss');
    await this.scrapeSource(
      'blesk.cz',
      'https://www.blesk.cz/kategorie/2559/udalosti/rss/www.denik.cz',
    );

    this.logger.log('Hourly scraping completed');
  }

  async scrapeImmediately(source?: string) {
    this.logger.log(`Starting immediate scraping${source ? ` for ${source}` : ' for all sources'}...`);
    this.lastRunTime = new Date();

    const sources: Record<string, string> = {
      'idnes.cz': 'http://servis.idnes.cz/rss.asp',
      'hn.cz': 'https://rss.hn.cz/',
      'aktualne.cz': 'https://www.aktualne.cz/export-rss/r~b:article:rss/',
      'novinky.cz': 'https://www.novinky.cz/rss',
      'blesk.cz': 'https://www.blesk.cz/kategorie/2559/udalosti/rss/www.denik.cz',
    };

    if (source) {
      if (!sources[source]) {
        throw new Error(`Invalid source: ${source}. Valid sources are: ${Object.keys(sources).join(', ')}`);
      }
      await this.scrapeSource(source, sources[source]);
      this.logger.log(`Immediate scraping completed for ${source}`);
    } else {
      // Scrape all sources
      for (const [sourceName, url] of Object.entries(sources)) {
        await this.scrapeSource(sourceName, url);
      }
      this.logger.log('Immediate scraping completed for all sources');
    }
  }

  private async scrapeSource(source: string, url: string) {
    this.logger.log(`Scraping ${source}...`);
    try {
      const feed = await this.parser.parseURL(url);
      let newArticles = 0;
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;

        const content = item.content ?? item.summary ?? '';
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
