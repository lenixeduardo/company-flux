import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { TransactionType } from '@flux/shared';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional() @IsString() icon?: string;

  @IsOptional() @IsUUID() parentId?: string;
}
