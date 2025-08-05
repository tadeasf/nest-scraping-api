import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Article } from '../entities/article.entity';
import { NLPController } from './nlp.controller';
import { NLPService } from './nlp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article]),
    ConfigModule,
  ],
  controllers: [NLPController],
  providers: [NLPService],
  exports: [NLPService],
})
export class NLPModule {} 