import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticlesController } from './articles.controller';
import { ScrapingService } from '../scraping/scraping.service';
import { Article } from '../entities/article.entity';
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

describe('ArticlesController Integration', () => {
    let app: INestApplication;
    let controller: ArticlesController;
    let articleRepository: Repository<Article>;
    let scrapingService: ScrapingService;
    let module: TestingModule;

    beforeAll(async () => {
        // Create a temporary SQLite database for testing
        const testDbPath = path.join(__dirname, '../../../test-articles-db.sqlite');

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
            controllers: [ArticlesController],
            providers: [ScrapingService],
        }).compile();

        app = module.createNestApplication();
        await app.init();

        controller = module.get<ArticlesController>(ArticlesController);
        articleRepository = module.get<Repository<Article>>(getRepositoryToken(Article));
        scrapingService = module.get<ScrapingService>(ScrapingService);

        // Mock the RSS parser to prevent real network requests
        const mockParser = {
            parseURL: jest.fn().mockResolvedValue({ items: [] }),
        };
        (scrapingService as any).parser = mockParser;
    });

    afterAll(async () => {
        await app.close();

        // Clean up test database
        const testDbPath = path.join(__dirname, '../../../test-articles-db.sqlite');
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    beforeEach(async () => {
        // Clear the database before each test
        await articleRepository.clear();
    });

    describe('getArticles', () => {
        beforeEach(async () => {
            // Create test articles
            const testArticles = [
                {
                    title: 'Test Article 1',
                    url: 'https://example.com/article1',
                    contentHash: 'hash1',
                    source: 'idnes.cz',
                    description: 'Test description 1',
                    author: 'Test Author 1',
                    publishedAt: new Date('2024-01-01T12:00:00Z'),
                    imageUrl: 'https://example.com/image1.jpg',
                },
                {
                    title: 'Test Article 2',
                    url: 'https://example.com/article2',
                    contentHash: 'hash2',
                    source: 'hn.cz',
                    description: 'Test description 2',
                    author: 'Test Author 2',
                    publishedAt: new Date('2024-01-01T13:00:00Z'),
                    imageUrl: 'https://example.com/image2.jpg',
                },
                {
                    title: 'Search Result Article',
                    url: 'https://example.com/search-result',
                    contentHash: 'hash3',
                    source: 'idnes.cz',
                    description: 'This contains search term',
                    author: 'Test Author 3',
                    publishedAt: new Date('2024-01-01T14:00:00Z'),
                    imageUrl: 'https://example.com/image3.jpg',
                },
            ];

            await articleRepository.save(testArticles);
        });

        it('should return all articles with pagination', async () => {
            const result = await controller.getArticles(1, 10);

            expect(result.articles).toHaveLength(3);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 3,
                pages: 1,
            });
        });

        it('should filter by source', async () => {
            const result = await controller.getArticles(1, 10, 'idnes.cz');

            expect(result.articles).toHaveLength(2);
            expect(result.articles.every(article => article.source === 'idnes.cz')).toBe(true);
        });

        it('should search in title', async () => {
            const result = await controller.getArticles(1, 10, undefined, 'Search Result');

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].title).toBe('Search Result Article');
        });

        it('should combine source and search filters', async () => {
            const result = await controller.getArticles(1, 10, 'idnes.cz', 'Test');

            expect(result.articles).toHaveLength(1);
            expect(result.articles.every(article => article.source === 'idnes.cz')).toBe(true);
            expect(result.articles.every(article => article.title.includes('Test'))).toBe(true);
        });

        it('should handle pagination correctly', async () => {
            const result = await controller.getArticles(1, 2);

            expect(result.articles).toHaveLength(2);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 2,
                total: 3,
                pages: 2,
            });
        });

        it('should handle empty results', async () => {
            await articleRepository.clear();

            const result = await controller.getArticles(1, 10);

            expect(result.articles).toHaveLength(0);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 0,
                pages: 0,
            });
        });

        it('should handle database errors gracefully', async () => {
            // Mock the repository to throw an error
            const originalCreateQueryBuilder = articleRepository.createQueryBuilder;
            articleRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            await expect(controller.getArticles(1, 10)).rejects.toThrow('Database connection failed');

            // Restore original method
            articleRepository.createQueryBuilder = originalCreateQueryBuilder;
        });
    });

    describe('getSources', () => {
        beforeEach(async () => {
            // Create test articles with different sources
            const testArticles = [
                {
                    title: 'Article 1',
                    url: 'https://example.com/article1',
                    contentHash: 'hash1',
                    source: 'idnes.cz',
                },
                {
                    title: 'Article 2',
                    url: 'https://example.com/article2',
                    contentHash: 'hash2',
                    source: 'idnes.cz',
                },
                {
                    title: 'Article 3',
                    url: 'https://example.com/article3',
                    contentHash: 'hash3',
                    source: 'hn.cz',
                },
                {
                    title: 'Article 4',
                    url: 'https://example.com/article4',
                    contentHash: 'hash4',
                    source: 'aktualne.cz',
                },
            ];

            await articleRepository.save(testArticles);
        });

        it('should return sources with counts', async () => {
            const result = await controller.getSources();

            expect(result).toEqual([
                { source: 'idnes.cz', count: 2 },
                { source: 'hn.cz', count: 1 },
                { source: 'aktualne.cz', count: 1 },
            ]);
        });

        it('should handle empty database', async () => {
            await articleRepository.clear();

            const result = await controller.getSources();

            expect(result).toEqual([]);
        });

        it('should handle database errors gracefully', async () => {
            // Mock the repository to throw an error
            const originalCreateQueryBuilder = articleRepository.createQueryBuilder;
            articleRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
                throw new Error('Database query failed');
            });

            await expect(controller.getSources()).rejects.toThrow('Database query failed');

            // Restore original method
            articleRepository.createQueryBuilder = originalCreateQueryBuilder;
        });
    });

    describe('getStats', () => {
        beforeEach(async () => {
            // Create test articles with different dates
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const testArticles = [
                {
                    title: 'Today Article 1',
                    url: 'https://example.com/today1',
                    contentHash: 'hash1',
                    source: 'idnes.cz',
                    createdAt: today,
                },
                {
                    title: 'Today Article 2',
                    url: 'https://example.com/today2',
                    contentHash: 'hash2',
                    source: 'idnes.cz',
                    createdAt: today,
                },
                {
                    title: 'Yesterday Article',
                    url: 'https://example.com/yesterday',
                    contentHash: 'hash3',
                    source: 'hn.cz',
                    createdAt: yesterday,
                },
                {
                    title: 'Old Article',
                    url: 'https://example.com/old',
                    contentHash: 'hash4',
                    source: 'aktualne.cz',
                    createdAt: new Date('2024-01-01'),
                },
            ];

            await articleRepository.save(testArticles);
        });

        it('should return correct statistics', async () => {
            const result = await controller.getStats();

            expect(result.total).toBe(4);
            expect(result.today).toBe(2);
            expect(result.bySource).toEqual({
                'idnes.cz': 2,
                'hn.cz': 1,
                'aktualne.cz': 1,
            });
        });

        it('should handle empty database', async () => {
            await articleRepository.clear();

            const result = await controller.getStats();

            expect(result.total).toBe(0);
            expect(result.today).toBe(0);
            expect(result.bySource).toEqual({});
        });

        it('should handle database errors gracefully', async () => {
            // Mock the repository to throw an error
            const originalCount = articleRepository.count;
            articleRepository.count = jest.fn().mockRejectedValue(new Error('Database count failed'));

            await expect(controller.getStats()).rejects.toThrow('Database count failed');

            // Restore original method
            articleRepository.count = originalCount;
        });
    });

    describe('getArticle', () => {
        let testArticle: Article;

        beforeEach(async () => {
            testArticle = await articleRepository.save({
                title: 'Test Article',
                url: 'https://example.com/test',
                contentHash: 'test-hash',
                source: 'idnes.cz',
                description: 'Test description',
                author: 'Test Author',
                publishedAt: new Date('2024-01-01T12:00:00Z'),
                imageUrl: 'https://example.com/test-image.jpg',
            });
        });

        it('should return article by ID', async () => {
            const result = await controller.getArticle(testArticle.id);

            expect(result).toEqual(testArticle);
        });

        it('should throw error for non-existent article', async () => {
            await expect(controller.getArticle(999)).rejects.toThrow('Article not found');
        });

        it('should handle database errors gracefully', async () => {
            // Mock the repository to throw an error
            const originalFindOne = articleRepository.findOne;
            articleRepository.findOne = jest.fn().mockRejectedValue(new Error('Database query failed'));

            await expect(controller.getArticle(1)).rejects.toThrow('Database query failed');

            // Restore original method
            articleRepository.findOne = originalFindOne;
        });
    });

    describe('getArticlesBySource', () => {
        beforeEach(async () => {
            // Create test articles
            const testArticles = [
                {
                    title: 'IDNES Article 1',
                    url: 'https://example.com/idnes1',
                    contentHash: 'hash1',
                    source: 'idnes.cz',
                },
                {
                    title: 'IDNES Article 2',
                    url: 'https://example.com/idnes2',
                    contentHash: 'hash2',
                    source: 'idnes.cz',
                },
                {
                    title: 'HN Article',
                    url: 'https://example.com/hn',
                    contentHash: 'hash3',
                    source: 'hn.cz',
                },
            ];

            await articleRepository.save(testArticles);
        });

        it('should return articles by source with pagination', async () => {
            const result = await controller.getArticlesBySource('idnes.cz', 1, 10);

            expect(result.articles).toHaveLength(2);
            expect(result.articles.every(article => article.source === 'idnes.cz')).toBe(true);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 2,
                pages: 1,
            });
        });

        it('should handle non-existent source', async () => {
            const result = await controller.getArticlesBySource('non-existent', 1, 10);

            expect(result.articles).toHaveLength(0);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 0,
                pages: 0,
            });
        });

        it('should handle database errors gracefully', async () => {
            // Mock the repository to throw an error
            const originalFindAndCount = articleRepository.findAndCount;
            articleRepository.findAndCount = jest.fn().mockRejectedValue(new Error('Database query failed'));

            await expect(controller.getArticlesBySource('idnes.cz', 1, 10)).rejects.toThrow('Database query failed');

            // Restore original method
            articleRepository.findAndCount = originalFindAndCount;
        });
    });

    describe('getArticlesByDate', () => {
        beforeEach(async () => {
            // Create test articles with specific dates
            const testArticles = [
                {
                    title: 'Date Article 1',
                    url: 'https://example.com/date1',
                    contentHash: 'hash1',
                    source: 'idnes.cz',
                    createdAt: new Date('2024-01-01T12:00:00Z'),
                },
                {
                    title: 'Date Article 2',
                    url: 'https://example.com/date2',
                    contentHash: 'hash2',
                    source: 'hn.cz',
                    createdAt: new Date('2024-01-01T15:00:00Z'),
                },
                {
                    title: 'Different Date Article',
                    url: 'https://example.com/different',
                    contentHash: 'hash3',
                    source: 'aktualne.cz',
                    createdAt: new Date('2024-01-02T12:00:00Z'),
                },
            ];

            await articleRepository.save(testArticles);
        });

        it('should return articles by date', async () => {
            const result = await controller.getArticlesByDate('2024-01-01', 1, 10);

            expect(result.articles).toHaveLength(2);
            expect(result.date).toBe('2024-01-01');
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 2,
                pages: 1,
            });
        });

        it('should throw error for invalid date format', async () => {
            await expect(controller.getArticlesByDate('invalid-date', 1, 10)).rejects.toThrow(
                'Invalid date format. Use YYYY-MM-DD'
            );
        });

        it('should handle database errors gracefully', async () => {
            // Mock the repository to throw an error
            const originalCreateQueryBuilder = articleRepository.createQueryBuilder;
            articleRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
                throw new Error('Database query failed');
            });

            await expect(controller.getArticlesByDate('2024-01-01', 1, 10)).rejects.toThrow('Database query failed');

            // Restore original method
            articleRepository.createQueryBuilder = originalCreateQueryBuilder;
        });
    });

    describe('getRecentArticles', () => {
        beforeEach(async () => {
            // Create test articles with different dates
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
            const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

            const testArticles = [
                {
                    title: 'Recent Article 1',
                    url: 'https://example.com/recent1',
                    contentHash: 'hash1',
                    source: 'idnes.cz',
                    createdAt: now,
                },
                {
                    title: 'Recent Article 2',
                    url: 'https://example.com/recent2',
                    contentHash: 'hash2',
                    source: 'hn.cz',
                    createdAt: oneDayAgo,
                },
                {
                    title: 'Old Article',
                    url: 'https://example.com/old',
                    contentHash: 'hash3',
                    source: 'aktualne.cz',
                    createdAt: tenDaysAgo,
                },
            ];

            await articleRepository.save(testArticles);
        });

        it('should return recent articles', async () => {
            const result = await controller.getRecentArticles(7, 1, 10);

            expect(result.articles).toHaveLength(2); // Only articles from last 7 days
            expect(result.days).toBe(7);
            expect(result.fromDate).toBeDefined();
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 2,
                pages: 1,
            });
        });

        it('should throw error for invalid days parameter', async () => {
            await expect(controller.getRecentArticles(0, 1, 10)).rejects.toThrow(
                'Days must be between 1 and 365'
            );

            await expect(controller.getRecentArticles(366, 1, 10)).rejects.toThrow(
                'Days must be between 1 and 365'
            );
        });

        it('should handle database errors gracefully', async () => {
            // Mock the repository to throw an error
            const originalCreateQueryBuilder = articleRepository.createQueryBuilder;
            articleRepository.createQueryBuilder = jest.fn().mockImplementation(() => {
                throw new Error('Database query failed');
            });

            await expect(controller.getRecentArticles(7, 1, 10)).rejects.toThrow('Database query failed');

            // Restore original method
            articleRepository.createQueryBuilder = originalCreateQueryBuilder;
        });
    });

    describe('triggerScraping', () => {
        it('should trigger scraping for all sources', async () => {
            const result = await controller.triggerScraping();

            expect(result.success).toBe(true);
            expect(result.source).toBe('all');
            expect(result.status).toBe('scheduled');
            expect(result.timestamp).toBeDefined();
        });

        it('should trigger scraping for specific source', async () => {
            const result = await controller.triggerScraping('idnes.cz');

            expect(result.success).toBe(true);
            expect(result.source).toBe('idnes.cz');
            expect(result.status).toBe('scheduled');
            expect(result.timestamp).toBeDefined();
        });

        it('should handle invalid source error', async () => {
            await expect(controller.triggerScraping('invalid-source')).rejects.toThrow(
                'Invalid source: invalid-source'
            );
        });

        it('should handle scraping service errors', async () => {
            // Mock scraping service to throw error
            const originalScrapeImmediately = scrapingService.scrapeImmediately;
            scrapingService.scrapeImmediately = jest.fn().mockRejectedValue(new Error('Scraping failed'));

            await expect(controller.triggerScraping()).rejects.toThrow('Failed to trigger scraping');

            // Restore original method
            scrapingService.scrapeImmediately = originalScrapeImmediately;
        });
    });
}); 