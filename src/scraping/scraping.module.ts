import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../entities/article.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  providers: [ScrapingService],
  exports: [ScrapingService],
})
export class ScrapingModule {}
