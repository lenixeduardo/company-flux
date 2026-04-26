import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CalculateTaxDto {
  @IsInt() @Min(1) @Max(12)
  month: number;

  @IsInt() @Min(2020)
  year: number;
}

export class UpdateTaxSettingsDto {
  @IsOptional() @IsEnum(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI'])
  taxRegime?: string;

  @IsOptional() @IsString()
  anexoSimples?: string; // 'I' | 'III'

  @IsOptional() @IsString()
  atividadeLucroPresumido?: string; // 'COMERCIO' | 'SERVICOS' | 'MISTO'
}
