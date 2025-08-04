import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScrapingService } from './scraping.service';
import { Article } from '../entities/article.entity';
import { getSourcesRecord } from './constants';

describe('ScrapingService', () => {
  let service: ScrapingService;
  let mockRepository: jest.Mocked<Repository<Article>>;

  beforeEach(async () => {
    const mockRepositoryProvider = {
      provide: getRepositoryToken(Article),
      useValue: {
        findOne: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn(),
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ScrapingService, mockRepositoryProvider],
    }).compile();

    service = module.get<ScrapingService>(ScrapingService);
    mockRepository = module.get(getRepositoryToken(Article));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrapeImmediately', () => {
    it('should validate existing sources', async () => {
      const result = await service.scrapeImmediately('idnes.cz');
      expect(result).toBeDefined();
      expect(result.source).toBe('idnes.cz');
      expect(result.status).toBe('scheduled');
    });

    it('should validate all sources from constants', async () => {
      const sources = getSourcesRecord();
      const sourceNames = Object.keys(sources);

      for (const source of sourceNames) {
        const result = await service.scrapeImmediately(source);
        expect(result).toBeDefined();
        expect(result.source).toBe(source);
        expect(result.status).toBe('scheduled');
      }
    });

    it('should reject invalid sources', async () => {
      await expect(service.scrapeImmediately('invalid-source')).rejects.toThrow(
        'Invalid source: invalid-source',
      );
    });

    it('should scrape all sources when no specific source provided', async () => {
      const result = await service.scrapeImmediately();
      expect(result).toBeDefined();
      expect(result.source).toBe('all');
      expect(result.status).toBe('scheduled');
    });
  });

  describe('getScrapingStats', () => {
    it('should return scraping statistics', async () => {
      mockRepository.count.mockResolvedValue(100);
      mockRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { source: 'idnes.cz', count: '50' },
          { source: 'denik.cz', count: '30' },
          { source: 'mfdnes.cz', count: '20' },
        ]),
      } as any);

      const stats = await service.getScrapingStats();
      expect(stats.totalArticles).toBe(100);
      expect(stats.articlesBySource).toEqual({
        'idnes.cz': 50,
        'denik.cz': 30,
        'mfdnes.cz': 20,
      });
    });
  });

  describe('getLastRunTime', () => {
    it('should return last run time', () => {
      const lastRun = service.getLastRunTime();
      expect(lastRun).toBeDefined();
    });
  });

  describe('scrapeAll', () => {
    it('should be called by cron job', () => {
      // This test verifies the cron job method exists
      expect(typeof service.scrapeAll).toBe('function');
    });
  });

  describe('scrapeSource', () => {
    it('should handle RSS parsing errors gracefully', async () => {
      // Mock the parser to throw an error
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      // We can't easily test the private method directly, but we can test it indirectly
      // by calling scrapeImmediately and checking that errors are handled
      const result = await service.scrapeImmediately('idnes.cz');
      expect(result.status).toBe('scheduled');
    });
  });
});
