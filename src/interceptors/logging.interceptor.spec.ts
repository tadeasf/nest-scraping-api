import { Test, TestingModule } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should intercept successful requests', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/test',
          ip: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' },
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
      getClass: () => ({ name: 'TestController' }),
      getHandler: () => ({ name: 'testMethod' }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'test response' }),
    } as CallHandler;

    const result = interceptor.intercept(mockContext, mockCallHandler);

    result.subscribe({
      next: (data) => {
        expect(data).toEqual({ data: 'test response' });
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });

  it('should intercept requests with different HTTP methods', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/api/articles',
          ip: '192.168.1.1',
          headers: { 'user-agent': 'postman' },
        }),
        getResponse: () => ({
          statusCode: 201,
        }),
      }),
      getClass: () => ({ name: 'ArticlesController' }),
      getHandler: () => ({ name: 'createArticle' }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ id: 1, title: 'New Article' }),
    } as CallHandler;

    const result = interceptor.intercept(mockContext, mockCallHandler);

    result.subscribe({
      next: (data) => {
        expect(data).toEqual({ id: 1, title: 'New Article' });
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });

  it('should handle requests without user-agent header', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PUT',
          url: '/api/articles/1',
          ip: '10.0.0.1',
          headers: {},
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
      getClass: () => ({ name: 'ArticlesController' }),
      getHandler: () => ({ name: 'updateArticle' }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ id: 1, title: 'Updated Article' }),
    } as CallHandler;

    const result = interceptor.intercept(mockContext, mockCallHandler);

    result.subscribe({
      next: (data) => {
        expect(data).toEqual({ id: 1, title: 'Updated Article' });
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });

  it('should handle request errors gracefully', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/api/articles',
          ip: '192.168.1.1',
          headers: { 'user-agent': 'test-client' },
        }),
        getResponse: () => ({
          statusCode: 500,
        }),
      }),
      getClass: () => ({ name: 'ArticlesController' }),
      getHandler: () => ({ name: 'createArticle' }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => throwError(() => new Error('Database connection failed')),
    } as CallHandler;

    const result = interceptor.intercept(mockContext, mockCallHandler);

    result.subscribe({
      next: () => {
        done(new Error('Should have thrown an error'));
      },
      error: (error) => {
        expect(error.message).toBe('Database connection failed');
        done();
      },
    });
  });

  it('should handle requests with different HTTP status codes', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PUT',
          url: '/api/articles/1',
          ip: '10.0.0.1',
          headers: { 'user-agent': 'curl' },
        }),
        getResponse: () => ({
          statusCode: 404,
        }),
      }),
      getClass: () => ({ name: 'ArticlesController' }),
      getHandler: () => ({ name: 'updateArticle' }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => throwError(() => ({ status: 404, message: 'Not found' })),
    } as CallHandler;

    const result = interceptor.intercept(mockContext, mockCallHandler);

    result.subscribe({
      next: () => {
        done(new Error('Should have thrown an error'));
      },
      error: (error) => {
        expect(error.status).toBe(404);
        done();
      },
    });
  });

  it('should handle requests with missing user-agent header', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'DELETE',
          url: '/api/articles/1',
          ip: '172.16.0.1',
          headers: {},
        }),
        getResponse: () => ({
          statusCode: 204,
        }),
      }),
      getClass: () => ({ name: 'ArticlesController' }),
      getHandler: () => ({ name: 'deleteArticle' }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ success: true }),
    } as CallHandler;

    const result = interceptor.intercept(mockContext, mockCallHandler);

    result.subscribe({
      next: (data) => {
        expect(data).toEqual({ success: true });
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });

  it('should handle requests with null user-agent header', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/articles',
          ip: '127.0.0.1',
          headers: { 'user-agent': null },
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
      getClass: () => ({ name: 'ArticlesController' }),
      getHandler: () => ({ name: 'getArticles' }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ articles: [] }),
    } as CallHandler;

    const result = interceptor.intercept(mockContext, mockCallHandler);

    result.subscribe({
      next: (data) => {
        expect(data).toEqual({ articles: [] });
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });
});
