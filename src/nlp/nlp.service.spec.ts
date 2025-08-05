import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NLPService, ArticleData } from './nlp.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NLPService', () => {
  let service: NLPService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NLPService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NLPService>(NLPService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('http://localhost:8001');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeTopics', () => {
    it('should analyze topics successfully', async () => {
      const mockArticles: ArticleData[] = [
        {
          id: 1,
          title: 'Test článek',
          description: 'Test popis',
        },
      ];

      const mockResponse = {
        data: {
          topics: [
            {
              topic_id: 1,
              count: 1,
              words: ['test', 'článek'],
              weights: [0.8, 0.6],
            },
          ],
          article_topics: [
            {
              article_index: 0,
              primary_topic: 1,
              topic_probabilities: [0.9, 0.1],
              confidence: 0.9,
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.analyzeTopics(mockArticles, 10);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8001/topics',
        {
          articles: mockArticles,
          num_topics: 10,
        },
        expect.any(Object),
      );
    });

    it('should handle errors gracefully', async () => {
      const mockArticles: ArticleData[] = [
        {
          id: 1,
          title: 'Test článek',
        },
      ];

      mockedAxios.post.mockRejectedValue(new Error('Service unavailable'));

      await expect(service.analyzeTopics(mockArticles)).rejects.toThrow(
        'Failed to analyze topics',
      );
    });
  });

  describe('analyzeSemantics', () => {
    it('should analyze semantics successfully', async () => {
      const mockArticles: ArticleData[] = [
        {
          id: 1,
          title: 'Test článek',
          description: 'Test popis',
        },
      ];

      const mockResponse = {
        data: {
          embeddings: [
            {
              article_index: 0,
              embedding: [0.1, 0.2, 0.3],
              text_length: 10,
            },
          ],
          similarities: [0.8],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.analyzeSemantics(mockArticles, 'test query');

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8001/semantic',
        {
          articles: mockArticles,
          query: 'test query',
        },
        expect.any(Object),
      );
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment successfully', async () => {
      const mockArticles: ArticleData[] = [
        {
          id: 1,
          title: 'Pozitivní článek',
          description: 'Dobrý popis',
        },
      ];

      const mockResponse = {
        data: {
          sentiments: [
            {
              article_index: 0,
              sentiment: 'positive',
              confidence: 0.8,
              polarity: 0.6,
              subjectivity: 0.7,
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.analyzeSentiment(mockArticles);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8001/sentiment',
        {
          articles: mockArticles,
        },
        expect.any(Object),
      );
    });
  });

  describe('batchAnalysis', () => {
    it('should perform batch analysis successfully', async () => {
      const mockArticles: ArticleData[] = [
        {
          id: 1,
          title: 'Test článek',
        },
      ];

      const mockResponse = {
        data: {
          topics: [],
          article_topics: [],
          embeddings: [],
          sentiments: [],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.batchAnalysis(mockArticles);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8001/batch-analysis',
        mockArticles,
        expect.any(Object),
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8001/health',
        expect.any(Object),
      );
    });

    it('should return false when service is unhealthy', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection failed'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('findSimilarArticles', () => {
    it('should find similar articles successfully', async () => {
      const queryArticle: ArticleData = {
        id: 1,
        title: 'Query článek',
      };

      const articles: ArticleData[] = [
        {
          id: 2,
          title: 'Similar článek',
        },
        {
          id: 3,
          title: 'Different článek',
        },
      ];

      const mockResponse = {
        data: {
          embeddings: [
            { article_index: 0, embedding: [0.1, 0.2], text_length: 5 },
            { article_index: 1, embedding: [0.3, 0.4], text_length: 5 },
          ],
          similarities: [0.9, 0.3],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.findSimilarArticles(queryArticle, articles, 2);

      expect(result).toHaveLength(2);
      expect(result[0].similarity).toBe(0.9);
      expect(result[1].similarity).toBe(0.3);
    });
  });

  describe('getSentimentStats', () => {
    it('should calculate sentiment statistics correctly', async () => {
      const articles: ArticleData[] = [
        { id: 1, title: 'Positive' },
        { id: 2, title: 'Negative' },
        { id: 3, title: 'Neutral' },
      ];

      const mockResponse = {
        data: {
          sentiments: [
            {
              article_index: 0,
              sentiment: 'positive',
              confidence: 0.8,
              polarity: 0.6,
              subjectivity: 0.7,
            },
            {
              article_index: 1,
              sentiment: 'negative',
              confidence: 0.7,
              polarity: -0.5,
              subjectivity: 0.6,
            },
            {
              article_index: 2,
              sentiment: 'neutral',
              confidence: 0.5,
              polarity: 0.0,
              subjectivity: 0.3,
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.getSentimentStats(articles);

      expect(result.total).toBe(3);
      expect(result.positive).toBe(1);
      expect(result.negative).toBe(1);
      expect(result.neutral).toBe(1);
      expect(result.averageConfidence).toBeCloseTo(0.67, 2);
      expect(result.averagePolarity).toBeCloseTo(0.03, 2);
    });
  });
}); 