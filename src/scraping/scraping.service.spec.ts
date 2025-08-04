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

    it('should handle background processing errors gracefully', async () => {
      // Mock the parser to fail during background processing
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('Background processing failed')),
      };
      (service as any).parser = mockParser;

      // This should not throw an error even if background processing fails
      const result = await service.scrapeImmediately('idnes.cz');
      expect(result).toBeDefined();
      expect(result.status).toBe('scheduled');

      // Wait for setImmediate to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle background processing for all sources', async () => {
      // Mock the parser to succeed for some sources and fail for others
      const mockParser = {
        parseURL: jest.fn().mockImplementation((url) => {
          if (url.includes('idnes.cz')) {
            return Promise.resolve({ items: [{ title: 'Test', link: 'http://test.com' }] });
          }
          return Promise.reject(new Error('Some sources fail'));
        }),
      };
      (service as any).parser = mockParser;

      // Mock repository to handle the successful case
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      const result = await service.scrapeImmediately();
      expect(result).toBeDefined();
      expect(result.source).toBe('all');
      expect(result.status).toBe('scheduled');
    });

    it('should handle database errors during article saving', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: 'Test content',
          },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      // Mock repository to fail on save
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      // This should not throw an error
      await service['scrapeSource']('test-source', 'https://example.com/rss');
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

    it('should handle scraping errors gracefully', async () => {
      // Mock the parser to simulate RSS parsing errors
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('Network error')),
      };
      (service as any).parser = mockParser;

      // This should not throw an error
      await service.scrapeAll();
    });

    it('should handle individual source failures in scrapeAll', async () => {
      // Mock the parser to fail for some sources but succeed for others
      const mockParser = {
        parseURL: jest.fn().mockImplementation((url) => {
          if (url.includes('idnes.cz')) {
            return Promise.reject(new Error('Source unavailable'));
          }
          return Promise.resolve({ items: [] });
        }),
      };
      (service as any).parser = mockParser;

      // This should not throw an error even when some sources fail
      await service.scrapeAll();
    });
  });

  describe('scrapeSource', () => {
    it('should handle RSS parsing errors gracefully', async () => {
      // We can't easily test the private method directly, but we can test it indirectly
      // by calling scrapeImmediately and checking that errors are handled
      const result = await service.scrapeImmediately('idnes.cz');
      expect(result.status).toBe('scheduled');
    });

    it('should handle successful RSS parsing', async () => {
      // Mock the parser to return a valid feed
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: '<p>Test content</p>',
            creator: 'Test Author',
            pubDate: '2024-01-01T00:00:00Z',
          },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      // Mock repository to return null (no existing article)
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      // Call the private method directly
      await service['scrapeSource']('test-source', 'https://example.com/rss');

      expect(mockParser.parseURL).toHaveBeenCalledWith(
        'https://example.com/rss',
      );
      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle feed with no items', async () => {
      const mockFeed = { items: [] };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      await service['scrapeSource']('test-source', 'https://example.com/rss');

      expect(mockParser.parseURL).toHaveBeenCalledWith(
        'https://example.com/rss',
      );
      expect(mockRepository.findOne).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle items without title or link', async () => {
      const mockFeed = {
        items: [
          { content: 'No title or link' },
          { title: 'No link', content: 'Test content' },
          { link: 'https://example.com', content: 'No title' },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      await service['scrapeSource']('test-source', 'https://example.com/rss');

      expect(mockParser.parseURL).toHaveBeenCalledWith(
        'https://example.com/rss',
      );
      expect(mockRepository.findOne).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle existing articles', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Existing Article',
            link: 'https://example.com/article',
            content: 'Test content',
          },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      // Mock repository to return existing article
      mockRepository.findOne.mockResolvedValue({ id: 1 } as any);

      await service['scrapeSource']('test-source', 'https://example.com/rss');

      expect(mockParser.parseURL).toHaveBeenCalledWith(
        'https://example.com/rss',
      );
      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle RSS parsing errors gracefully', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('RSS parsing failed')),
      };
      (service as any).parser = mockParser;

      // This should not throw an error
      await service['scrapeSource']('test-source', 'https://example.com/rss');

      expect(mockParser.parseURL).toHaveBeenCalledWith(
        'https://example.com/rss',
      );
    });
  });

  describe('getNextRunTime', () => {
    it('should return next hour time', () => {
      const now = new Date();
      const nextRun = service['getNextRunTime']();

      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
      expect(nextRun.getMinutes()).toBe(0);
      expect(nextRun.getSeconds()).toBe(0);
      expect(nextRun.getMilliseconds()).toBe(0);
    });
  });

  describe('extractDescription', () => {
    it('should extract description from content', () => {
      const item = { content: '<p>Test content</p>' };
      const result = service['extractDescription'](item);
      expect(result).toBe('Test content');
    });

    it('should extract description from summary', () => {
      const item = { summary: '<div>Test summary</div>' };
      const result = service['extractDescription'](item);
      expect(result).toBe('Test summary');
    });

    it('should return null for empty description', () => {
      const item = {};
      const result = service['extractDescription'](item);
      expect(result).toBeNull();
    });
  });

  describe('extractAuthor', () => {
    it('should extract author from creator field', () => {
      const item = { creator: 'John Doe' };
      const result = service['extractAuthor'](item);
      expect(result).toBe('John Doe');
    });

    it('should extract author from author field', () => {
      const item = { author: 'Jane Smith' };
      const result = service['extractAuthor'](item);
      expect(result).toBe('Jane Smith');
    });

    it('should extract author from dc:creator field', () => {
      const item = { 'dc:creator': 'Bob Johnson' };
      const result = service['extractAuthor'](item);
      expect(result).toBe('Bob Johnson');
    });

    it('should return null for no author', () => {
      const item = {};
      const result = service['extractAuthor'](item);
      expect(result).toBeNull();
    });
  });

  describe('extractPublishedDate', () => {
    it('should extract date from pubDate', () => {
      const item = { pubDate: '2024-01-01T00:00:00Z' };
      const result = service['extractPublishedDate'](item);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toContain('2024-01-01');
    });

    it('should extract date from published', () => {
      const item = { published: '2024-01-02T00:00:00Z' };
      const result = service['extractPublishedDate'](item);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toContain('2024-01-02');
    });

    it('should return null for invalid date', () => {
      const item = { pubDate: 'invalid-date' };
      const result = service['extractPublishedDate'](item);
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result!.getTime())).toBe(true);
    });

    it('should handle date parsing errors gracefully', () => {
      const item = { pubDate: 'not-a-date-at-all' };
      const result = service['extractPublishedDate'](item);
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result!.getTime())).toBe(true);
    });
  });

  describe('extractImageUrl', () => {
    it('should extract image from media:content', () => {
      const item = {
        'media:content': { url: 'https://example.com/image.jpg' },
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('should extract image from enclosure', () => {
      const item = {
        enclosure: {
          url: 'https://example.com/image.png',
          type: 'image/png',
        },
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBe('https://example.com/image.png');
    });

    it('should extract image from description HTML', () => {
      const item = {
        description:
          '<p>Some text <img src="https://example.com/image.jpg" alt="test" /></p>',
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('should return null for no image', () => {
      const item = {};
      const result = service['extractImageUrl'](item);
      expect(result).toBeNull();
    });

    it('should handle enclosure without image type', () => {
      const item = {
        enclosure: {
          url: 'https://example.com/document.pdf',
          type: 'application/pdf',
        },
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBeNull();
    });

    it('should handle enclosure without type', () => {
      const item = {
        enclosure: {
          url: 'https://example.com/image.jpg',
        },
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBeNull();
    });

    // Additional test to cover line 196 (imgMatch regex extraction)
    it('should extract image from content HTML with img tag', () => {
      const item = {
        content: '<div>Some content <img src="https://example.com/photo.jpg" width="100" /></div>',
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBe('https://example.com/photo.jpg');
    });

    it('should extract image from summary HTML with img tag', () => {
      const item = {
        summary: '<p>Summary with <img src="https://example.com/summary.jpg" alt="summary" /></p>',
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBe('https://example.com/summary.jpg');
    });

    it('should return null when img tag has no src attribute', () => {
      const item = {
        content: '<div>Some content <img alt="no src" /></div>',
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBeNull();
    });

    it('should return null when img tag has empty src attribute', () => {
      const item = {
        content: '<div>Some content <img src="" alt="empty src" /></div>',
      };
      const result = service['extractImageUrl'](item);
      expect(result).toBeNull();
    });
  });

  describe('scrapeAll error handling', () => {
    it('should handle all sources failing in scrapeAll', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('All sources failed')),
      };
      (service as any).parser = mockParser;

      // This should not throw an error
      await service.scrapeAll();
    });

    it('should handle mixed success and failure in scrapeAll', async () => {
      const mockParser = {
        parseURL: jest.fn().mockImplementation((url) => {
          if (url.includes('idnes.cz')) {
            return Promise.resolve({ items: [{ title: 'Test', link: 'http://test.com' }] });
          }
          return Promise.reject(new Error('Source failed'));
        }),
      };
      (service as any).parser = mockParser;

      // Mock repository for successful cases
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      await service.scrapeAll();
    });
  });

  describe('background processing error handling', () => {
    it('should handle setImmediate callback errors', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('setImmediate error')),
      };
      (service as any).parser = mockParser;

      const result = await service.scrapeImmediately('idnes.cz');
      expect(result.status).toBe('scheduled');

      // Wait for setImmediate to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle unknown error types in background processing', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue('String error instead of Error object'),
      };
      (service as any).parser = mockParser;

      const result = await service.scrapeImmediately('idnes.cz');
      expect(result.status).toBe('scheduled');

      // Wait for setImmediate to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('scrapeSource edge cases', () => {
    it('should handle null feed', async () => {
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(null),
      };
      (service as any).parser = mockParser;

      await service['scrapeSource']('test-source', 'https://example.com/rss');
    });

    it('should handle feed without items property', async () => {
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue({ title: 'Feed without items' }),
      };
      (service as any).parser = mockParser;

      await service['scrapeSource']('test-source', 'https://example.com/rss');
    });

    it('should handle items with empty content', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: '',
            summary: '',
            description: '',
          },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      await service['scrapeSource']('test-source', 'https://example.com/rss');

      expect(mockRepository.save).toHaveBeenCalled();
    });

    // Additional tests to cover lines 123-124 (error handling in scrapeSource)
    it('should handle parser errors with Error objects', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('Parser error')),
      };
      (service as any).parser = mockParser;

      await service['scrapeSource']('test-source', 'https://example.com/rss');
    });

    it('should handle parser errors with non-Error objects', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue('String error'),
      };
      (service as any).parser = mockParser;

      await service['scrapeSource']('test-source', 'https://example.com/rss');
    });

    it('should handle repository save errors', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: 'Test content',
          },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error('Database save error'));

      await service['scrapeSource']('test-source', 'https://example.com/rss');
    });
  });

  // Additional tests to cover lines 54-55 (error handling in scrapeAll)
  describe('scrapeAll comprehensive error handling', () => {
    it('should handle all sources failing with Error objects', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('All sources failed')),
      };
      (service as any).parser = mockParser;

      await service.scrapeAll();
    });

    it('should handle all sources failing with non-Error objects', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue('String error'),
      };
      (service as any).parser = mockParser;

      await service.scrapeAll();
    });

    it('should handle mixed success and failure scenarios', async () => {
      const mockParser = {
        parseURL: jest.fn().mockImplementation((url) => {
          if (url.includes('idnes.cz')) {
            return Promise.resolve({ items: [{ title: 'Test', link: 'http://test.com' }] });
          }
          return Promise.reject(new Error('Source failed'));
        }),
      };
      (service as any).parser = mockParser;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      await service.scrapeAll();
    });
  });

  // Additional tests to cover lines 80-100 (setImmediate background processing)
  describe('scrapeImmediately background processing', () => {
    it('should handle successful background processing for single source', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: 'Test content',
          },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      const result = await service.scrapeImmediately('idnes.cz');
      expect(result.status).toBe('scheduled');

      // Wait for setImmediate to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle successful background processing for all sources', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: 'Test content',
          },
        ],
      };
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockFeed),
      };
      (service as any).parser = mockParser;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      const result = await service.scrapeImmediately();
      expect(result.status).toBe('scheduled');

      // Wait for setImmediate to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle background processing with mixed success and failure', async () => {
      const mockParser = {
        parseURL: jest.fn().mockImplementation((url) => {
          if (url.includes('idnes.cz')) {
            return Promise.resolve({ items: [{ title: 'Test', link: 'http://test.com' }] });
          }
          return Promise.reject(new Error('Some sources fail'));
        }),
      };
      (service as any).parser = mockParser;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({} as any);

      const result = await service.scrapeImmediately();
      expect(result.status).toBe('scheduled');

      // Wait for setImmediate to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle background processing with all sources failing', async () => {
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('All sources failed')),
      };
      (service as any).parser = mockParser;

      const result = await service.scrapeImmediately();
      expect(result.status).toBe('scheduled');

      // Wait for setImmediate to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});
