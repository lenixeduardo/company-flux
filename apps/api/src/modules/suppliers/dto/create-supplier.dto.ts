import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUrl, Matches, Min } from 'class-validator';

export enum SupplierCategory {
  TECHNOLOGY = 'TECHNOLOGY',
  SERVICES = 'SERVICES',
  MATERIALS = 'MATERIALS',
  UTILITIES = 'UTILITIES',
  RENT = 'RENT',
  LOGISTICS = 'LOGISTICS',
  MARKETING = 'MARKETING',
  LEGAL = 'LEGAL',
  ACCOUNTING = 'ACCOUNTING',
  OTHER = 'OTHER',
}

export class CreateSupplierDto {
  @IsString() name: string;
  @IsOptional() @IsString() tradeName?: string;

  @IsOptional()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/)
  cnpj?: string;

  @IsOptional()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/)
  cpf?: string;

  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsEnum(SupplierCategory) category?: SupplierCategory;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() @Min(0) paymentTermDays?: number;
  @IsOptional() @IsString({ each: true }) tags?: string[];
}
