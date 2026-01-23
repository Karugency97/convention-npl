import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';

interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const requestId = crypto.randomUUID().slice(0, 8);
    const startTime = Date.now();

    request.requestId = requestId;

    this.logger.log(`[${requestId}] ${method} ${url} - Started - IP: ${ip}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${requestId}] ${method} ${url} - ${response.statusCode} - ${duration}ms`,
          );
        },
        error: (error: { status?: number; message?: string }) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${requestId}] ${method} ${url} - ${error.status ?? 500} - ${duration}ms - ${error.message ?? 'Unknown error'}`,
          );
        },
      }),
    );
  }
}
