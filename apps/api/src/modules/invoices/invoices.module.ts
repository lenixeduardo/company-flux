import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InvoicesService } from './invoices.service.js';
import { InvoicesController } from './invoices.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    BullModule.registerQueue({ name: 'nf-processing' }),
  ],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
