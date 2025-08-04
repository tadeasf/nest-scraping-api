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

    it('should handle database errors gracefully', async () => {
      mockArticleRepository.count.mockRejectedValue(
        new Error('Database connection failed'),
      );
      mockScrapingService.getLastRunTime.mockReturnValue(null);

      await expect(controller.getHealth()).rejects.toThrow(
        'Database connection failed',
      );
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

    it('should handle scraping service errors gracefully', async () => {
      mockSchedulerRegistry.getCronJob.mockReturnValue({ name: 'scrapeAll' });
      mockScrapingService.getScrapingStats.mockRejectedValue(
        new Error('Scraping service error'),
      );

      await expect(controller.getScrapingStatus()).rejects.toThrow(
        'Scraping service error',
      );
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

    it('should handle scraping service errors gracefully', async () => {
      mockScrapingService.getScrapingStats.mockRejectedValue(
        new Error('Metrics service error'),
      );

      await expect(controller.getMetrics()).rejects.toThrow(
        'Metrics service error',
      );
    });

    // Additional tests to cover uncovered branches
    it('should handle null lastRun in metrics', async () => {
      const mockStats = {
        totalArticles: 100,
        articlesBySource: { 'idnes.cz': 50, 'hn.cz': 30, 'aktualne.cz': 20 },
        lastRun: null,
        nextRun: new Date('2023-01-01T13:00:00Z'),
      };

      mockScrapingService.getScrapingStats.mockResolvedValue(mockStats);

      const result = await controller.getMetrics();

      expect(result.scraping.lastRun).toBeNull();
      expect(result.scraping.nextRun).toBe(mockStats.nextRun.toISOString());
    });

    it('should handle null lastRun in scraping status', async () => {
      const mockStats = {
        totalArticles: 100,
        articlesBySource: { 'idnes.cz': 50, 'hn.cz': 30, 'aktualne.cz': 20 },
        lastRun: null,
        nextRun: new Date('2023-01-01T13:00:00Z'),
      };

      mockSchedulerRegistry.getCronJob.mockReturnValue({ name: 'scrapeAll' });
      mockScrapingService.getScrapingStats.mockResolvedValue(mockStats);

      const result = await controller.getScrapingStatus();

      expect(result.lastRun).toBeNull();
      expect(result.nextRun).toBe(mockStats.nextRun.toISOString());
    });

    it('should handle different environment values', () => {
      // Test with NODE_ENV set
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = controller.getInfo();

      expect(result.environment).toBe('production');

      // Restore original value
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle undefined NODE_ENV', () => {
      // Test with NODE_ENV unset
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const result = controller.getInfo();

      expect(result.environment).toBe('development');

      // Restore original value
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle memory usage edge cases', () => {
      // Mock process.memoryUsage to return specific values
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 1024 * 1024 * 50, // 50MB
        heapTotal: 1024 * 1024 * 100, // 100MB
        rss: 1024 * 1024 * 150, // 150MB
        external: 1024 * 1024 * 10, // 10MB
        arrayBuffers: 1024 * 1024 * 5, // 5MB
      }) as any;

      const result = controller.getInfo();

      expect(result.memory.used).toBe(50);
      expect(result.memory.total).toBe(100);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should handle zero memory usage', () => {
      // Mock process.memoryUsage to return zero values
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0,
      }) as any;

      const result = controller.getInfo();

      expect(result.memory.used).toBe(0);
      expect(result.memory.total).toBe(0);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });
});
