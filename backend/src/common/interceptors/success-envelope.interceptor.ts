import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { API_MESSAGE, PaginatedResult } from '../api-response';

@Injectable()
export class SuccessEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse();
    const message =
      this.reflector.get<string>(API_MESSAGE, context.getHandler()) ?? 'Request succeeded';

    return next.handle().pipe(
      map((result: unknown) => {
        const statusCode = response.statusCode ?? 200;
        if (this.isPaginated(result)) {
          return {
            statusCode,
            message,
            data: result.items,
            meta: result.meta,
          };
        }

        return { statusCode, message, data: result };
      }),
    );
  }

  private isPaginated(value: unknown): value is PaginatedResult<unknown> {
    return Boolean(
      value &&
        typeof value === 'object' &&
        Array.isArray((value as PaginatedResult<unknown>).items) &&
        (value as PaginatedResult<unknown>).meta,
    );
  }
}
