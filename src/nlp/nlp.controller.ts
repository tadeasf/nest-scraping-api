import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../entities/article.entity';
import { NLPService, ArticleData } from './nlp.service';

@ApiTags('nlp')
@Controller('nlp')
export class NLPController {
  constructor(
    @InjectRepository(Article)
    private readonly _articleRepository: Repository<Article>,
    private readonly _nlpService: NLPService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check NLP service health' })
  @ApiResponse({ status: 200, description: 'NLP service health status' })
  async getHealth() {
    const isHealthy = await this._nlpService.healthCheck();
    return {
      status: isHealthy ? 'UP' : 'DOWN',
      service: 'czech-nlp',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('topics')
  @ApiOperation({ summary: 'Analyze topics in Czech articles' })
  @ApiResponse({ status: 200, description: 'Topic analysis results' })
  @ApiQuery({ name: 'numTopics', required: false, description: 'Number of topics to generate' })
  async analyzeTopics(
    @Body() articles: ArticleData[],
    @Query('numTopics', new DefaultValuePipe(10), ParseIntPipe) numTopics: number,
  ) {
    if (!articles || articles.length === 0) {
      throw new HttpException('No articles provided', HttpStatus.BAD_REQUEST);
    }

    if (numTopics < 1 || numTopics > 50) {
      throw new HttpException('Number of topics must be between 1 and 50', HttpStatus.BAD_REQUEST);
    }

    return await this._nlpService.analyzeTopics(articles, numTopics);
  }

  @Post('semantic')
  @ApiOperation({ summary: 'Perform semantic analysis on Czech articles' })
  @ApiResponse({ status: 200, description: 'Semantic analysis results' })
  @ApiQuery({ name: 'query', required: false, description: 'Query for similarity calculation' })
  async analyzeSemantics(
    @Body() articles: ArticleData[],
    @Query('query') query?: string,
  ) {
    if (!articles || articles.length === 0) {
      throw new HttpException('No articles provided', HttpStatus.BAD_REQUEST);
    }

    return await this._nlpService.analyzeSemantics(articles, query);
  }

  @Post('sentiment')
  @ApiOperation({ summary: 'Analyze sentiment in Czech articles' })
  @ApiResponse({ status: 200, description: 'Sentiment analysis results' })
  async analyzeSentiment(@Body() articles: ArticleData[]) {
    if (!articles || articles.length === 0) {
      throw new HttpException('No articles provided', HttpStatus.BAD_REQUEST);
    }

    return await this._nlpService.analyzeSentiment(articles);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Perform all NLP analyses in batch' })
  @ApiResponse({ status: 200, description: 'Batch analysis results' })
  async batchAnalysis(@Body() articles: ArticleData[]) {
    if (!articles || articles.length === 0) {
      throw new HttpException('No articles provided', HttpStatus.BAD_REQUEST);
    }

    if (articles.length > 100) {
      throw new HttpException('Maximum 100 articles allowed for batch analysis', HttpStatus.BAD_REQUEST);
    }

    return await this._nlpService.batchAnalysis(articles);
  }

  @Post('similar')
  @ApiOperation({ summary: 'Find similar articles based on semantic similarity' })
  @ApiResponse({ status: 200, description: 'Similar articles with similarity scores' })
  @ApiQuery({ name: 'topK', required: false, description: 'Number of similar articles to return' })
  async findSimilarArticles(
    @Body() queryArticle: ArticleData,
    @Body() articles: ArticleData[],
    @Query('topK', new DefaultValuePipe(5), ParseIntPipe) topK: number,
  ) {
    if (!queryArticle) {
      throw new HttpException('Query article is required', HttpStatus.BAD_REQUEST);
    }

    if (!articles || articles.length === 0) {
      throw new HttpException('No articles provided for comparison', HttpStatus.BAD_REQUEST);
    }

    if (topK < 1 || topK > 20) {
      throw new HttpException('topK must be between 1 and 20', HttpStatus.BAD_REQUEST);
    }

    return await this._nlpService.findSimilarArticles(queryArticle, articles, topK);
  }

  @Post('sentiment-stats')
  @ApiOperation({ summary: 'Get sentiment statistics for articles' })
  @ApiResponse({ status: 200, description: 'Sentiment statistics' })
  async getSentimentStats(@Body() articles: ArticleData[]) {
    if (!articles || articles.length === 0) {
      throw new HttpException('No articles provided', HttpStatus.BAD_REQUEST);
    }

    return await this._nlpService.getSentimentStats(articles);
  }

  @Get('articles/topics')
  @ApiOperation({ summary: 'Analyze topics for articles from database' })
  @ApiResponse({ status: 200, description: 'Topic analysis for database articles' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by source' })
  @ApiQuery({ name: 'numTopics', required: false, description: 'Number of topics to generate' })
  async analyzeDatabaseTopics(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('source') source?: string,
    @Query('numTopics', new DefaultValuePipe(10), ParseIntPipe) numTopics: number,
  ) {
    const queryBuilder = this._articleRepository.createQueryBuilder('article');

    if (source) {
      queryBuilder.andWhere('article.source = :source', { source });
    }

    const [articles, total] = await queryBuilder
      .orderBy('article.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (articles.length === 0) {
      return {
        topics: [],
        article_topics: [],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }

    // Convert to ArticleData format
    const articleData: ArticleData[] = articles.map((article) => ({
      id: article.id,
      title: article.title,
      description: article.description,
      content: article.content,
    }));

    const topicResults = await this._nlpService.analyzeTopics(articleData, numTopics);

    return {
      ...topicResults,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  @Get('articles/sentiment')
  @ApiOperation({ summary: 'Analyze sentiment for articles from database' })
  @ApiResponse({ status: 200, description: 'Sentiment analysis for database articles' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by source' })
  async analyzeDatabaseSentiment(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('source') source?: string,
  ) {
    const queryBuilder = this._articleRepository.createQueryBuilder('article');

    if (source) {
      queryBuilder.andWhere('article.source = :source', { source });
    }

    const [articles, total] = await queryBuilder
      .orderBy('article.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (articles.length === 0) {
      return {
        sentiments: [],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }

    // Convert to ArticleData format
    const articleData: ArticleData[] = articles.map((article) => ({
      id: article.id,
      title: article.title,
      description: article.description,
      content: article.content,
    }));

    const sentimentResults = await this._nlpService.analyzeSentiment(articleData);

    return {
      ...sentimentResults,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  @Get('articles/sentiment-stats')
  @ApiOperation({ summary: 'Get sentiment statistics for articles from database' })
  @ApiResponse({ status: 200, description: 'Sentiment statistics for database articles' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by source' })
  async getDatabaseSentimentStats(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('source') source?: string,
  ) {
    const queryBuilder = this._articleRepository.createQueryBuilder('article');

    if (source) {
      queryBuilder.andWhere('article.source = :source', { source });
    }

    const [articles, total] = await queryBuilder
      .orderBy('article.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (articles.length === 0) {
      return {
        stats: {
          total: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          averageConfidence: 0,
          averagePolarity: 0,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }

    // Convert to ArticleData format
    const articleData: ArticleData[] = articles.map((article) => ({
      id: article.id,
      title: article.title,
      description: article.description,
      content: article.content,
    }));

    const stats = await this._nlpService.getSentimentStats(articleData);

    return {
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
} 