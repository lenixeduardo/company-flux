import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuthenticatedRequest } from '../types/authenticated-request.js';

const AUDITABLE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @InjectQueue('audit-log') private readonly auditQueue: Queue,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const method = request.method.toUpperCase();

    if (!AUDITABLE_METHODS.has(method)) {
      return next.handle();
    }

    const { user, tenantId, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          void this.auditQueue
            .add('create-audit-log', {
              tenantId: tenantId ?? user?.tenantId,
              userId: user?.userId,
              action: method,
              resource: url,
              after: responseData,
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            })
            .catch(() => {
              // Non-critical: audit log failure must not break the request
            });
        },
        error: (err: unknown) => {
          void this.auditQueue
            .add('create-audit-log', {
              tenantId: tenantId ?? user?.tenantId,
              userId: user?.userId,
              action: method,
              resource: url,
              error: err instanceof Error ? err.message : String(err),
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            })
            .catch(() => {
              // Non-critical
            });
        },
      }),
    );
  }
}
