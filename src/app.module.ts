import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './entities/article.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { ScrapingModule } from './scraping/scraping.module';
import { NLPModule } from './nlp/nlp.module';
import { HealthController } from './health/health.controller';
import { ArticlesController } from './articles/articles.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite3',
      entities: [Article],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    ScrapingModule,
    NLPModule,
    TypeOrmModule.forFeature([Article]),
  ],
  controllers: [AppController, HealthController, ArticlesController],
  providers: [AppService],
})
export class AppModule {}
