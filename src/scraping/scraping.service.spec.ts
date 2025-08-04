import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScrapingService } from './scraping.service';
import { Article } from '../entities/article.entity';
import { getSourcesRecord } from './constants';

// Suppress console.error during tests to reduce noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

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
        'Invalid source: invalid-source. Valid sources are: idnes.cz, hn.cz-byznys, hn.cz-domaci, hn.cz-zahranicni, hn.cz-nazory, hn.cz-tech, aktualne.cz, novinky.cz, blesk.cz, ct24.cz, ceskatelevize.cz, e15.cz, lidovky.cz, sport.cz, lupa.cz, zive.cz, super.cz, reflex.cz, forbes.cz, echo24.cz, denik.cz, irozhlas.cz, irozhlas-domov, irozhlas-svet, irozhlas-veda-technologie, ceskenoviny-vse, ceskenoviny-cr, ceskenoviny-svet',
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
  });
});
