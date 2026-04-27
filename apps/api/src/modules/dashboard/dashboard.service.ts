import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import Decimal from 'decimal.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [income, expense, bankAccounts] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'INCOME', deletedAt: null, dueDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'EXPENSE', deletedAt: null, dueDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.bankAccount.aggregate({
        where: { tenantId, isActive: true, deletedAt: null },
        _sum: { currentBalance: true },
      }),
    ]);

    const totalIncome = new Decimal(income._sum.amount?.toString() ?? '0');
    const totalExpense = new Decimal(expense._sum.amount?.toString() ?? '0');
    const netResult = totalIncome.minus(totalExpense);
    const totalBalance = new Decimal(bankAccounts._sum.currentBalance?.toString() ?? '0');

    return {
      period: { year, month },
      totalBalance: totalBalance.toNumber(),
      totalIncome: totalIncome.toNumber(),
      totalExpense: totalExpense.toNumber(),
      netResult: netResult.toNumber(),
      transactionCount: income._count + expense._count,
    };
  }

  async getMonthlyComparison(tenantId: string, months = 6) {
    const results: Array<{
      year: number;
      month: number;
      label: string;
      income: number;
      expense: number;
      net: number;
    }> = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const [incomeAgg, expenseAgg] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: { tenantId, type: 'INCOME', deletedAt: null, dueDate: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { tenantId, type: 'EXPENSE', deletedAt: null, dueDate: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
        }),
      ]);

      const incomeVal = Number(incomeAgg._sum.amount ?? 0);
      const expenseVal = Number(expenseAgg._sum.amount ?? 0);

      results.push({
        year,
        month,
        label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(d),
        income: incomeVal,
        expense: expenseVal,
        net: incomeVal - expenseVal,
      });
    }

    return results;
  }

  async getCategoryBreakdown(tenantId: string, type: 'INCOME' | 'EXPENSE', year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { tenantId, type, deletedAt: null, dueDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    const categoryIds = rows.map((r) => r.categoryId).filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true, icon: true },
    });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const total = rows.reduce((sum, r) => sum + Number(r._sum.amount ?? 0), 0);

    return rows.map((r) => ({
      category: r.categoryId ? (catMap[r.categoryId] ?? { name: 'Sem categoria', color: '#94a3b8' }) : { name: 'Sem categoria', color: '#94a3b8' },
      total: Number(r._sum.amount ?? 0),
      count: r._count,
      percentage: total > 0 ? Math.round((Number(r._sum.amount ?? 0) / total) * 100) : 0,
    }));
  }

  async getUpcomingTransactions(tenantId: string, days = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + days);

    return this.prisma.transaction.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING'] },
        deletedAt: null,
        dueDate: { gte: today, lte: future },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      include: {
        category: { select: { name: true, color: true, icon: true } },
        bankAccount: { select: { id: true, name: true } },
      },
    });
  }

  async getBurnRate(tenantId: string) {
    const now = new Date();
    const monthlyExpenses: number[] = [];

    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(d.getFullYear(), d.getMonth(), 1);
      const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const agg = await this.prisma.transaction.aggregate({
        where: { tenantId, type: 'EXPENSE', deletedAt: null, dueDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      });
      monthlyExpenses.push(Number(agg._sum.amount ?? 0));
    }

    const avgBurnRate = monthlyExpenses.reduce((a, b) => a + b, 0) / monthlyExpenses.length;

    const bankBalance = await this.prisma.bankAccount.aggregate({
      where: { tenantId, isActive: true, deletedAt: null },
      _sum: { currentBalance: true },
    });
    const totalBalance = Number(bankBalance._sum.currentBalance ?? 0);
    const runwayMonths = avgBurnRate > 0 ? Math.floor(totalBalance / avgBurnRate) : null;

    return {
      avgBurnRate,
      totalBalance,
      runwayMonths,
      monthlyBurnRates: monthlyExpenses,
    };
  }
}
