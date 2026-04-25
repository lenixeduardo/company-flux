import { Injectable, CanActivate, ExecutionContext, ForbiddenException, mixin, Type } from '@nestjs/common';
import { PLAN_LIMITS, PlanLimits, PlanType } from '@flux/shared';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { AuthenticatedRequest } from '../types/authenticated-request.js';

export function createPlanGuard(feature: keyof PlanLimits): Type<CanActivate> {
  @Injectable()
  class PlanGuardMixin implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const tenantId = request.tenantId ?? request.user?.tenantId;

      if (!tenantId) {
        throw new ForbiddenException('Tenant context not found');
      }

      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
        select: { planType: true },
      });

      const planType = (subscription?.planType ?? PlanType.FREE) as PlanType;
      const limits = PLAN_LIMITS[planType];
      const featureValue = limits[feature];

      const isAllowed =
        typeof featureValue === 'boolean'
          ? featureValue
          : typeof featureValue === 'number'
            ? featureValue > 0
            : false;

      if (!isAllowed) {
        throw new ForbiddenException(
          `Feature "${String(feature)}" is not available on your current plan (${planType}). Please upgrade to access this feature.`,
        );
      }

      return true;
    }
  }

  return mixin(PlanGuardMixin);
}
