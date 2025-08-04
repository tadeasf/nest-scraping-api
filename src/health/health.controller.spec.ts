import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { Article } from '../entities/article.entity';
import { ScrapingService } from '../scraping/scraping.service';

describe('HealthController', () => {
  let controller: HealthController;
  let _articleRepository: Repository<Article>;
  let _schedulerRegistry: SchedulerRegistry;
  let _scrapingService: ScrapingService;

  const mockArticleRepository = {
    count: jest.fn(),
  };

  const mockSchedulerRegistry = {
    getCronJob: jest.fn(),
  };

  const mockScrapingService = {
    getLastRunTime: jest.fn(),
    getScrapingStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
        {
          provide: ScrapingService,
          useValue: mockScrapingService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    _articleRepository = module.get<Repository<Article>>(
      getRepositoryToken(Article),
    );
    _schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    _scrapingService = module.get<ScrapingService>(ScrapingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status with article count', async () => {
      const mockArticleCount = 42;
      const mockLastRunTime = new Date('2023-01-01T12:00:00Z');

      mockArticleRepository.count.mockResolvedValue(mockArticleCount);
      mockScrapingService.getLastRunTime.mockReturnValue(mockLastRunTime);

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'UP',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: '1.0.0',
        database: {
          status: 'UP',
          articleCount: mockArticleCount,
        },
        scraping: {
          status: 'UP',
          scheduled: true,
          lastRun: mockLastRunTime.toISOString(),
          nextRun: expect.any(String),
        },
      });

      expect(mockArticleRepository.count).toHaveBeenCalled();
      expect(mockScrapingService.getLastRunTime).toHaveBeenCalled();
    });

    it('should handle null last run time', async () => {
      mockArticleRepository.count.mockResolvedValue(0);
      mockScrapingService.getLastRunTime.mockReturnValue(null);

      const result = await controller.getHealth();

      expect(result.scraping.lastRun).toBeNull();
    });
  });

  describe('getInfo', () => {
    it('should return application information', () => {
      const result = controller.getInfo();

      expect(result).toEqual({
        name: 'NestJS Scraping API',
        description: 'API for scraping news articles from Czech news websites',
        version: '1.0.0',
        environment: expect.any(String),
        nodeVersion: process.version,
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
        },
      });
    });
  });

  describe('getScrapingStatus', () => {
    it('should return scraping status with cron job info', async () => {
      const mockCronJob = { name: 'scrapeAll' };
      const mockStats = {
        totalArticles: 100,
        articlesBySource: { 'idnes.cz': 50, 'hn.cz': 30, 'aktualne.cz': 20 },
        lastRun: new Date('2023-01-01T12:00:00Z'),
        nextRun: new Date('2023-01-01T13:00:00Z'),
      };

      mockSchedulerRegistry.getCronJob.mockReturnValue(mockCronJob);
      mockScrapingService.getScrapingStats.mockResolvedValue(mockStats);

      const result = await controller.getScrapingStatus();

      expect(result).toEqual({
        scheduled: true,
        schedule: '0 * * * *',
        lastRun: mockStats.lastRun.toISOString(),
        nextRun: mockStats.nextRun.toISOString(),
        sources: ['idnes.cz', 'hn.cz', 'aktualne.cz', 'novinky.cz', 'blesk.cz'],
        stats: {
          totalArticles: mockStats.totalArticles,
          articlesBySource: mockStats.articlesBySource,
        },
      });

      expect(mockSchedulerRegistry.getCronJob).toHaveBeenCalledWith(
        'scrapeAll',
      );
      expect(mockScrapingService.getScrapingStats).toHaveBeenCalled();
    });

    it('should handle missing cron job', async () => {
      const mockStats = {
        totalArticles: 0,
        articlesBySource: {},
        lastRun: null,
        nextRun: new Date('2023-01-01T13:00:00Z'),
      };

      mockSchedulerRegistry.getCronJob.mockReturnValue(null);
      mockScrapingService.getScrapingStats.mockResolvedValue(mockStats);

      const result = await controller.getScrapingStatus();

      expect(result.scheduled).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should return application metrics', async () => {
      const mockStats = {
        totalArticles: 100,
        articlesBySource: { 'idnes.cz': 50, 'hn.cz': 30, 'aktualne.cz': 20 },
        lastRun: new Date('2023-01-01T12:00:00Z'),
        nextRun: new Date('2023-01-01T13:00:00Z'),
      };

      mockScrapingService.getScrapingStats.mockResolvedValue(mockStats);

      const result = await controller.getMetrics();

      expect(result).toEqual({
        articles: {
          total: mockStats.totalArticles,
          bySource: mockStats.articlesBySource,
        },
        system: {
          uptime: expect.any(Number),
          memory: expect.any(Object),
          cpu: expect.any(Object),
        },
        scraping: {
          lastRun: mockStats.lastRun.toISOString(),
          nextRun: mockStats.nextRun.toISOString(),
        },
      });

      expect(mockScrapingService.getScrapingStats).toHaveBeenCalled();
    });
  });
});
