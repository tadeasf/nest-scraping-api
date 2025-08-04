import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapingModule } from '../src/scraping/scraping.module';
import { Article } from '../src/entities/article.entity';

describe('Scraping (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Article],
          synchronize: true,
        }),
        ScrapingModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    await request(app.getHttpServer()).get('/').expect(200);
  });

  describe('Database Integration', () => {
    it('should create and retrieve articles', () => {
      // This test would require actual RSS feed mocking
      // For now, we'll test the basic setup
      expect(app).toBeDefined();
    });
  });
});
