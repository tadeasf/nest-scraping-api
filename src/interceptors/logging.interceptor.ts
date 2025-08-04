import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] ?? '';
    const startTime = Date.now();

    this.logger.log(`Incoming ${method} ${url} - ${ip} - ${userAgent}`);

    return next.handle().pipe(
      tap({
        next: (__data) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          this.logger.log(
            `Completed ${method} ${url} - ${response.statusCode} - ${duration}ms`,
          );
        },
        error: (error: Error & { status?: number }) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          this.logger.error(
            `Failed ${method} ${url} - ${error.status ?? 500} - ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
