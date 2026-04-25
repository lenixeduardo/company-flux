import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PlanType, UserRole } from '@flux/shared';
import { tenantContext } from '../../modules/prisma/prisma.service.js';
import { AuthenticatedRequest } from '../types/authenticated-request.js';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.tenantId ?? request.user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    const store = {
      tenantId,
      userId: request.user?.userId ?? '',
      userRole: request.user?.role ?? UserRole.LEITURA,
      planType: PlanType.FREE,
    };

    return new Observable((observer) => {
      tenantContext.run(store, () => {
        next
          .handle()
          .subscribe({
            next: (value) => observer.next(value),
            error: (err: unknown) => observer.error(err),
            complete: () => observer.complete(),
          });
      });
    });
  }
}
