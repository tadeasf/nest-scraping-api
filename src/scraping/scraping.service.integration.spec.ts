import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapingService } from './scraping.service';
import { Article } from '../entities/article.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
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
            providers: [ScrapingService],
        }).compile();

        service = module.get<ScrapingService>(ScrapingService);
        articleRepository = module.get<Repository<Article>>(getRepositoryToken(Article));

        // Mock the RSS parser to prevent real network requests
        const mockParser = {
            parseURL: jest.fn().mockResolvedValue({ items: [] }),
        };
        (service as any).parser = mockParser;
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
            const mockParser = {
                parseURL: jest.fn().mockResolvedValue(mockFeed),
            };
            (service as any).parser = mockParser;

            // Test scraping a single source
            await service['scrapeSource']('test-source', 'https://example.com/rss');

            // Verify articles were saved to database
            const savedArticles = await articleRepository.find();
            expect(savedArticles).toHaveLength(2);
            expect(savedArticles[0].title).toBe('Test Article 1');
            expect(savedArticles[0].source).toBe('test-source');
            expect(savedArticles[0].author).toBe('Test Author 1');
            expect(savedArticles[0].imageUrl).toBe('https://example.com/image1.jpg');
            expect(savedArticles[1].title).toBe('Test Article 2');
            expect(savedArticles[1].imageUrl).toBe('https://example.com/image2.png');
        });

        it('should handle duplicate articles and not save them', async () => {
            const mockFeed = {
                items: [
                    {
                        title: 'Duplicate Article',
                        link: 'https://example.com/duplicate',
                        content: '<p>Same content</p>',
                    },
                ],
            };

            const mockParser = {
                parseURL: jest.fn().mockResolvedValue(mockFeed),
            };
            (service as any).parser = mockParser;

            // Scrape the same content twice
            await service['scrapeSource']('test-source', 'https://example.com/rss');
            await service['scrapeSource']('test-source', 'https://example.com/rss');

            // Should only have one article
            const savedArticles = await articleRepository.find();
            expect(savedArticles).toHaveLength(1);
        });

        it('should handle database connection errors gracefully', async () => {
            // Mock RSS parser
            const mockFeed = {
                items: [
                    {
                        title: 'Test Article',
                        link: 'https://example.com/article',
                        content: '<p>Test content</p>',
                    },
                ],
            };

            const mockParser = {
                parseURL: jest.fn().mockResolvedValue(mockFeed),
            };
            (service as any).parser = mockParser;

            // Mock repository to throw database error
            const originalSave = articleRepository.save;
            articleRepository.save = jest.fn().mockRejectedValue(new Error('Database connection failed'));

            // Should not throw error
            await expect(
                service['scrapeSource']('test-source', 'https://example.com/rss'),
            ).resolves.not.toThrow();

            // Restore original method
            articleRepository.save = originalSave;
        });

        it('should handle RSS parsing errors with different error types', async () => {
            // Test different types of RSS parsing errors
            const errorScenarios = [
                new Error('Network timeout'),
                new Error('Invalid XML'),
                new Error('HTTP 404'),
                new Error('HTTP 500'),
                'String error instead of Error object',
                null,
                undefined,
            ];

            for (const error of errorScenarios) {
                const mockParser = {
                    parseURL: jest.fn().mockRejectedValue(error),
                };
                (service as any).parser = mockParser;

                // Should not throw error for any error type
                await expect(
                    service['scrapeSource']('test-source', 'https://example.com/rss'),
                ).resolves.not.toThrow();
            }
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

            const mockParser = {
                parseURL: jest.fn().mockResolvedValue(complexFeed),
            };
            (service as any).parser = mockParser;

            await service['scrapeSource']('test-source', 'https://example.com/rss');

            const savedArticles = await articleRepository.find();
            expect(savedArticles).toHaveLength(3); // All articles with title and link

            const fullArticle = savedArticles.find(a => a.title === 'Article with all fields');
            expect(fullArticle).toBeDefined();
            expect(fullArticle?.author).toBe('Creator Author'); // Should use creator field
            expect(fullArticle?.publishedAt).toBeInstanceOf(Date);
            expect(fullArticle?.imageUrl).toBe('https://example.com/media.jpg'); // Should use media:content
        });
    });

    describe('Advanced Error Scenarios', () => {
        it('should handle RSS parser throwing non-Error objects', async () => {
            const mockParser = {
                parseURL: jest.fn().mockRejectedValue('String error'),
            };
            (service as any).parser = mockParser;

            await expect(
                service['scrapeSource']('test-source', 'https://example.com/rss'),
            ).resolves.not.toThrow();
        });

        it('should handle RSS parser throwing null', async () => {
            const mockParser = {
                parseURL: jest.fn().mockRejectedValue(null),
            };
            (service as any).parser = mockParser;

            await expect(
                service['scrapeSource']('test-source', 'https://example.com/rss'),
            ).resolves.not.toThrow();
        });

        it('should handle RSS parser throwing undefined', async () => {
            const mockParser = {
                parseURL: jest.fn().mockRejectedValue(undefined),
            };
            (service as any).parser = mockParser;

            await expect(
                service['scrapeSource']('test-source', 'https://example.com/rss'),
            ).resolves.not.toThrow();
        });

        it('should handle feed with null items', async () => {
            const mockParser = {
                parseURL: jest.fn().mockResolvedValue({ items: null }),
            };
            (service as any).parser = mockParser;

            await expect(
                service['scrapeSource']('test-source', 'https://example.com/rss'),
            ).resolves.not.toThrow();
        });

        it('should handle feed with undefined items', async () => {
            const mockParser = {
                parseURL: jest.fn().mockResolvedValue({ items: undefined }),
            };
            (service as any).parser = mockParser;

            await expect(
                service['scrapeSource']('test-source', 'https://example.com/rss'),
            ).resolves.not.toThrow();
        });

        it('should handle feed with empty items array', async () => {
            const mockParser = {
                parseURL: jest.fn().mockResolvedValue({ items: [] }),
            };
            (service as any).parser = mockParser;

            await service['scrapeSource']('test-source', 'https://example.com/rss');

            const savedArticles = await articleRepository.find();
            expect(savedArticles).toHaveLength(0);
        });

        it('should handle database findOne errors', async () => {
            const mockFeed = {
                items: [
                    {
                        title: 'Test Article',
                        link: 'https://example.com/article',
                        content: '<p>Test content</p>',
                    },
                ],
            };

            const mockParser = {
                parseURL: jest.fn().mockResolvedValue(mockFeed),
            };
            (service as any).parser = mockParser;

            // Mock findOne to throw error
            const originalFindOne = articleRepository.findOne;
            articleRepository.findOne = jest.fn().mockRejectedValue(new Error('Database query failed'));

            await expect(
                service['scrapeSource']('test-source', 'https://example.com/rss'),
            ).resolves.not.toThrow();

            // Restore original method
            articleRepository.findOne = originalFindOne;
        });
    });

    describe('Data Extraction Edge Cases', () => {
        it('should handle items with empty content fields', async () => {
            const mockFeed = {
                items: [
                    {
                        title: 'Empty Content Article',
                        link: 'https://example.com/empty',
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

            await service['scrapeSource']('test-source', 'https://example.com/rss');

            const savedArticles = await articleRepository.find();
            expect(savedArticles).toHaveLength(1);
            expect(savedArticles[0].contentHash).toBeDefined();
        });

        it('should handle items with invalid dates', async () => {
            const mockFeed = {
                items: [
                    {
                        title: 'Invalid Date Article',
                        link: 'https://example.com/invalid-date',
                        content: '<p>Test content</p>',
                        pubDate: 'not-a-valid-date',
                    },
                ],
            };

            const mockParser = {
                parseURL: jest.fn().mockResolvedValue(mockFeed),
            };
            (service as any).parser = mockParser;

            await service['scrapeSource']('test-source', 'https://example.com/rss');

            const savedArticles = await articleRepository.find();
            expect(savedArticles).toHaveLength(1);
            // The date should be handled gracefully
            expect(savedArticles[0].publishedAt).toBeInstanceOf(Date);
        });

        it('should handle items with complex HTML in content', async () => {
            const mockFeed = {
                items: [
                    {
                        title: 'Complex HTML Article',
                        link: 'https://example.com/complex-html',
                        content: '<div><p>Content with <strong>bold</strong> and <em>italic</em> text</p><img src="https://example.com/image.jpg" alt="test" /></div>',
                    },
                ],
            };

            const mockParser = {
                parseURL: jest.fn().mockResolvedValue(mockFeed),
            };
            (service as any).parser = mockParser;

            await service['scrapeSource']('test-source', 'https://example.com/rss');

            const savedArticles = await articleRepository.find();
            expect(savedArticles).toHaveLength(1);
            expect(savedArticles[0].description).toBe('Content with bold and italic text');
            expect(savedArticles[0].imageUrl).toBe('https://example.com/image.jpg');
        });
    });
}); 