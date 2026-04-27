import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { PLAN_LIMITS } from '@flux/shared';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: { subscription: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }

  async progressOnboarding(tenantId: string, step: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const nextStep = Math.max(tenant.onboardingStep, step);
    const done = nextStep >= 4;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingStep: nextStep,
        onboardingDone: done,
        status: done ? 'ACTIVE' : 'ONBOARDING',
      },
    });
  }

  async getUsage(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const planType = tenant.planType as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[planType];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [userCount, transactionCount, bankAccountCount, invoiceCount] = await Promise.all([
      this.prisma.userTenant.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.transaction.count({
        where: { tenantId, createdAt: { gte: startOfMonth }, deletedAt: null },
      }),
      this.prisma.bankAccount.count({ where: { tenantId, isActive: true, deletedAt: null } }),
      this.prisma.invoice.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
    ]);

    return {
      planType,
      limits,
      usage: { userCount, transactionCount, bankAccountCount, invoiceCount },
    };
  }
}
