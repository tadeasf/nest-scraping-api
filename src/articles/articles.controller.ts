import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Article } from '../entities/article.entity';
import { ScrapingService } from '../scraping/scraping.service';
import { ArticleScraperService } from '../scraping/article-scraper.service';

interface SourceCount {
  source: string;
  count: string;
}

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(
    @InjectRepository(Article)
    private readonly _articleRepository: Repository<Article>,
    private readonly _scrapingService: ScrapingService,
    private readonly _articleScraperService: ArticleScraperService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all articles with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'List of articles' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({
    name: 'source',
    required: false,
    description: 'Filter by source',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search in title' })
  async getArticles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('source') source?: string,
    @Query('search') search?: string,
  ) {
    const queryBuilder = this._articleRepository.createQueryBuilder('article');

    if (source) {
      queryBuilder.andWhere('article.source = :source', { source });
    }

    if (search) {
      queryBuilder.andWhere('article.title LIKE :search', {
        search: `%${search}%`,
      });
    }

    const [articles, total] = await queryBuilder
      .orderBy('article.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get available sources' })
  @ApiResponse({ status: 200, description: 'List of available sources' })
  async getSources() {
    const sources = await this._articleRepository
      .createQueryBuilder('article')
      .select('DISTINCT article.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('article.source')
      .orderBy('count', 'DESC')
      .getRawMany<SourceCount>();

    return sources.map((item) => ({
      source: item.source,
      count: parseInt(item.count, 10),
    }));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get articles statistics' })
  @ApiResponse({ status: 200, description: 'Articles statistics' })
  async getStats() {
    const totalArticles = await this._articleRepository.count();
    const articlesBySource = await this._articleRepository
      .createQueryBuilder('article')
      .select('article.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('article.source')
      .getRawMany<SourceCount>();

    // Get today's articles using createdAt field
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayArticles = await this._articleRepository
      .createQueryBuilder('article')
      .where('article.createdAt >= :today', { today })
      .andWhere('article.createdAt < :tomorrow', { tomorrow })
      .getCount();

    const sourceStats: Record<string, number> = {};
    for (const item of articlesBySource) {
      sourceStats[item.source] = parseInt(item.count, 10);
    }

    return {
      total: totalArticles,
      today: todayArticles,
      bySource: sourceStats,
    };
  }

  @Get('content-stats')
  @ApiOperation({ summary: 'Get article content scraping statistics' })
  @ApiResponse({ status: 200, description: 'Content scraping statistics' })
  async getContentStats() {
    const stats = await this._articleScraperService.getScrapingStats();
    return stats;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiResponse({ status: 200, description: 'Article details' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getArticle(@Param('id', ParseIntPipe) id: number) {
    const article = await this._articleRepository.findOne({
      where: { id },
    });

    if (!article) {
      throw new Error('Article not found');
    }

    return article;
  }

  @Get('source/:source')
  @ApiOperation({ summary: 'Get articles by source' })
  @ApiResponse({ status: 200, description: 'Articles from specific source' })
  async getArticlesBySource(
    @Param('source') source: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const [articles, total] = await this._articleRepository.findAndCount({
      where: { source },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  @Get('date/:date')
  @ApiOperation({ summary: 'Get articles by date (YYYY-MM-DD format)' })
  @ApiResponse({ status: 200, description: 'Articles from specific date' })
  async getArticlesByDate(
    @Param('date') date: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // Parse date parameter (YYYY-MM-DD format)
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new HttpException(
        'Invalid date format. Use YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Set time range for the entire day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [articles, total] = await this._articleRepository
      .createQueryBuilder('article')
      .where('article.createdAt >= :startOfDay', { startOfDay })
      .andWhere('article.createdAt <= :endOfDay', { endOfDay })
      .orderBy('article.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      date,
    };
  }

  @Get('recent/:days')
  @ApiOperation({ summary: 'Get articles from the last N days' })
  @ApiResponse({ status: 200, description: 'Recent articles' })
  async getRecentArticles(
    @Param('days', ParseIntPipe) days: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (days <= 0 || days > 365) {
      throw new HttpException(
        'Days must be between 1 and 365',
        HttpStatus.BAD_REQUEST,
      );
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [articles, total] = await this._articleRepository
      .createQueryBuilder('article')
      .where('article.createdAt >= :startDate', { startDate })
      .orderBy('article.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      days,
      fromDate: startDate.toISOString(),
    };
  }

  @Post('scrape')
  @ApiOperation({ summary: 'Trigger immediate scraping' })
  @ApiResponse({ status: 200, description: 'Scraping triggered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid source provided' })
  @ApiQuery({
    name: 'source',
    required: false,
    description: 'Specific source to scrape (e.g., novinky.cz)',
  })
  async triggerScraping(@Query('source') source?: string) {
    try {
      const jobDetails = await this._scrapingService.scrapeImmediately(source);

      return {
        success: true,
        ...jobDetails,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid source')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Failed to trigger scraping',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scrape-content')
  @ApiOperation({ summary: 'Trigger immediate article content scraping' })
  @ApiResponse({
    status: 200,
    description: 'Content scraping triggered successfully',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of articles to scrape (default: 50)',
  })
  async triggerContentScraping(@Query('limit') limit?: string) {
    try {
      const maxArticles = limit ? parseInt(limit, 10) : 50;

      // Get articles without content
      const articles = await this._articleRepository.find({
        where: { content: IsNull() },
        order: { createdAt: 'DESC' },
        take: maxArticles,
      });

      if (articles.length === 0) {
        return {
          success: true,
          message: 'No articles found without content',
          articlesToScrape: 0,
          timestamp: new Date().toISOString(),
        };
      }

      // Trigger content scraping in background
      const immediate = setImmediate(async () => {
        try {
          await this._articleScraperService.scrapeArticlesContent(articles);
        } catch (_error) {
          // Background content scraping failed silently
        }
      });

      // Prevent keeping the event loop alive during tests
      if (typeof (immediate as any).unref === 'function') {
        (immediate as any).unref();
      }

      return {
        success: true,
        message: `Content scraping scheduled for ${articles.length} articles`,
        articlesToScrape: articles.length,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      throw new HttpException(
        'Failed to trigger content scraping',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
