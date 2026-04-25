import { UserRole, PlanType } from '@flux/shared';

export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: UserRole;
  planType: PlanType;
}
