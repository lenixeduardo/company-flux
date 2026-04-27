import { IsEnum } from 'class-validator';
import { UserRole } from '@flux/shared';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
