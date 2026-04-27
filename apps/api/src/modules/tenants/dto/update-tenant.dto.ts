import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { TaxRegime } from '@flux/shared';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(TaxRegime)
  taxRegime?: TaxRegime;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStart?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
