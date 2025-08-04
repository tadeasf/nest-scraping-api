import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScrapingService } from './scraping.service';
import { Article } from '../entities/article.entity';
import * as crypto from 'crypto';

// Mock rss-parser
const mockParseURL = jest.fn();
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
  }));
});

describe('ScrapingService', () => {
  let service: ScrapingService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  const mockArticleRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapingService,
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
        },
      ],
    }).compile();

    service = module.get<ScrapingService>(ScrapingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrapeSource', () => {
    it('should successfully scrape and save new articles', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article 1',
            link: 'https://example.com/article1',
            content: 'Test content 1',
          },
          {
            title: 'Test Article 2',
            link: 'https://example.com/article2',
            content: 'Test content 2',
          },
        ],
      };

      const expectedHash1 = crypto
        .createHash('sha256')
        .update('Test content 1')
        .digest('hex');

      mockParseURL.mockResolvedValue(mockFeed);
      mockArticleRepository.findOne
        .mockResolvedValueOnce(null) // First article doesn't exist
        .mockResolvedValueOnce(null); // Second article doesn't exist

      await service['scrapeSource']('test-source', 'https://test.com/rss');

      expect(mockParseURL).toHaveBeenCalledWith('https://test.com/rss');
      expect(mockArticleRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockArticleRepository.save).toHaveBeenCalledTimes(2);
      expect(mockArticleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Article 1',
          url: 'https://example.com/article1',
          contentHash: expectedHash1,
          source: 'test-source',
        }),
      );
    });

    it('should skip articles that already exist', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: 'Test content',
          },
        ],
      };

      const expectedHash = crypto
        .createHash('sha256')
        .update('Test content')
        .digest('hex');

      mockParseURL.mockResolvedValue(mockFeed);
      mockArticleRepository.findOne.mockResolvedValue({ id: 1 } as Article); // Article exists

      await service['scrapeSource']('test-source', 'https://test.com/rss');

      expect(mockArticleRepository.findOne).toHaveBeenCalledWith({
        where: { contentHash: expectedHash },
      });
      expect(mockArticleRepository.save).not.toHaveBeenCalled();
    });

    it('should skip articles without title or link', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: 'Test content',
          },
          {
            title: undefined,
            link: 'https://example.com/article2',
            content: 'Test content 2',
          },
          {
            title: 'Test Article 3',
            link: undefined,
            content: 'Test content 3',
          },
        ],
      };

      mockParseURL.mockResolvedValue(mockFeed);
      mockArticleRepository.findOne.mockResolvedValue(null);

      await service['scrapeSource']('test-source', 'https://test.com/rss');

      expect(mockArticleRepository.save).toHaveBeenCalledTimes(1); // Only the first article
    });

    it('should handle RSS parsing errors gracefully', async () => {
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      mockParseURL.mockRejectedValue(new Error('Network error'));

      await service['scrapeSource']('test-source', 'https://test.com/rss');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to scrape test-source',
        'Network error',
      );

      loggerSpy.mockRestore();
    });

    it('should use summary when content is not available', async () => {
      const mockFeed = {
        items: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            content: undefined,
            summary: 'Test summary',
          },
        ],
      };

      const expectedHash = crypto
        .createHash('sha256')
        .update('Test summary')
        .digest('hex');

      mockParseURL.mockResolvedValue(mockFeed);
      mockArticleRepository.findOne.mockResolvedValue(null);

      await service['scrapeSource']('test-source', 'https://test.com/rss');

      expect(mockArticleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contentHash: expectedHash,
        }),
      );
    });
  });

  describe('scrapeAll', () => {
    it('should call scrapeSource for all configured sources', async () => {
      const scrapeSourceSpy = jest.spyOn(
        service,
        'scrapeSource' as keyof ScrapingService,
      );

      // Mock the scrapeSource method to resolve immediately
      (scrapeSourceSpy as jest.Mock).mockResolvedValue(undefined);

      await service.scrapeAll();

      expect(scrapeSourceSpy).toHaveBeenCalledTimes(5);
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'idnes.cz',
        'http://servis.idnes.cz/rss.asp',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'hn.cz',
        'https://rss.hn.cz/',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'aktualne.cz',
        'https://www.aktualne.cz/export-rss/r~b:article:rss/',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'novinky.cz',
        'https://www.novinky.cz/rss',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'blesk.cz',
        'https://www.blesk.cz/kategorie/2559/udalosti/rss/www.denik.cz',
      );

      scrapeSourceSpy.mockRestore();
    });
  });

  describe('getScrapingStats', () => {
    it('should return scraping statistics', async () => {
      const mockStats = [
        { source: 'idnes.cz', count: '10' },
        { source: 'hn.cz', count: '5' },
      ];

      mockArticleRepository.count.mockResolvedValue(15);
      mockQueryBuilder.getRawMany.mockResolvedValue(mockStats);

      const result = await service.getScrapingStats();

      expect(result.totalArticles).toBe(15);
      expect(result.articlesBySource).toEqual({
        'idnes.cz': 10,
        'hn.cz': 5,
      });
      expect(result.lastRun).toBeNull();
      expect(result.nextRun).toBeInstanceOf(Date);
    });
  });

  describe('scrapeImmediately', () => {
    it('should scrape all sources when no source specified', async () => {
      const scrapeSourceSpy = jest.spyOn(
        service,
        'scrapeSource' as keyof ScrapingService,
      );
      (scrapeSourceSpy as jest.Mock).mockResolvedValue(undefined);

      await service.scrapeImmediately();

      expect(scrapeSourceSpy).toHaveBeenCalledTimes(5);
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'idnes.cz',
        'http://servis.idnes.cz/rss.asp',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'hn.cz',
        'https://rss.hn.cz/',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'aktualne.cz',
        'https://www.aktualne.cz/export-rss/r~b:article:rss/',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'novinky.cz',
        'https://www.novinky.cz/rss',
      );
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'blesk.cz',
        'https://www.blesk.cz/kategorie/2559/udalosti/rss/www.denik.cz',
      );

      scrapeSourceSpy.mockRestore();
    });

    it('should scrape specific source when source specified', async () => {
      const scrapeSourceSpy = jest.spyOn(
        service,
        'scrapeSource' as keyof ScrapingService,
      );
      (scrapeSourceSpy as jest.Mock).mockResolvedValue(undefined);

      await service.scrapeImmediately('novinky.cz');

      expect(scrapeSourceSpy).toHaveBeenCalledTimes(1);
      expect(scrapeSourceSpy).toHaveBeenCalledWith(
        'novinky.cz',
        'https://www.novinky.cz/rss',
      );

      scrapeSourceSpy.mockRestore();
    });

    it('should throw error for invalid source', async () => {
      await expect(service.scrapeImmediately('invalid-source')).rejects.toThrow(
        'Invalid source: invalid-source. Valid sources are: idnes.cz, hn.cz, aktualne.cz, novinky.cz, blesk.cz',
      );
    });
  });
});
