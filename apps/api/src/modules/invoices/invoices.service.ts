import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3Service } from '../storage/s3.service.js';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    @InjectQueue('nf-processing') private nfQueue: Queue,
  ) {}

  async upload(tenantId: string, file: Express.Multer.File, supplierId?: string) {
    const isXml =
      file.mimetype.includes('xml') || file.originalname.toLowerCase().endsWith('.xml');
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');

    if (!isXml && !isPdf) {
      throw new BadRequestException('Only XML and PDF files are accepted');
    }

    // Check for duplicate by file hash + tenantId
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.invoice.findFirst({ where: { fileHash, tenantId } });
    if (existing) throw new BadRequestException('This file has already been uploaded');

    // Upload to S3
    const { key, bucket } = await this.s3.upload(file, tenantId);

    // Create invoice record
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        supplierId: supplierId ?? null,
        fileType: isXml ? 'XML' : 'PDF',
        originalFileName: file.originalname,
        s3Key: key,
        s3Bucket: bucket,
        fileHash,
        status: 'PENDING_PROCESSING',
      },
    });

    // Queue processing job
    await this.nfQueue.add(
      'process',
      { invoiceId: invoice.id, tenantId, isXml },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return invoice;
  }

  async findAll(tenantId: string, page = 1, perPage = 20) {
    const [total, data] = await Promise.all([
      this.prisma.invoice.count({ where: { tenantId } }),
      this.prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { supplier: { select: { id: true, name: true } } },
      }),
    ]);
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(tenantId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async getDownloadUrl(tenantId: string, id: string) {
    const inv = await this.findOne(tenantId, id);
    const url = await this.s3.getPresignedUrl(inv.s3Key);
    return { url, expiresIn: 3600 };
  }

  async remove(tenantId: string, id: string) {
    const inv = await this.findOne(tenantId, id);
    try {
      await this.s3.delete(inv.s3Key);
    } catch (_) {
      // Ignore S3 deletion errors — the record is still archived
    }
    return this.prisma.invoice.update({ where: { id }, data: { status: 'REJECTED' as any } });
  }

  async processXmlInvoice(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    try {
      const updateData: Record<string, unknown> = {
        status: 'PROCESSED',
        processedAt: new Date(),
      };

      // Try to match supplier by CNPJ if parsed
      if (invoice.issuerCnpj && !invoice.supplierId) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { tenantId, cnpj: invoice.issuerCnpj, deletedAt: null },
        });
        if (supplier) {
          updateData['supplierId'] = supplier.id;
          updateData['status'] = 'MATCHED';
        }
      }

      await this.prisma.invoice.update({ where: { id: invoiceId }, data: updateData });

      // Auto-create expense transaction if supplier matched and totalValue known
      const resolvedSupplierId = (updateData['supplierId'] as string | undefined) ?? invoice.supplierId;
      const resolvedTotalValue = invoice.totalValue;
      if (resolvedSupplierId && resolvedTotalValue) {
        const ownerUserTenant = await this.prisma.userTenant.findFirst({
          where: { tenantId, role: 'OWNER' },
        });
        await this.prisma.transaction.create({
          data: {
            tenantId,
            createdById: ownerUserTenant?.userId ?? tenantId,
            type: 'EXPENSE',
            amount: resolvedTotalValue,
            description: `NF-e ${invoice.nfeNumber ?? invoice.originalFileName} — ${invoice.issuerName ?? 'Fornecedor'}`,
            dueDate: invoice.issuedAt ?? new Date(),
            competenceDate: invoice.issuedAt ?? new Date(),
            status: 'PENDING',
            supplierId: resolvedSupplierId,
            invoiceId: invoice.id,
          },
        });
      }
    } catch (error) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'ERROR', processingError: String(error) },
      });
    }
  }
}
