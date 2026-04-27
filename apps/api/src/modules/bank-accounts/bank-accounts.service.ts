import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBankAccountDto } from './dto/create-bank-account.dto.js';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto.js';

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.bankAccount.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!account) throw new NotFoundException(`Bank account ${id} not found`);
    return account;
  }

  async create(tenantId: string, dto: CreateBankAccountDto) {
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { tenantId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return this.prisma.bankAccount.create({
      data: {
        tenantId,
        name: dto.name,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        agency: dto.agency,
        accountNumber: dto.accountNumber,
        accountType: dto.accountType,
        initialBalance: dto.initialBalance ?? 0,
        currentBalance: dto.initialBalance ?? 0,
        currency: dto.currency ?? 'BRL',
        isDefault: dto.isDefault ?? false,
        isActive: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateBankAccountDto) {
    await this.findOne(tenantId, id);

    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { tenantId, isDefault: true, id: { not: id }, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.bankCode !== undefined && { bankCode: dto.bankCode }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.agency !== undefined && { agency: dto.agency }),
        ...(dto.accountNumber !== undefined && { accountNumber: dto.accountNumber }),
        ...(dto.accountType !== undefined && { accountType: dto.accountType }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const activeTransactionCount = await this.prisma.transaction.count({
      where: { tenantId, bankAccountId: id, deletedAt: null },
    });
    if (activeTransactionCount > 0) {
      throw new BadRequestException(
        `Cannot delete bank account with ${activeTransactionCount} active transaction(s). Reassign or delete them first.`,
      );
    }

    return this.prisma.bankAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getSummary(tenantId: string) {
    const result = await this.prisma.bankAccount.aggregate({
      where: { tenantId, isActive: true, deletedAt: null },
      _sum: { currentBalance: true },
    });
    return { totalBalance: Number(result._sum.currentBalance ?? 0) };
  }
}
