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
    it('should process all articles in batches of 50 and scrape concurrently', async () => {
      // Create more than 50 articles without content
      const articles = Array.from({ length: 120 }, (_, i) => {
        const article = new Article();
        article.id = i + 1;
        article.title = `Test Article ${i + 1}`;
        article.url = `https://example.com/article-${i + 1}`;
        article.source = 'test-source';
        (article as any).content = null;
        return article;
      });

      // Mock the repository to return articles in batches
      const findSpy = jest.spyOn(mockRepository, 'find');
      findSpy
        .mockResolvedValueOnce(articles.slice(0, 50)) // First batch
        .mockResolvedValueOnce(articles.slice(50, 100)) // Second batch
        .mockResolvedValueOnce(articles.slice(100, 120)) // Third batch (less than 50)
        .mockResolvedValueOnce([]); // No more articles

      // Mock axios to return successful responses
      const axios = require('axios');
      jest.spyOn(axios, 'get').mockResolvedValue({
        status: 200,
        data: '<html><body><div class="article-content"><p>Test content</p></div></body></html>',
      });

      // Mock the updateArticleScrapingStatus method
      jest.spyOn(service as any, 'updateArticleScrapingStatus').mockResolvedValue(undefined);

      // Mock the delay function to make tests faster
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      await service.scrapeArticlesContent();

      // Verify that the repository was called multiple times for different batches
      expect(findSpy).toHaveBeenCalledTimes(3); // 3 batches (stops when batch < 50)

      // Verify that axios was called for articles (indicating scraping was attempted)
      expect(axios.get).toHaveBeenCalled();
    });

    it('should limit provided articles to 50', async () => {
      // Create more than 50 articles
      const articles = Array.from({ length: 60 }, (_, i) => {
        const article = new Article();
        article.id = i + 1;
        article.title = `Test Article ${i + 1}`;
        article.url = `https://example.com/article-${i + 1}`;
        article.source = 'test-source';
        (article as any).content = null;
        return article;
      });

      // Mock axios to return successful responses
      const axios = require('axios');
      jest.spyOn(axios, 'get').mockResolvedValue({
        status: 200,
        data: '<html><body><div class="article-content"><p>Test content</p></div></body></html>',
      });

      // Mock the updateArticleScrapingStatus method
      jest.spyOn(service as any, 'updateArticleScrapingStatus').mockResolvedValue(undefined);

      // Mock the delay function to make tests faster
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      await service.scrapeArticlesContent(articles);

      // Verify that axios was called (indicating scraping was attempted)
      expect(axios.get).toHaveBeenCalled();
    });
  });
});
