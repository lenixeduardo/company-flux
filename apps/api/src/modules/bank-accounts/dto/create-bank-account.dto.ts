import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBankAccountDto {
  @IsString()
  name: string;

  @IsOptional() @IsString() bankCode?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() agency?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() accountType?: string; // CHECKING, SAVINGS, INVESTMENT

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  initialBalance?: number;

  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
