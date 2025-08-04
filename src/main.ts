import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { WinstonModule } from 'nest-winston';
import { loggingConfig } from './config/logging.config';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggingConfig),
  });

  // Add global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Scraping API')
    .setDescription('API for scraping news articles from Czech news websites')
    .setVersion('1.0')
    .addTag('articles', 'News articles operations')
    .addTag('scraping', 'Scraping operations')
    .addTag('health', 'Health check operations')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  app.use(
    '/reference',
    apiReference({
      content: () => document,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // Use console for startup messages since logger might not be available yet
  // eslint-disable-next-line no-console
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(
    `📚 API Documentation available at: http://localhost:${port}/reference`,
  );
}

void bootstrap();
