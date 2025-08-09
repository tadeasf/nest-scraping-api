import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticleScraperService } from './article-scraper.service';
import { Article } from '../entities/article.entity';
import axios from 'axios';

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
          { status: 'paywall_skipped', count: '3' },
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
          paywall_skipped: 3,
        },
      });
    });
  });

  describe('known paywall sources', () => {
    it('should identify known paywall sources correctly', () => {
      // Test the private method directly
      const isKnownPaywallSource = (service as any).isKnownPaywallSource.bind(
        service,
      );

      expect(isKnownPaywallSource('echo24.cz')).toBe(true);
      expect(isKnownPaywallSource('hn.cz')).toBe(true);
      expect(isKnownPaywallSource('hn.cz-byznys')).toBe(true);
      expect(isKnownPaywallSource('idnes.cz')).toBe(false);
      expect(isKnownPaywallSource('aktualne.cz')).toBe(false);
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

      // Mock the scrapeArticleWithSemaphore method
      jest
        .spyOn(service as any, 'scrapeArticleWithSemaphore')
        .mockResolvedValue({
          success: true,
          content: 'Test content',
          status: 'success',
        });

      // Mock the delay function to make tests faster
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      await service.scrapeArticlesContent();

      // Verify that the repository was called multiple times for different batches
      expect(findSpy).toHaveBeenCalledTimes(3); // 3 batches (stops when batch < 50)

      // Verify that scrapeArticleWithSemaphore was called for articles
      expect((service as any).scrapeArticleWithSemaphore).toHaveBeenCalled();
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

      // Mock the scrapeArticleWithSemaphore method
      jest
        .spyOn(service as any, 'scrapeArticleWithSemaphore')
        .mockResolvedValue({
          success: true,
          content: 'Test content',
          status: 'success',
        });

      // Mock the delay function to make tests faster
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      await service.scrapeArticlesContent(articles);

      // Verify that scrapeArticleWithSemaphore was called for articles (limited to 50)
      expect((service as any).scrapeArticleWithSemaphore).toHaveBeenCalledTimes(
        50,
      );
    });

    it('should filter out known paywall sources before scraping', async () => {
      // Create articles with known paywall sources
      const articles = [
        {
          id: 1,
          title: 'Paywall Article 1',
          url: 'https://echo24.cz/article1',
          source: 'echo24.cz',
          content: null,
        },
        {
          id: 2,
          title: 'Paywall Article 2',
          url: 'https://hn.cz/article2',
          source: 'hn.cz',
          content: null,
        },
        {
          id: 3,
          title: 'Regular Article',
          url: 'https://idnes.cz/article3',
          source: 'idnes.cz',
          content: null,
        },
      ].map((data) => {
        const article = new Article();
        Object.assign(article, data);
        return article;
      });

      // Mock the scrapeArticleWithSemaphore method
      const scrapeSpy = jest
        .spyOn(service as any, 'scrapeArticleWithSemaphore')
        .mockResolvedValue({
          success: true,
          content: 'Test content',
          status: 'success',
        });

      // Mock the updateArticleScrapingStatus method
      const updateStatusSpy = jest
        .spyOn(service as any, 'updateArticleScrapingStatus')
        .mockResolvedValue(undefined);

      await service.scrapeArticlesContent(articles);

      // Verify that scrapeArticleWithSemaphore was only called for non-paywall sources
      expect(scrapeSpy).toHaveBeenCalledTimes(1); // Only idnes.cz
      expect(scrapeSpy).toHaveBeenCalledWith(articles[2]); // Only the regular article

      // Verify that paywall articles were marked as skipped
      expect(updateStatusSpy).toHaveBeenCalledWith(
        1,
        'paywall_skipped',
        null,
        'Known paywall source - auto-skipped',
      );
      expect(updateStatusSpy).toHaveBeenCalledWith(
        2,
        'paywall_skipped',
        null,
        'Known paywall source - auto-skipped',
      );
    });
  });

  describe('scrapeArticleContent', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const makeArticle = (overrides?: Partial<Article>): Article => {
      const a = new Article();
      a.id = 123;
      a.title = 'Sample Title';
      a.url = 'https://example.com/article';
      a.source = 'novinky.cz';
      Object.assign(a, overrides);
      return a;
    };

    it('should return success when content is extracted via selectors and cleaned', async () => {
      const html = `
        <div class="article-content">
          <p> First   line with sufficient content for the unit test to exceed the thirty character threshold required by the scraper's validation. </p>
          <div class="advertisement">ad</div>
          <p> Second paragraph also provides additional details to ensure success path is taken. </p>
        </div>
      `;
      jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: html } as any);

      const article = makeArticle();
      const result = await (service as any).scrapeArticleContent(article);

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      // repository.update should be called with content and contentLength
      expect(mockRepository.update).toHaveBeenCalledWith(123, expect.objectContaining({
        contentScrapingStatus: 'success',
        content: expect.any(String),
        contentLength: expect.any(Number),
      }));
    });

    it('should return http_error when non-200 status is returned', async () => {
      jest.spyOn(axios, 'get').mockResolvedValue({ status: 500, data: '' } as any);
      const article = makeArticle();
      const result = await (service as any).scrapeArticleContent(article);
      expect(result.success).toBe(false);
      expect(result.status).toBe('http_error');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should return no_content when content cannot be extracted', async () => {
      const html = `<div><p>short</p></div>`; // too short after cleaning
      jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: html } as any);
      const article = makeArticle();
      const result = await (service as any).scrapeArticleContent(article);
      expect(result.success).toBe(false);
      expect(result.status).toBe('no_content');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should detect paywall content and return paywall status', async () => {
      const html = `<div class="article-content"><p>Tento text je dostatečně dlouhý a obsahuje frázi předplatné hn, která indikuje přístup pouze pro předplatitele.</p></div>`;
      jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: html } as any);
      const article = makeArticle({ source: 'hn.cz' });
      const result = await (service as any).scrapeArticleContent(article);
      expect(result.success).toBe(false);
      expect(result.status).toBe('paywall');
      // no DB update for paywall path
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should use generic content extraction fallback when selectors fail', async () => {
      const html = `
        <main>
          <article>
            <p>Generic fallback paragraph with enough characters to pass validation for content extraction.</p>
            <p>Another paragraph to ensure content length.</p>
          </article>
        </main>
      `;
      jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: html } as any);
      const article = makeArticle({ source: 'unknown-source' });
      const result = await (service as any).scrapeArticleContent(article);
      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(mockRepository.update).toHaveBeenCalledWith(123, expect.objectContaining({
        contentScrapingStatus: 'success',
      }));
    });

    it('should handle axios/network errors', async () => {
      const err = new Error('ECONNRESET');
      jest.spyOn(axios, 'get').mockRejectedValue(err);
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true as any);

      const article = makeArticle();
      const result = await (service as any).scrapeArticleContent(article);
      expect(result.success).toBe(false);
      expect(result.status).toBe('network_error');
      expect(mockRepository.update).toHaveBeenCalledWith(123, expect.objectContaining({
        contentScrapingStatus: 'error',
      }));
    });

    it('should handle unknown errors', async () => {
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('Boom'));
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(false as any);
      const article = makeArticle();
      const result = await (service as any).scrapeArticleContent(article);
      expect(result.success).toBe(false);
      expect(result.status).toBe('unknown_error');
      expect(mockRepository.update).toHaveBeenCalledWith(123, expect.objectContaining({
        contentScrapingStatus: 'error',
      }));
    });
  });

  describe('scrapeArticleWithSemaphore', () => {
    it('should call delay based on site config and return underlying result', async () => {
      const article = new Article();
      article.id = 1;
      article.title = 'X';
      article.url = 'https://example.com';
      article.source = 'novinky.cz';

      jest.spyOn(service as any, 'scrapeArticleContent').mockResolvedValue({
        success: true,
        status: 'success',
        content: 'Hello',
      });
      const delaySpy = jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      const result = await (service as any).scrapeArticleWithSemaphore(article);
      expect(result.success).toBe(true);
      expect(delaySpy).toHaveBeenCalled();
    });

    it('should update status when underlying scrape throws', async () => {
      const article = new Article();
      article.id = 2;
      article.title = 'Y';
      article.url = 'https://example.com';
      article.source = 'novinky.cz';

      jest
        .spyOn(service as any, 'scrapeArticleContent')
        .mockRejectedValue(new Error('explode'));
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      const result = await (service as any).scrapeArticleWithSemaphore(article);
      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(mockRepository.update).toHaveBeenCalledWith(2, expect.objectContaining({
        contentScrapingStatus: 'failed',
      }));
    });

    it('should queue when more than 5 concurrent scrapes happen', async () => {
      // Make scrapeArticleContent slow so that concurrency > 5 forces queueing
      jest
        .spyOn(service as any, 'scrapeArticleContent')
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ success: true, status: 'success' }), 5),
            ),
        );

      const articles = Array.from({ length: 6 }, (_, i) => {
        const a = new Article();
        a.id = i + 10;
        a.title = `A${i}`;
        a.url = 'https://example.com';
        a.source = 'novinky.cz';
        return a;
      });

      const results = await Promise.all(
        articles.map((a) => (service as any).scrapeArticleWithSemaphore(a)),
      );

      expect(results.every((r: any) => r.success)).toBe(true);
    });
  });

  describe('updateArticleScrapingStatus', () => {
    it('should set placeholder content for paywall_skipped', async () => {
      await (service as any).updateArticleScrapingStatus(999, 'paywall_skipped', null, null);
      expect(mockRepository.update).toHaveBeenCalledWith(999, expect.objectContaining({
        content: '[PAYWALL_SKIPPED]',
        contentLength: 0,
        contentScrapingStatus: 'paywall_skipped',
      }));
    });
  });

  describe('delay', () => {
    it('should resolve after given time', async () => {
      const start = Date.now();
      await (service as any).delay(2);
      expect(Date.now() - start).toBeGreaterThanOrEqual(1);
    });
  });
});
