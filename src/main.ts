import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { WinstonModule } from 'nest-winston';
import { loggingConfig } from './config/logging.config';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import * as os from 'os';
import * as https from 'https';

async function getPublicIP(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.ip);
        } catch (error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

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

  // Get network interfaces for local IPs
  const networkInterfaces = os.networkInterfaces();
  const localIPs: string[] = [];

  // Extract local IP addresses
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaces = networkInterfaces[interfaceName];
    if (interfaces) {
      interfaces.forEach((interfaceInfo) => {
        if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
          localIPs.push(interfaceInfo.address);
        }
      });
    }
  });

  // Get public IP
  const publicIP = await getPublicIP();

  // Use console for startup messages since logger might not be available yet
  // eslint-disable-next-line no-console
  console.log(`🚀 Application is running on:`);
  // eslint-disable-next-line no-console
  console.log(`   Local:  http://localhost:${port}`);

  if (localIPs.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`   Local:  http://${localIPs[0]}:${port}`);
  }

  if (publicIP) {
    // eslint-disable-next-line no-console
    console.log(`   Public: http://${publicIP}:${port}`);
  }

  // eslint-disable-next-line no-console
  console.log(`📚 API Documentation available at:`);
  // eslint-disable-next-line no-console
  console.log(`   Local:  http://localhost:${port}/reference`);

  if (localIPs.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`   Local:  http://${localIPs[0]}:${port}/reference`);
  }

  if (publicIP) {
    // eslint-disable-next-line no-console
    console.log(`   Public: http://${publicIP}:${port}/reference`);
  }
}

void bootstrap();
