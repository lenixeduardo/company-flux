import { Request } from 'express';
import { UserRole } from '@flux/shared';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  tenantId: string;
}
