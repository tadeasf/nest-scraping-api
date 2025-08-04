import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticleScraperService } from './article-scraper.service';
import { Article } from '../entities/article.entity';

describe('ArticleScraperService', () => {
  let service: ArticleScraperService;
  let mockRepository: jest.Mocked<Repository<Article>>;

  beforeEach(async () => {
    const mockRepositoryProvider = {
      provide: getRepositoryToken(Article),
      useValue: {
        find: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn(),
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleScraperService, mockRepositoryProvider],
    }).compile();

    service = module.get<ArticleScraperService>(ArticleScraperService);
    mockRepository = module.get(getRepositoryToken(Article));

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle empty article list', async () => {
    mockRepository.find.mockResolvedValue([]);

    await service.scrapeArticlesContent();

    expect(mockRepository.find).toHaveBeenCalled();
  });

  describe('getScrapingStats', () => {
    it('should return scraping statistics', async () => {
      mockRepository.count.mockResolvedValueOnce(100); // total
      mockRepository.count.mockResolvedValueOnce(60); // with content
      mockRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'success', count: '50' },
          { status: 'failed', count: '10' },
          { status: 'paywall', count: '5' },
        ]),
      } as any);

      const stats = await service.getScrapingStats();

      expect(stats).toEqual({
        total: 100,
        withContent: 60,
        withoutContent: 40,
        byStatus: {
          success: 50,
          failed: 10,
          paywall: 5,
        },
      });
    });
  });
});
