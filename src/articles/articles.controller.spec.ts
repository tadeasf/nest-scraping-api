import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticlesController } from './articles.controller';
import { Article } from '../entities/article.entity';
import { ScrapingService } from '../scraping/scraping.service';

describe('ArticlesController', () => {
  let controller: ArticlesController;
  let _articleRepository: Repository<Article>;
  let _scrapingService: ScrapingService;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getCount: jest.fn(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  const mockArticleRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
        },
        {
          provide: ScrapingService,
          useValue: {
            scrapeImmediately: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ArticlesController>(ArticlesController);
    _articleRepository = module.get<Repository<Article>>(
      getRepositoryToken(Article),
    );
    _scrapingService = module.get<ScrapingService>(ScrapingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getArticles', () => {
    it('should return articles with pagination', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Test Article 1',
          url: 'http://example.com/1',
          source: 'idnes.cz',
        },
        {
          id: 2,
          title: 'Test Article 2',
          url: 'http://example.com/2',
          source: 'hn.cz',
        },
      ];
      const mockTotal = 2;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockArticles,
        mockTotal,
      ]);

      const result = await controller.getArticles(1, 20);

      expect(result).toEqual({
        articles: mockArticles,
        pagination: {
          page: 1,
          limit: 20,
          total: mockTotal,
          pages: 1,
        },
      });
    });

    it('should filter by source', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Test Article',
          url: 'http://example.com/1',
          source: 'idnes.cz',
        },
      ];
      const mockTotal = 1;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockArticles,
        mockTotal,
      ]);

      await controller.getArticles(1, 20, 'idnes.cz');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'article.source = :source',
        { source: 'idnes.cz' },
      );
    });

    it('should search in title', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Search Result',
          url: 'http://example.com/1',
          source: 'idnes.cz',
        },
      ];
      const mockTotal = 1;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockArticles,
        mockTotal,
      ]);

      await controller.getArticles(1, 20, undefined, 'search');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'article.title LIKE :search',
        { search: '%search%' },
      );
    });

    it('should handle both source and search filters', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Search Result',
          url: 'http://example.com/1',
          source: 'idnes.cz',
        },
      ];
      const mockTotal = 1;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockArticles,
        mockTotal,
      ]);

      await controller.getArticles(1, 20, 'idnes.cz', 'search');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'article.source = :source',
        { source: 'idnes.cz' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'article.title LIKE :search',
        { search: '%search%' },
      );
    });

    it('should handle database errors gracefully', async () => {
      mockQueryBuilder.getManyAndCount.mockRejectedValue(new Error('Database error'));

      await expect(controller.getArticles(1, 20)).rejects.toThrow('Database error');
    });

    it('should handle empty results', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await controller.getArticles(1, 20);

      expect(result).toEqual({
        articles: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
        },
      });
    });
  });

  describe('getSources', () => {
    it('should return available sources with counts', async () => {
      const mockSources = [
        { source: 'idnes.cz', count: '10' },
        { source: 'hn.cz', count: '5' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockSources);

      const result = await controller.getSources();

      expect(result).toEqual([
        { source: 'idnes.cz', count: 10 },
        { source: 'hn.cz', count: 5 },
      ]);
    });
  });

  describe('getStats', () => {
    it('should return articles statistics', async () => {
      const mockTotalArticles = 15;
      const mockTodayArticles = 3;
      const mockArticlesBySource = [
        { source: 'idnes.cz', count: '10' },
        { source: 'hn.cz', count: '5' },
      ];

      mockArticleRepository.count.mockResolvedValue(mockTotalArticles);
      mockQueryBuilder.getCount.mockResolvedValue(mockTodayArticles);
      mockQueryBuilder.getRawMany.mockResolvedValue(mockArticlesBySource);

      const result = await controller.getStats();

      expect(result).toEqual({
        total: mockTotalArticles,
        today: mockTodayArticles,
        bySource: {
          'idnes.cz': 10,
          'hn.cz': 5,
        },
      });
    });
  });

  describe('getArticle', () => {
    it('should return article by ID', async () => {
      const mockArticle = {
        id: 1,
        title: 'Test Article',
        url: 'http://example.com/1',
        source: 'idnes.cz',
      };

      mockArticleRepository.findOne.mockResolvedValue(mockArticle);

      const result = await controller.getArticle(1);

      expect(result).toEqual(mockArticle);
      expect(mockArticleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw error when article not found', async () => {
      mockArticleRepository.findOne.mockResolvedValue(null);

      await expect(controller.getArticle(999)).rejects.toThrow(
        'Article not found',
      );
    });

    it('should handle database errors gracefully', async () => {
      mockArticleRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.getArticle(1)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getArticlesBySource', () => {
    it('should return articles by source with pagination', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Test Article 1',
          url: 'http://example.com/1',
          source: 'idnes.cz',
        },
        {
          id: 2,
          title: 'Test Article 2',
          url: 'http://example.com/2',
          source: 'idnes.cz',
        },
      ];
      const mockTotal = 2;

      mockArticleRepository.findAndCount.mockResolvedValue([
        mockArticles,
        mockTotal,
      ]);

      const result = await controller.getArticlesBySource('idnes.cz', 1, 20);

      expect(result).toEqual({
        articles: mockArticles,
        pagination: {
          page: 1,
          limit: 20,
          total: mockTotal,
          pages: 1,
        },
      });

      expect(mockArticleRepository.findAndCount).toHaveBeenCalledWith({
        where: { source: 'idnes.cz' },
        order: { id: 'DESC' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('getArticlesByDate', () => {
    it('should return articles by date with pagination', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Test Article 1',
          url: 'http://example.com/1',
          source: 'idnes.cz',
        },
      ];
      const mockTotal = 1;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockArticles,
        mockTotal,
      ]);

      const result = await controller.getArticlesByDate('2024-01-01', 1, 20);

      expect(result).toEqual({
        articles: mockArticles,
        pagination: {
          page: 1,
          limit: 20,
          total: mockTotal,
          pages: 1,
        },
        date: '2024-01-01',
      });
    });

    it('should throw error for invalid date format', async () => {
      await expect(
        controller.getArticlesByDate('invalid-date', 1, 20),
      ).rejects.toThrow('Invalid date format. Use YYYY-MM-DD');
    });
  });

  describe('getRecentArticles', () => {
    it('should return recent articles with pagination', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Test Article 1',
          url: 'http://example.com/1',
          source: 'idnes.cz',
        },
      ];
      const mockTotal = 1;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockArticles,
        mockTotal,
      ]);

      const result = await controller.getRecentArticles(7, 1, 20);

      expect(result).toEqual({
        articles: mockArticles,
        pagination: {
          page: 1,
          limit: 20,
          total: mockTotal,
          pages: 1,
        },
        days: 7,
        fromDate: expect.any(String),
      });
    });

    it('should throw error for invalid days parameter', async () => {
      await expect(controller.getRecentArticles(0, 1, 20)).rejects.toThrow(
        'Days must be between 1 and 365',
      );

      await expect(controller.getRecentArticles(366, 1, 20)).rejects.toThrow(
        'Days must be between 1 and 365',
      );
    });
  });

  describe('triggerScraping', () => {
    it('should trigger scraping for all sources when no source specified', async () => {
      const mockJobDetails = {
        jobId: 'scrape_1234567890',
        status: 'scheduled',
        source: 'all',
        scheduledAt: new Date(),
        message: 'Scraping scheduled for all sources',
      };
      (_scrapingService.scrapeImmediately as jest.Mock).mockResolvedValue(
        mockJobDetails,
      );

      const result = await controller.triggerScraping();

      expect(result).toEqual({
        success: true,
        ...mockJobDetails,
        timestamp: expect.any(String),
      });
      expect(_scrapingService.scrapeImmediately).toHaveBeenCalledWith(
        undefined,
      );
    });

    it('should trigger scraping for specific source', async () => {
      const mockJobDetails = {
        jobId: 'scrape_1234567890',
        status: 'scheduled',
        source: 'idnes.cz',
        scheduledAt: new Date(),
        message: 'Scraping scheduled for idnes.cz',
      };
      (_scrapingService.scrapeImmediately as jest.Mock).mockResolvedValue(
        mockJobDetails,
      );

      const result = await controller.triggerScraping('idnes.cz');

      expect(result).toEqual({
        success: true,
        ...mockJobDetails,
        timestamp: expect.any(String),
      });
      expect(_scrapingService.scrapeImmediately).toHaveBeenCalledWith(
        'idnes.cz',
      );
    });

    it('should handle invalid source error', async () => {
      const errorMessage =
        'Invalid source: invalid-source. Valid sources are: idnes.cz, hn.cz';
      (_scrapingService.scrapeImmediately as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(
        controller.triggerScraping('invalid-source'),
      ).rejects.toThrow(
        'Invalid source: invalid-source. Valid sources are: idnes.cz, hn.cz',
      );
    });

    it('should handle generic scraping errors', async () => {
      (_scrapingService.scrapeImmediately as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      await expect(controller.triggerScraping()).rejects.toThrow(
        'Failed to trigger scraping',
      );
    });
  });
});
