import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ScrapingService } from './scraping.service';
import { ArticleScraperService } from './article-scraper.service';
import { Article } from '../entities/article.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// Suppress console.error during tests to reduce noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ScrapingService Integration', () => {
  let service: ScrapingService;
  let articleRepository: Repository<Article>;
  let module: TestingModule;
  let mockParseURL: jest.Mock;

  beforeAll(async () => {
    // Create a temporary SQLite database for testing
    const testDbPath = path.join(__dirname, '../../../test-db.sqlite');

    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: testDbPath,
          entities: [Article],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Article]),
      ],
      providers: [ScrapingService, ArticleScraperService],
    }).compile();

    service = module.get<ScrapingService>(ScrapingService);
    articleRepository = module.get<Repository<Article>>(
      getRepositoryToken(Article),
    );

    // Mock the RSS parser to prevent real network requests
    mockParseURL = jest.fn().mockResolvedValue({ items: [] });
    (service as any).parser = { parseURL: mockParseURL };

    // Mock the ArticleScraperService to prevent real web scraping
    const articleScraperService = module.get<ArticleScraperService>(
      ArticleScraperService,
    );
    (articleScraperService as any).scrapeArticlesContent = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await module.close();

    // Clean up test database
    const testDbPath = path.join(__dirname, '../../../test-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // Clear the database before each test
    await articleRepository.clear();
    // Reset the mock
    jest.clearAllMocks();
    mockParseURL.mockResolvedValue({ items: [] });
  });

  describe('Full Scraping Flow', () => {
    it('should scrape RSS feed and save articles to database', async () => {
      // Mock RSS parser to return realistic feed data
      const mockFeed = {
        items: [
          {
            title: 'Test Article 1',
            link: 'https://example.com/article1',
            content: '<p>This is test content for article 1</p>',
            creator: 'Test Author 1',
            pubDate: '2024-01-01T12:00:00Z',
            'media:content': { url: 'https://example.com/image1.jpg' },
          },
          {
            title: 'Test Article 2',
            link: 'https://example.com/article2',
            content: '<p>This is test content for article 2</p>',
            creator: 'Test Author 2',
            pubDate: '2024-01-01T13:00:00Z',
            enclosure: {
              url: 'https://example.com/image2.png',
              type: 'image/png',
            },
          },
        ],
      };

      // Mock the parser
      mockParseURL.mockResolvedValue(mockFeed);

      // Test scraping a single source
      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');

      // Verify articles were saved
      const savedArticles = await articleRepository.find();
      expect(savedArticles).toHaveLength(2);

      const article1 = savedArticles.find((a) => a.title === 'Test Article 1');
      expect(article1).toBeDefined();
      expect(article1?.url).toBe('https://example.com/article1');
      expect(article1?.author).toBe('Test Author 1');
      expect(article1?.imageUrl).toBe('https://example.com/image1.jpg');

      const article2 = savedArticles.find((a) => a.title === 'Test Article 2');
      expect(article2).toBeDefined();
      expect(article2?.url).toBe('https://example.com/article2');
      expect(article2?.author).toBe('Test Author 2');
      expect(article2?.imageUrl).toBe('https://example.com/image2.png');
    });

    it('should handle duplicate articles and not save them', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Duplicate Article',
            link: 'https://example.com/duplicate',
            content: '<p>This is a duplicate article</p>',
            creator: 'Test Author',
            pubDate: '2024-01-01T12:00:00Z',
          },
        ],
      };

      mockParseURL.mockResolvedValue(mockFeed);

      // Scrape the same content twice
      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');
      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');

      // Should only have one article saved
      const savedArticles = await articleRepository.find();
      expect(savedArticles).toHaveLength(1);
    });

    it('should handle RSS parsing errors gracefully', async () => {
      // Mock the parser to throw an error
      mockParseURL.mockRejectedValue(new Error('Network error'));

      // Should not throw error - the method catches errors internally
      await expect(
        service['scrapeSource']('idnes.cz', 'https://example.com/rss'),
      ).resolves.toBeUndefined();
    });

    it('should handle complex RSS feed structures', async () => {
      const complexFeed = {
        items: [
          {
            title: 'Article with all fields',
            link: 'https://example.com/full-article',
            content: '<p>Full content</p>',
            summary: '<p>Summary content</p>',
            description: '<p>Description content</p>',
            creator: 'Creator Author',
            author: 'Author Name',
            'dc:creator': 'DC Creator',
            pubDate: '2024-01-01T12:00:00Z',
            published: '2024-01-01T11:00:00Z',
            'dc:date': '2024-01-01T10:00:00Z',
            'media:content': { url: 'https://example.com/media.jpg' },
            enclosure: {
              url: 'https://example.com/enclosure.png',
              type: 'image/png',
            },
          },
          {
            title: 'Article with minimal fields',
            link: 'https://example.com/minimal-article',
            content: '<p>Minimal content</p>',
          },
          {
            title: 'Article with no content',
            link: 'https://example.com/no-content',
          },
          {
            // Article with no title or link (should be skipped)
            content: '<p>No title or link</p>',
          },
        ],
      };

      mockParseURL.mockResolvedValue(complexFeed);

      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');

      const savedArticles = await articleRepository.find();
      expect(savedArticles).toHaveLength(3); // All articles with title and link

      const fullArticle = savedArticles.find(
        (a) => a.title === 'Article with all fields',
      );
      expect(fullArticle).toBeDefined();
      expect(fullArticle?.author).toBe('Creator Author'); // Should use creator field
      expect(fullArticle?.publishedAt).toBeInstanceOf(Date);
      expect(fullArticle?.imageUrl).toBe('https://example.com/media.jpg'); // Should use media:content
    });
  });

  describe('Error Handling', () => {
    it('should handle RSS parser throwing different error types', async () => {
      // Test different types of RSS parsing errors
      const errorScenarios = [
        new Error('Network timeout'),
        new Error('Invalid XML'),
        new Error('HTTP 404'),
        new Error('HTTP 500'),
      ];

      for (const error of errorScenarios) {
        mockParseURL.mockRejectedValue(error);

        // Should not throw error for any error type - the method catches errors internally
        await expect(
          service['scrapeSource']('idnes.cz', 'https://example.com/rss'),
        ).resolves.toBeUndefined();
      }
    });

    it('should handle feed with null items', async () => {
      mockParseURL.mockResolvedValue({ items: null });

      await expect(
        service['scrapeSource']('idnes.cz', 'https://example.com/rss'),
      ).resolves.toBeUndefined();
    });

    it('should handle feed with undefined items', async () => {
      mockParseURL.mockResolvedValue({ items: undefined });

      await expect(
        service['scrapeSource']('idnes.cz', 'https://example.com/rss'),
      ).resolves.toBeUndefined();
    });

    it('should handle feed with empty items array', async () => {
      mockParseURL.mockResolvedValue({ items: [] });

      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');

      const savedArticles = await articleRepository.find();
      expect(savedArticles).toHaveLength(0);
    });
  });

  describe('Data Extraction Edge Cases', () => {
    it('should handle items with empty content fields', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Article with empty content',
            link: 'https://example.com/empty-content',
            content: '',
            summary: '',
            description: '',
          },
        ],
      };

      mockParseURL.mockResolvedValue(mockFeed);

      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');

      const savedArticles = await articleRepository.find();
      expect(savedArticles).toHaveLength(1);
      expect(savedArticles[0].description).toBeNull();
    });

    it('should handle items with invalid dates', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Article with invalid date',
            link: 'https://example.com/invalid-date',
            content: '<p>Test content</p>',
            pubDate: 'invalid-date-string',
          },
        ],
      };

      mockParseURL.mockResolvedValue(mockFeed);

      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');

      const savedArticles = await articleRepository.find();
      expect(savedArticles).toHaveLength(1);
      expect(savedArticles[0].publishedAt).toBeInstanceOf(Date);
    });

    it('should handle items with complex HTML in content', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Article with complex HTML',
            link: 'https://example.com/complex-html',
            content:
              '<div><p>First paragraph</p><p>Second paragraph with <strong>bold</strong> and <em>italic</em> text</p><ul><li>List item 1</li><li>List item 2</li></ul></div>',
          },
        ],
      };

      mockParseURL.mockResolvedValue(mockFeed);

      await service['scrapeSource']('idnes.cz', 'https://example.com/rss');

      const savedArticles = await articleRepository.find();
      expect(savedArticles).toHaveLength(1);
      expect(savedArticles[0].description).toContain('First paragraph');
      expect(savedArticles[0].description).toContain(
        'Second paragraph with bold and italic text',
      );
    });
  });
});
