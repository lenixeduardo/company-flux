import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InvoicesService } from '../../invoices/invoices.service.js';

interface NfProcessingJobData {
  invoiceId: string;
  tenantId: string;
  isXml: boolean;
}

@Processor('nf-processing')
export class NfProcessingProcessor {
  private readonly logger = new Logger(NfProcessingProcessor.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  @Process('process')
  async handleProcess(job: Job<NfProcessingJobData>): Promise<void> {
    const { invoiceId, tenantId } = job.data;
    this.logger.log(`Processing invoice ${invoiceId} for tenant ${tenantId}`);

    try {
      await this.invoicesService.processXmlInvoice(invoiceId, tenantId);
      this.logger.log(`Successfully processed invoice ${invoiceId}`);
    } catch (error) {
      this.logger.error(`Failed to process invoice ${invoiceId}`, error);
      throw error; // BullMQ will retry according to job options
    }
  }
}
