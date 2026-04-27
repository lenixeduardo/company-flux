import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalculateTaxDto, UpdateTaxSettingsDto } from './dto/calculate-tax.dto.js';
import { calculateSimplesDAS, type SimplesAnexo } from './calculators/simples-nacional.calculator.js';
import { calculateLucroPresumido, type AtividadeLP } from './calculators/lucro-presumido.calculator.js';

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Scheduled: run on 1st of every month at 8am ─────────────────────────
  @Cron('0 8 1 * *')
  async runMonthlyTaxCalculation(): Promise<void> {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE', taxRegime: { not: null } },
    });

    for (const tenant of tenants) {
      try {
        await this.calculate(tenant.id, { month: prevMonth, year: prevYear });
      } catch (_) {
        // continue with next tenant
      }
    }
  }

  async calculate(tenantId: string, dto: CalculateTaxDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.taxRegime) throw new NotFoundException('Tax regime not configured');

    const { month, year } = dto;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get monthly revenue (INCOME transactions, CONFIRMED)
    const incomeAgg = await this.prisma.transaction.aggregate({
      where: {
        tenantId,
        type: 'INCOME',
        status: 'CONFIRMED',
        deletedAt: null,
        competenceDate: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });
    const receitaMensal = Number(incomeAgg._sum.amount ?? 0);

    // Get last 12 months revenue for Simples Nacional bracket calculation
    const rbt12Start = new Date(year, month - 13, 1);
    const rbt12Agg = await this.prisma.transaction.aggregate({
      where: {
        tenantId,
        type: 'INCOME',
        status: 'CONFIRMED',
        deletedAt: null,
        competenceDate: { gte: rbt12Start, lte: endDate },
      },
      _sum: { amount: true },
    });
    const rbt12 = Number(rbt12Agg._sum.amount ?? 0);

    const obligations: Array<{
      taxName: string;
      taxCode: string;
      rate: number;
      baseAmount: number;
      calculatedAmount: number;
      dueDate: Date;
    }> = [];

    const dueDate = new Date(year, month, 20); // DAS due on 20th of following month

    if (tenant.taxRegime === 'SIMPLES_NACIONAL' || tenant.taxRegime === 'MEI') {
      const result = calculateSimplesDAS(receitaMensal, rbt12, 'I' as SimplesAnexo);
      obligations.push({
        taxName: tenant.taxRegime === 'MEI' ? 'DAS-MEI' : 'DAS',
        taxCode: 'DAS',
        rate: result.aliquotaEfetiva,
        baseAmount: receitaMensal,
        calculatedAmount: result.valorDAS,
        dueDate,
      });
    } else if (tenant.taxRegime === 'LUCRO_PRESUMIDO') {
      const result = calculateLucroPresumido(receitaMensal, 'SERVICOS' as AtividadeLP);
      const taxes = [
        { name: 'IRPJ', code: 'IRPJ', amount: result.irpj + result.irpjAdicional, rate: 15, due: new Date(year, month, 30) },
        { name: 'CSLL', code: 'CSLL', amount: result.csll, rate: 9, due: new Date(year, month, 30) },
        { name: 'PIS', code: 'PIS', amount: result.pis, rate: 0.65, due: new Date(year, month, 24) },
        { name: 'COFINS', code: 'COFINS', amount: result.cofins, rate: 3, due: new Date(year, month, 24) },
      ];
      for (const t of taxes) {
        obligations.push({
          taxName: t.name,
          taxCode: t.code,
          rate: t.rate,
          baseAmount: receitaMensal,
          calculatedAmount: t.amount,
          dueDate: t.due,
        });
      }
    }

    // Upsert obligations (avoid duplicates for same month/year/taxCode)
    const created = [];
    for (const ob of obligations) {
      const existing = await this.prisma.taxObligation.findFirst({
        where: { tenantId, taxCode: ob.taxCode, referenceMonth: month, referenceYear: year },
      });
      if (existing) {
        const updated = await this.prisma.taxObligation.update({
          where: { id: existing.id },
          data: {
            calculatedAmount: ob.calculatedAmount,
            totalAmount: ob.calculatedAmount,
            rate: ob.rate,
            baseAmount: ob.baseAmount,
          },
        });
        created.push(updated);
      } else {
        const newOb = await this.prisma.taxObligation.create({
          data: {
            tenantId,
            regime: tenant.taxRegime as any,
            taxName: ob.taxName,
            taxCode: ob.taxCode,
            referenceMonth: month,
            referenceYear: year,
            baseAmount: ob.baseAmount,
            rate: ob.rate,
            calculatedAmount: ob.calculatedAmount,
            totalAmount: ob.calculatedAmount,
            dueDate: ob.dueDate,
            status: 'PENDING',
          },
        });
        created.push(newOb);
      }
    }

    return { month, year, receitaMensal, rbt12, obligations: created };
  }

  async findObligations(
    tenantId: string,
    filters: { status?: string; year?: number; month?: number },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.year) where.referenceYear = filters.year;
    if (filters.month) where.referenceMonth = filters.month;

    return this.prisma.taxObligation.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { referenceYear: 'desc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const ob = await this.prisma.taxObligation.findFirst({ where: { id, tenantId } });
    if (!ob) throw new NotFoundException('Tax obligation not found');
    return ob;
  }

  async markAsPaid(tenantId: string, id: string, transactionId?: string) {
    await this.findOne(tenantId, id);
    return this.prisma.taxObligation.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        transactionId: transactionId ?? null,
      },
    });
  }

  async getCalendar(tenantId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const obligations = await this.prisma.taxObligation.findMany({
      where: { tenantId, dueDate: { gte: startDate, lte: endDate } },
      orderBy: { dueDate: 'asc' },
    });

    // Group by month
    const calendar: Record<number, typeof obligations> = {};
    for (let m = 1; m <= 12; m++) calendar[m] = [];
    for (const ob of obligations) {
      const m = ob.dueDate.getMonth() + 1;
      calendar[m].push(ob);
    }
    return calendar;
  }

  async getUpcomingAlerts(tenantId: string) {
    const today = new Date();
    const in10Days = new Date();
    in10Days.setDate(today.getDate() + 10);

    return this.prisma.taxObligation.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        dueDate: { gte: today, lte: in10Days },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async updateSettings(tenantId: string, dto: UpdateTaxSettingsDto) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { taxRegime: dto.taxRegime as any ?? undefined },
    });
  }
}
