import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@flux/shared';

export class CreateInviteDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
