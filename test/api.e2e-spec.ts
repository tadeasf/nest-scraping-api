import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('API E2E Tests', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    // Create a temporary SQLite database for E2E testing
    const testDbPath = path.join(__dirname, '../test-e2e-db.sqlite');

    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATABASE_PATH')
      .useValue(testDbPath)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();

    // Clean up test database
    const testDbPath = path.join(__dirname, '../test-e2e-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // Clear the database before each test
    const articleRepository = module.get('ArticleRepository');
    if (articleRepository) {
      await articleRepository.clear();
    }
  });

  describe('Articles API', () => {
    beforeEach(async () => {
      // Create test articles
      const articleRepository = module.get('ArticleRepository');
      if (articleRepository) {
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
      }
    });

    describe('GET /articles', () => {
      it('should return all articles with pagination', async () => {
        await request(app.getHttpServer())
          .get('/articles')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.articles).toHaveLength(3);
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 20,
              total: 3,
              pages: 1,
            });
          });
      });

      it('should filter by source', async () => {
        await request(app.getHttpServer())
          .get('/articles?source=idnes.cz')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.articles).toHaveLength(2);
            expect(
              res.body.articles.every(
                (article: any) => article.source === 'idnes.cz',
              ),
            ).toBe(true);
          });
      });

      it('should search in title', async () => {
        await request(app.getHttpServer())
          .get('/articles?search=Search Result')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.articles).toHaveLength(1);
            expect(res.body.articles[0].title).toBe('Search Result Article');
          });
      });

      it('should combine source and search filters', async () => {
        await request(app.getHttpServer())
          .get('/articles?source=idnes.cz&search=Test')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.articles).toHaveLength(2);
            expect(
              res.body.articles.every(
                (article: any) => article.source === 'idnes.cz',
              ),
            ).toBe(true);
            expect(
              res.body.articles.every((article: any) =>
                article.title.includes('Test'),
              ),
            ).toBe(true);
          });
      });

      it('should handle pagination', async () => {
        await request(app.getHttpServer())
          .get('/articles?page=1&limit=2')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.articles).toHaveLength(2);
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 2,
              total: 3,
              pages: 2,
            });
          });
      });

      it('should handle empty results', async () => {
        const repo = module.get('ArticleRepository');
        if (repo) {
          await repo.clear();
        }

        await request(app.getHttpServer())
          .get('/articles')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.articles).toHaveLength(0);
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 20,
              total: 0,
              pages: 0,
            });
          });
      });

      it('should handle invalid page parameter', async () => {
        await request(app.getHttpServer())
          .get('/articles?page=invalid')
          .expect(400);
      });

      it('should handle invalid limit parameter', async () => {
        await request(app.getHttpServer())
          .get('/articles?limit=invalid')
          .expect(400);
      });
    });

    describe('GET /articles/sources', () => {
      it('should return sources with counts', async () => {
        await request(app.getHttpServer())
          .get('/articles/sources')
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual([
              { source: 'idnes.cz', count: 2 },
              { source: 'hn.cz', count: 1 },
            ]);
          });
      });

      it('should handle empty database', async () => {
        const repo = module.get('ArticleRepository');
        if (repo) {
          await repo.clear();
        }

        await request(app.getHttpServer())
          .get('/articles/sources')
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual([]);
          });
      });
    });

    describe('GET /articles/stats', () => {
      it('should return correct statistics', async () => {
        await request(app.getHttpServer())
          .get('/articles/stats')
          .expect(200)
          .expect((res) => {
            expect(res.body.total).toBe(3);
            expect(res.body.today).toBeDefined();
            expect(res.body.bySource).toEqual({
              'idnes.cz': 2,
              'hn.cz': 1,
            });
          });
      });

      it('should handle empty database', async () => {
        const articleRepository = module.get('ArticleRepository');
        if (articleRepository) {
          await articleRepository.clear();
        }

        await request(app.getHttpServer())
          .get('/articles/stats')
          .expect(200)
          .expect((res) => {
            expect(res.body.total).toBe(0);
            expect(res.body.today).toBe(0);
            expect(res.body.bySource).toEqual({});
          });
      });
    });

    describe('GET /articles/:id', () => {
      it('should return article by ID', async () => {
        const articleRepository = module.get('ArticleRepository');
        if (articleRepository) {
          const article = await articleRepository.findOne({
            where: { title: 'Test Article 1' },
          });

          await request(app.getHttpServer())
            .get(`/articles/${article?.id}`)
            .expect(200)
            .expect((res) => {
              expect(res.body.title).toBe('Test Article 1');
              expect(res.body.source).toBe('idnes.cz');
            });
        }
      });

      it('should return 404 for non-existent article', async () => {
        await request(app.getHttpServer()).get('/articles/999').expect(404);
      });

      it('should handle invalid ID parameter', async () => {
        await request(app.getHttpServer())
          .get('/articles/invalid')
          .expect(400);
      });
    });

    describe('GET /articles/source/:source', () => {
      it('should return articles by source', async () => {
        await request(app.getHttpServer())
          .get('/articles/source/idnes.cz')
          .expect(200)
          .expect((res) => {
            expect(res.body.articles).toHaveLength(2);
            expect(
              res.body.articles.every(
                (article: any) => article.source === 'idnes.cz',
              ),
            ).toBe(true);
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 20,
              total: 2,
              pages: 1,
            });
          });
      });

      it('should handle non-existent source', async () => {
        await request(app.getHttpServer())
          .get('/articles/source/non-existent')
          .expect(200)
          .expect((res) => {
            expect(res.body.articles).toHaveLength(0);
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 20,
              total: 0,
              pages: 0,
            });
          });
      });

      it('should handle pagination', async () => {
        await request(app.getHttpServer())
          .get('/articles/source/idnes.cz?page=1&limit=1')
          .expect(200)
          .expect((res) => {
            expect(res.body.articles).toHaveLength(1);
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 1,
              total: 2,
              pages: 2,
            });
          });
      });
    });

    describe('GET /articles/date/:date', () => {
      beforeEach(async () => {
        // Create articles with specific dates
        const articleRepository = module.get('ArticleRepository');
        if (articleRepository) {
          await articleRepository.clear();
        }
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

        const articleRepository = module.get('ArticleRepository');
        if (articleRepository) {
          await articleRepository.save(testArticles);
        }
      });

      it('should return articles by date', async () => {
        await request(app.getHttpServer())
          .get('/articles/date/2024-01-01')
          .expect(200)
          .expect((res) => {
            expect(res.body.articles).toHaveLength(2);
            expect(res.body.date).toBe('2024-01-01');
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 20,
              total: 2,
              pages: 1,
            });
          });
      });

      it('should return 400 for invalid date format', async () => {
        await request(app.getHttpServer())
          .get('/articles/date/invalid-date')
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toBe(
              'Invalid date format. Use YYYY-MM-DD',
            );
          });
      });

      it('should handle non-existent date', async () => {
        await request(app.getHttpServer())
          .get('/articles/date/2024-12-31')
          .expect(200)
          .expect((res) => {
            expect(res.body.articles).toHaveLength(0);
            expect(res.body.date).toBe('2024-12-31');
          });
      });
    });

    describe('GET /articles/recent/:days', () => {
      beforeEach(async () => {
        // Create articles with different dates
        const articleRepository = module.get('ArticleRepository');
        if (articleRepository) {
          await articleRepository.clear();
        }
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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

        const articleRepository = module.get('ArticleRepository');
        if (articleRepository) {
          await articleRepository.save(testArticles);
        }
      });

      it('should return recent articles', async () => {
        await request(app.getHttpServer())
          .get('/articles/recent/7')
          .expect(200)
          .expect((res) => {
            expect(res.body.articles).toHaveLength(2); // Only articles from last 7 days
            expect(res.body.days).toBe(7);
            expect(res.body.fromDate).toBeDefined();
            expect(res.body.pagination).toEqual({
              page: 1,
              limit: 20,
              total: 2,
              pages: 1,
            });
          });
      });

      it('should return 400 for invalid days parameter', async () => {
        await request(app.getHttpServer())
          .get('/articles/recent/0')
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toBe('Days must be between 1 and 365');
          });
      });

      it('should return 400 for days parameter too high', async () => {
        await request(app.getHttpServer())
          .get('/articles/recent/366')
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toBe('Days must be between 1 and 365');
          });
      });

      it('should handle invalid days parameter', async () => {
        await request(app.getHttpServer())
          .get('/articles/recent/invalid')
          .expect(400);
      });
    });

    describe('POST /articles/scrape', () => {
      it('should trigger scraping for all sources', async () => {
        await request(app.getHttpServer())
          .post('/articles/scrape')
          .expect(200)
          .expect((res) => {
            expect(res.body.success).toBe(true);
            expect(res.body.source).toBe('all');
            expect(res.body.status).toBe('scheduled');
            expect(res.body.timestamp).toBeDefined();
          });
      });

      it('should trigger scraping for specific source', async () => {
        await request(app.getHttpServer())
          .post('/articles/scrape?source=idnes.cz')
          .expect(200)
          .expect((res) => {
            expect(res.body.success).toBe(true);
            expect(res.body.source).toBe('idnes.cz');
            expect(res.body.status).toBe('scheduled');
            expect(res.body.timestamp).toBeDefined();
          });
      });

      it('should return 400 for invalid source', async () => {
        await request(app.getHttpServer())
          .post('/articles/scrape?source=invalid-source')
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain(
              'Invalid source: invalid-source',
            );
          });
      });
    });
  });

  describe('Health API', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        await request(app.getHttpServer())
          .get('/health')
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('UP');
            expect(res.body.timestamp).toBeDefined();
            expect(res.body.uptime).toBeDefined();
            expect(res.body.version).toBe('1.0.0');
            expect(res.body.database).toBeDefined();
            expect(res.body.scraping).toBeDefined();
          });
      });
    });

    describe('GET /health/info', () => {
      it('should return application information', async () => {
        await request(app.getHttpServer())
          .get('/health/info')
          .expect(200)
          .expect((res) => {
            expect(res.body.name).toBe('NestJS Scraping API');
            expect(res.body.description).toBe(
              'API for scraping news articles from Czech news websites',
            );
            expect(res.body.version).toBe('1.0.0');
            expect(res.body.environment).toBeDefined();
            expect(res.body.nodeVersion).toBeDefined();
            expect(res.body.memory).toBeDefined();
          });
      });
    });

    describe('GET /health/scraping/status', () => {
      it('should return scraping status', async () => {
        await request(app.getHttpServer())
          .get('/health/scraping/status')
          .expect(200)
          .expect((res) => {
            expect(res.body.scheduled).toBeDefined();
            expect(res.body.schedule).toBe('0 * * * *');
            expect(res.body.sources).toBeDefined();
            expect(res.body.stats).toBeDefined();
          });
      });
    });

    describe('GET /health/metrics', () => {
      it('should return application metrics', async () => {
        await request(app.getHttpServer())
          .get('/health/metrics')
          .expect(200)
          .expect((res) => {
            expect(res.body.articles).toBeDefined();
            expect(res.body.system).toBeDefined();
            expect(res.body.scraping).toBeDefined();
          });
      });
    });
  });

  describe('Root API', () => {
    describe('GET /', () => {
      it('should return hello message', async () => {
        await request(app.getHttpServer())
          .get('/')
          .expect(200)
          .expect('Hello World!');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      await request(app.getHttpServer())
        .get('/non-existent-route')
        .expect(404);
    });
  });
});
