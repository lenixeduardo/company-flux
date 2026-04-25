import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SupplierCategory } from './create-supplier.dto.js';

export class FilterSuppliersDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(SupplierCategory) category?: SupplierCategory;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
}
