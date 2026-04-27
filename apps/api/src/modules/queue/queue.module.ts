import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NfProcessingProcessor } from './processors/nf-processing.processor.js';
import { InvoicesModule } from '../invoices/invoices.module.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'nf-processing' }),
    InvoicesModule,
  ],
  providers: [NfProcessingProcessor],
})
export class QueueModule {}
