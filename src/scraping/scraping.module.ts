import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { ArticleScraperService } from './article-scraper.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../entities/article.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  providers: [ScrapingService, ArticleScraperService],
  exports: [ScrapingService, ArticleScraperService],
})
export class ScrapingModule {}
