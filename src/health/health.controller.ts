import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../entities/article.entity';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ScrapingService } from '../scraping/scraping.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectRepository(Article)
    private readonly _articleRepository: Repository<Article>,
    private readonly _schedulerRegistry: SchedulerRegistry,
    private readonly _scrapingService: ScrapingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  async getHealth() {
    const articleCount = await this._articleRepository.count();
    const lastRunTime = this._scrapingService.getLastRunTime();

    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      database: {
        status: 'UP',
        articleCount,
      },
      scraping: {
        status: 'UP',
        scheduled: true,
        lastRun: lastRunTime?.toISOString() ?? null,
        nextRun: this.getNextScrapingRun(),
      },
    };
  }

  @Get('info')
  @ApiOperation({ summary: 'Application information' })
  @ApiResponse({ status: 200, description: 'Application information' })
  getInfo() {
    return {
      name: 'NestJS Scraping API',
      description: 'API for scraping news articles from Czech news websites',
      version: '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }

  @Get('scraping/status')
  @ApiOperation({ summary: 'Scraping schedule status' })
  @ApiResponse({ status: 200, description: 'Scraping schedule information' })
  async getScrapingStatus() {
    const cronJob = this._schedulerRegistry.getCronJob('scrapeAll');
    const stats = await this._scrapingService.getScrapingStats();

    return {
      scheduled: !!cronJob,
      schedule: '0 * * * *', // Every hour
      lastRun: stats.lastRun?.toISOString() ?? null,
      nextRun: stats.nextRun.toISOString(),
      sources: ['idnes.cz', 'hn.cz', 'aktualne.cz', 'novinky.cz', 'blesk.cz'],
      stats: {
        totalArticles: stats.totalArticles,
        articlesBySource: stats.articlesBySource,
      },
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Application metrics' })
  @ApiResponse({ status: 200, description: 'Application metrics' })
  async getMetrics() {
    const stats = await this._scrapingService.getScrapingStats();

    return {
      articles: {
        total: stats.totalArticles,
        bySource: stats.articlesBySource,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      scraping: {
        lastRun: stats.lastRun?.toISOString() ?? null,
        nextRun: stats.nextRun.toISOString(),
      },
    };
  }

  private getNextScrapingRun(): string {
    // Calculate next run based on hourly schedule
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    nextHour.setMinutes(0, 0, 0);
    return nextHour.toISOString();
  }
}
