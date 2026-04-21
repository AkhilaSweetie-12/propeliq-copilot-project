import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessResponse, ServiceResponse } from '../types/api-response.type';

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T | ServiceResponse<T>, ApiSuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T | ServiceResponse<T>>,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (this.isWrappedSuccess(value)) {
          return value;
        }

        if (this.hasDataShape(value)) {
          return {
            success: true,
            data: value.data,
            meta: value.meta,
          };
        }

        return {
          success: true,
          data: value as T,
        };
      }),
    );
  }

  private isWrappedSuccess(value: unknown): value is ApiSuccessResponse<T> {
    return typeof value === 'object' && value !== null && 'success' in value;
  }

  private hasDataShape(value: unknown): value is ServiceResponse<T> {
    return typeof value === 'object' && value !== null && 'data' in value;
  }
}