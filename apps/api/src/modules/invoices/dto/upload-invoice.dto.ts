import { IsOptional, IsUUID } from 'class-validator';

export class UploadInvoiceDto {
  @IsOptional() @IsUUID() supplierId?: string;
}
