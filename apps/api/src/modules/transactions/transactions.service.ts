import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { FilterTransactionsDto } from './dto/filter-transactions.dto.js';
import Decimal from 'decimal.js';
import { PLAN_LIMITS } from '@flux/shared';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filter: FilterTransactionsDto) {
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.TransactionWhereInput = {
      tenantId,
      deletedAt: null,
      ...(filter.type && { type: filter.type }),
      ...(filter.status && { status: filter.status }),
      ...(filter.categoryId && { categoryId: filter.categoryId }),
      ...(filter.bankAccountId && { bankAccountId: filter.bankAccountId }),
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.search && {
        description: { contains: filter.search, mode: 'insensitive' as Prisma.QueryMode },
      }),
      ...((filter.dateFrom || filter.dateTo) && {
        dueDate: {
          ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
          ...(filter.dateTo && { lte: new Date(filter.dateTo) }),
        },
      }),
    };

    const allowedSortFields: Record<string, boolean> = {
      dueDate: true,
      competenceDate: true,
      amount: true,
      description: true,
      createdAt: true,
    };
    const sortField = filter.sortBy && allowedSortFields[filter.sortBy] ? filter.sortBy : 'dueDate';
    const sortOrder = filter.sortOrder ?? 'desc';

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, type: true } },
          bankAccount: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: perPage,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: true,
        bankAccount: true,
        supplier: true,
        invoice: { select: { id: true, nfeNumber: true, totalValue: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);
    return transaction;
  }

  // Alias kept for internal usage and backward compatibility
  async findById(tenantId: string, id: string) {
    return this.findOne(tenantId, id);
  }

  async create(tenantId: string, userId: string, dto: CreateTransactionDto) {
    // Enforce plan limits
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const limits = PLAN_LIMITS[tenant.planType as keyof typeof PLAN_LIMITS];
    if (limits) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthCount = await this.prisma.transaction.count({
        where: { tenantId, createdAt: { gte: startOfMonth }, deletedAt: null },
      });
      if (monthCount >= limits.maxTransactionsPerMonth) {
        throw new ForbiddenException(
          `Monthly transaction limit reached (${limits.maxTransactionsPerMonth}). Upgrade your plan.`,
        );
      }
    }

    const status = dto.status ?? 'PENDING';
    const amount = new Decimal(dto.amount).toDecimalPlaces(2).toNumber();

    const transaction = await this.prisma.transaction.create({
      data: {
        tenantId,
        createdById: userId,
        type: dto.type,
        description: dto.description,
        amount,
        dueDate: new Date(dto.dueDate),
        competenceDate: new Date(dto.competenceDate),
        categoryId: dto.categoryId ?? null,
        bankAccountId: dto.bankAccountId ?? null,
        supplierId: dto.supplierId ?? null,
        notes: dto.notes ?? null,
        tags: dto.tags ?? [],
        status,
        ...(status === 'CONFIRMED' && { paidAt: new Date() }),
      },
      include: {
        category: { select: { id: true, name: true, color: true, type: true } },
        bankAccount: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (dto.bankAccountId && status === 'CONFIRMED') {
      await this.adjustBankBalance(dto.bankAccountId, dto.type, amount);
    }

    return transaction;
  }

  async update(tenantId: string, id: string, dto: UpdateTransactionDto) {
    const existing = await this.findOne(tenantId, id);

    const wasConfirmed = existing.status === 'CONFIRMED' || existing.status === 'RECONCILED';
    const newStatus = dto.status ?? existing.status;
    const willBeConfirmed = newStatus === 'CONFIRMED' || newStatus === 'RECONCILED';

    // Reverse the previous balance contribution before applying new values
    if (wasConfirmed && existing.bankAccountId) {
      await this.reverseBalance(existing.bankAccountId, existing.type, Number(existing.amount));
    }

    const amount = dto.amount !== undefined
      ? new Decimal(dto.amount).toDecimalPlaces(2).toNumber()
      : undefined;

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(amount !== undefined && { amount }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.competenceDate !== undefined && { competenceDate: new Date(dto.competenceDate) }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.bankAccountId !== undefined && { bankAccountId: dto.bankAccountId }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.paidAt !== undefined && { paidAt: new Date(dto.paidAt) }),
        // Set paidAt automatically when transitioning to CONFIRMED for the first time
        ...(dto.status === 'CONFIRMED' && !existing.paidAt && !dto.paidAt && { paidAt: new Date() }),
      },
      include: {
        category: { select: { id: true, name: true, color: true, type: true } },
        bankAccount: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    // Apply new balance effect with the updated values
    const finalBankAccountId = dto.bankAccountId ?? existing.bankAccountId;
    const finalType = dto.type ?? existing.type;
    const finalAmount = amount ?? Number(existing.amount);

    if (willBeConfirmed && finalBankAccountId) {
      await this.adjustBankBalance(finalBankAccountId, finalType, finalAmount);
    }

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.findOne(tenantId, id);

    // Reverse balance if the transaction was affecting the bank account
    if ((existing.status === 'CONFIRMED' || existing.status === 'RECONCILED') && existing.bankAccountId) {
      await this.reverseBalance(existing.bankAccountId, existing.type, Number(existing.amount));
    }

    return this.prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async confirm(tenantId: string, id: string) {
    const existing = await this.findOne(tenantId, id);

    if (existing.status === 'CONFIRMED' || existing.status === 'RECONCILED') {
      throw new BadRequestException('Transaction is already confirmed');
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot confirm a cancelled transaction');
    }

    const confirmed = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        paidAt: existing.paidAt ?? new Date(),
      },
      include: {
        category: { select: { id: true, name: true, color: true, type: true } },
        bankAccount: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (existing.bankAccountId) {
      await this.adjustBankBalance(existing.bankAccountId, existing.type, Number(existing.amount));
    }

    return confirmed;
  }

  async getSummary(tenantId: string, dateFrom?: string, dateTo?: string) {
    const now = new Date();
    const start = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = dateTo ? new Date(dateTo) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const duration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - duration);
    const prevEnd = new Date(start.getTime() - 1);

    const [income, expense, prevIncome, prevExpense, count] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'INCOME', status: { in: ['CONFIRMED', 'RECONCILED'] }, paidAt: { gte: start, lte: end }, deletedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'EXPENSE', status: { in: ['CONFIRMED', 'RECONCILED'] }, paidAt: { gte: start, lte: end }, deletedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'INCOME', status: { in: ['CONFIRMED', 'RECONCILED'] }, paidAt: { gte: prevStart, lte: prevEnd }, deletedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'EXPENSE', status: { in: ['CONFIRMED', 'RECONCILED'] }, paidAt: { gte: prevStart, lte: prevEnd }, deletedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({
        where: { tenantId, dueDate: { gte: start, lte: end }, deletedAt: null },
      }),
    ]);

    const totalIncome = Number(income._sum.amount ?? 0);
    const totalExpense = Number(expense._sum.amount ?? 0);
    const prevTotalIncome = Number(prevIncome._sum.amount ?? 0);
    const prevTotalExpense = Number(prevExpense._sum.amount ?? 0);

    const incomeChange = prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : null;
    const expenseChange = prevTotalExpense > 0 ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : null;

    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactionCount: count,
      previousPeriod: {
        totalIncome: prevTotalIncome,
        totalExpense: prevTotalExpense,
        balance: prevTotalIncome - prevTotalExpense,
      },
      changes: {
        incomeChangePercent: incomeChange,
        expenseChangePercent: expenseChange,
      },
    };
  }

  async getCashFlowProjection(tenantId: string, days = 90) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + days);

    const bankBalance = await this.prisma.bankAccount.aggregate({
      where: { tenantId, isActive: true, deletedAt: null },
      _sum: { currentBalance: true },
    });

    const pending = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        dueDate: { gte: today, lte: future },
        deletedAt: null,
      },
      orderBy: { dueDate: 'asc' },
      include: {
        category: { select: { name: true, color: true } },
      },
    });

    const dayMap = new Map<string, { income: number; expense: number; transactions: typeof pending }>();

    for (const t of pending) {
      const key = t.dueDate.toISOString().split('T')[0];
      if (!dayMap.has(key)) {
        dayMap.set(key, { income: 0, expense: 0, transactions: [] });
      }
      const entry = dayMap.get(key)!;
      entry.transactions.push(t);
      if (t.type === 'INCOME') entry.income += Number(t.amount);
      else if (t.type === 'EXPENSE') entry.expense += Number(t.amount);
    }

    let runningBalance = Number(bankBalance._sum.currentBalance ?? 0);
    const projection: Array<{
      date: string;
      income: number;
      expense: number;
      net: number;
      runningBalance: number;
      transactions: typeof pending;
    }> = [];

    for (let d = 0; d <= days; d++) {
      const cur = new Date(today);
      cur.setDate(cur.getDate() + d);
      const key = cur.toISOString().split('T')[0];
      const entry = dayMap.get(key);
      const income = entry?.income ?? 0;
      const expense = entry?.expense ?? 0;
      runningBalance += income - expense;
      projection.push({
        date: key,
        income,
        expense,
        net: income - expense,
        runningBalance,
        transactions: entry?.transactions ?? [],
      });
    }

    return {
      startingBalance: Number(bankBalance._sum.currentBalance ?? 0),
      endingBalance: runningBalance,
      days,
      projection,
    };
  }

  private async adjustBankBalance(bankAccountId: string, type: string, amount: number) {
    const delta = type === 'INCOME' ? amount : type === 'EXPENSE' ? -amount : 0;
    if (delta !== 0) {
      await this.prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { increment: delta } },
      });
    }
  }

  private async reverseBalance(bankAccountId: string, type: string, amount: number) {
    const delta = type === 'INCOME' ? -amount : type === 'EXPENSE' ? amount : 0;
    if (delta !== 0) {
      await this.prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { increment: delta } },
      });
    }
  }
}
