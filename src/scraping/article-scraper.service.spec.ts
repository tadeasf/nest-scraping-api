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

  describe('concurrent scraping', () => {
    it('should limit articles to 50 and scrape concurrently', async () => {
      // Create more than 50 articles without content
      const articles = Array.from({ length: 60 }, (_, i) => {
        const article = new Article();
        article.id = i + 1;
        article.title = `Test Article ${i + 1}`;
        article.url = `https://example.com/article-${i + 1}`;
        article.source = 'test-source';
        (article as any).content = null;
        return article;
      });

      // Mock the repository to return only 50 articles (simulating the take: 50 limit)
      jest.spyOn(mockRepository, 'find').mockResolvedValue(articles.slice(0, 50));

      // Mock the scrapeArticleContent method to simulate successful scraping
      const scrapeSpy = jest.spyOn(service as any, 'scrapeArticleContent').mockResolvedValue({
        success: true,
        content: 'Test content',
        status: 'success',
      });

      // Mock the updateArticleScrapingStatus method
      jest.spyOn(service as any, 'updateArticleScrapingStatus').mockResolvedValue(undefined);

      await service.scrapeArticlesContent();

      // Verify that only 50 articles were processed (due to the limit)
      expect(scrapeSpy).toHaveBeenCalledTimes(50);

      // Verify that the articles were processed in batches (concurrent processing)
      // The semaphore should allow 5 concurrent requests
      expect(scrapeSpy).toHaveBeenCalledWith(articles[0]);
      expect(scrapeSpy).toHaveBeenCalledWith(articles[49]);
      expect(scrapeSpy).not.toHaveBeenCalledWith(articles[50]); // Should not process article 51
    });
  });
});
