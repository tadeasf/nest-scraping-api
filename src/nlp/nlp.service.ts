import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

export interface ArticleData {
  id: number;
  title: string;
  description?: string;
  content?: string;
}

export interface TopicModelingResult {
  topics: Array<{
    topic_id: number;
    count: number;
    words: string[];
    weights: number[];
  }>;
  article_topics: Array<{
    article_index: number;
    primary_topic: number;
    topic_probabilities: number[];
    confidence: number;
  }>;
}

export interface SemanticAnalysisResult {
  embeddings: Array<{
    article_index: number;
    embedding: number[];
    text_length: number;
  }>;
  similarities?: number[];
}

export interface SentimentAnalysisResult {
  sentiments: Array<{
    article_index: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    polarity: number;
    subjectivity: number;
  }>;
}

export interface BatchAnalysisResult {
  topics: TopicModelingResult['topics'];
  article_topics: TopicModelingResult['article_topics'];
  embeddings: SemanticAnalysisResult['embeddings'];
  sentiments: SentimentAnalysisResult['sentiments'];
}

@Injectable()
export class NLPService {
  private readonly logger = new Logger(NLPService.name);
  private readonly nlpServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.nlpServiceUrl = this.configService.get<string>('NLP_SERVICE_URL', 'http://localhost:8001');
  }

  /**
   * Analyze topics in Czech articles
   */
  async analyzeTopics(
    articles: ArticleData[],
    numTopics: number = 10,
  ): Promise<TopicModelingResult> {
    try {
      this.logger.log(`Analyzing topics for ${articles.length} articles`);

      const response: AxiosResponse<TopicModelingResult> = await axios.post(
        `${this.nlpServiceUrl}/topics`,
        {
          articles,
          num_topics: numTopics,
        },
        {
          timeout: 30000, // 30 seconds timeout
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Topic analysis completed for ${articles.length} articles`);
      return response.data;
    } catch (error) {
      this.logger.error(`Topic analysis failed: ${error.message}`);
      throw new HttpException(
        'Failed to analyze topics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Perform semantic analysis on Czech articles
   */
  async analyzeSemantics(
    articles: ArticleData[],
    query?: string,
  ): Promise<SemanticAnalysisResult> {
    try {
      this.logger.log(`Analyzing semantics for ${articles.length} articles`);

      const response: AxiosResponse<SemanticAnalysisResult> = await axios.post(
        `${this.nlpServiceUrl}/semantic`,
        {
          articles,
          query,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Semantic analysis completed for ${articles.length} articles`);
      return response.data;
    } catch (error) {
      this.logger.error(`Semantic analysis failed: ${error.message}`);
      throw new HttpException(
        'Failed to analyze semantics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Analyze sentiment in Czech articles
   */
  async analyzeSentiment(articles: ArticleData[]): Promise<SentimentAnalysisResult> {
    try {
      this.logger.log(`Analyzing sentiment for ${articles.length} articles`);

      const response: AxiosResponse<SentimentAnalysisResult> = await axios.post(
        `${this.nlpServiceUrl}/sentiment`,
        {
          articles,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Sentiment analysis completed for ${articles.length} articles`);
      return response.data;
    } catch (error) {
      this.logger.error(`Sentiment analysis failed: ${error.message}`);
      throw new HttpException(
        'Failed to analyze sentiment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Perform all NLP analyses in one batch request
   */
  async batchAnalysis(articles: ArticleData[]): Promise<BatchAnalysisResult> {
    try {
      this.logger.log(`Performing batch analysis for ${articles.length} articles`);

      const response: AxiosResponse<BatchAnalysisResult> = await axios.post(
        `${this.nlpServiceUrl}/batch-analysis`,
        articles,
        {
          timeout: 60000, // 60 seconds for batch processing
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Batch analysis completed for ${articles.length} articles`);
      return response.data;
    } catch (error) {
      this.logger.error(`Batch analysis failed: ${error.message}`);
      throw new HttpException(
        'Failed to perform batch analysis',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if NLP service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.nlpServiceUrl}/health`, {
        timeout: 5000,
      });
      return response.data.status === 'healthy';
    } catch (error) {
      this.logger.error(`NLP service health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get articles with NLP analysis results
   */
  async getArticlesWithNLP(
    articles: ArticleData[],
    includeTopics: boolean = true,
    includeSemantics: boolean = true,
    includeSentiment: boolean = true,
  ): Promise<{
    articles: ArticleData[];
    topics?: TopicModelingResult;
    semantics?: SemanticAnalysisResult;
    sentiment?: SentimentAnalysisResult;
  }> {
    const results: any = { articles };

    try {
      if (includeTopics) {
        results.topics = await this.analyzeTopics(articles);
      }

      if (includeSemantics) {
        results.semantics = await this.analyzeSemantics(articles);
      }

      if (includeSentiment) {
        results.sentiment = await this.analyzeSentiment(articles);
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to get articles with NLP: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find similar articles based on semantic similarity
   */
  async findSimilarArticles(
    queryArticle: ArticleData,
    articles: ArticleData[],
    topK: number = 5,
  ): Promise<Array<{ article: ArticleData; similarity: number; index: number }>> {
    try {
      const semantics = await this.analyzeSemantics(articles, queryArticle.title);
      
      if (!semantics.similarities) {
        throw new Error('Similarities not calculated');
      }

      // Create array of articles with similarities
      const articlesWithSimilarities = articles.map((article, index) => ({
        article,
        similarity: semantics.similarities![index],
        index,
      }));

      // Sort by similarity (descending) and return top K
      return articlesWithSimilarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      this.logger.error(`Failed to find similar articles: ${error.message}`);
      throw new HttpException(
        'Failed to find similar articles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sentiment statistics for articles
   */
  async getSentimentStats(articles: ArticleData[]): Promise<{
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    averageConfidence: number;
    averagePolarity: number;
  }> {
    try {
      const sentiment = await this.analyzeSentiment(articles);
      
      const stats = {
        total: sentiment.sentiments.length,
        positive: 0,
        negative: 0,
        neutral: 0,
        averageConfidence: 0,
        averagePolarity: 0,
      };

      let totalConfidence = 0;
      let totalPolarity = 0;

      sentiment.sentiments.forEach((s) => {
        stats[s.sentiment]++;
        totalConfidence += s.confidence;
        totalPolarity += s.polarity;
      });

      stats.averageConfidence = totalConfidence / stats.total;
      stats.averagePolarity = totalPolarity / stats.total;

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get sentiment stats: ${error.message}`);
      throw new HttpException(
        'Failed to get sentiment statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 