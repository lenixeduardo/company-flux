import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, PaginationMeta } from '@flux/shared';

export interface ResponseWithMeta<T> {
  data: T;
  meta?: PaginationMeta;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (
          value !== null &&
          typeof value === 'object' &&
          'data' in (value as object) &&
          !Array.isArray(value)
        ) {
          const typed = value as ResponseWithMeta<T>;
          return {
            data: typed.data,
            meta: typed.meta,
          };
        }

        return { data: value };
      }),
    );
  }
}
