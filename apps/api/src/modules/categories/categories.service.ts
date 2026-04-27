import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
        isActive: true,
        parentId: null,
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        isActive: true,
        OR: [{ tenantId }, { isSystem: true }],
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: {
          id: dto.parentId,
          OR: [{ tenantId: null }, { tenantId }],
          isActive: true,
        },
      });
      if (!parent) throw new NotFoundException(`Parent category ${dto.parentId} not found`);
    }

    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        color: dto.color,
        icon: dto.icon,
        parentId: dto.parentId,
        isActive: true,
        isSystem: false,
      },
    });
  }

  async update(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId, isActive: true },
    });

    if (!category) {
      const systemCat = await this.prisma.category.findFirst({ where: { id: categoryId, isSystem: true } });
      if (systemCat) throw new ForbiddenException('System categories cannot be modified');
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });
  }

  async remove(tenantId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId, isActive: true },
    });

    if (!category) {
      const systemCat = await this.prisma.category.findFirst({ where: { id: categoryId, isSystem: true } });
      if (systemCat) throw new ForbiddenException('System categories cannot be deleted');
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { tenantId, categoryId, deletedAt: null },
    });
    if (transactionCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${transactionCount} active transaction(s). Reassign them first.`,
      );
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: { isActive: false },
    });
  }

  async seedDefaults(): Promise<void> {
    const systemCategories: Array<{ name: string; type: string; color: string; icon: string }> = [
      // INCOME
      { name: 'Vendas de Produtos', type: 'INCOME', color: '#22c55e', icon: 'ShoppingCart' },
      { name: 'Prestação de Serviços', type: 'INCOME', color: '#16a34a', icon: 'Briefcase' },
      { name: 'Juros e Rendimentos', type: 'INCOME', color: '#4ade80', icon: 'TrendingUp' },
      { name: 'Outros Recebimentos', type: 'INCOME', color: '#86efac', icon: 'Plus' },
      // EXPENSE
      { name: 'Fornecedores', type: 'EXPENSE', color: '#ef4444', icon: 'Truck' },
      { name: 'Folha de Pagamento', type: 'EXPENSE', color: '#dc2626', icon: 'Users' },
      { name: 'Aluguel', type: 'EXPENSE', color: '#f97316', icon: 'Home' },
      { name: 'Utilities (Água/Luz/Internet)', type: 'EXPENSE', color: '#fb923c', icon: 'Zap' },
      { name: 'Marketing e Publicidade', type: 'EXPENSE', color: '#a855f7', icon: 'Megaphone' },
      { name: 'Impostos e Tributos', type: 'EXPENSE', color: '#7c3aed', icon: 'FileText' },
      { name: 'Equipamentos e TI', type: 'EXPENSE', color: '#3b82f6', icon: 'Monitor' },
      { name: 'Viagens e Hospedagem', type: 'EXPENSE', color: '#0ea5e9', icon: 'Plane' },
      { name: 'Alimentação', type: 'EXPENSE', color: '#f59e0b', icon: 'Coffee' },
      { name: 'Manutenção', type: 'EXPENSE', color: '#84cc16', icon: 'Wrench' },
      { name: 'Outros', type: 'EXPENSE', color: '#94a3b8', icon: 'MoreHorizontal' },
    ];

    for (const cat of systemCategories) {
      const existing = await this.prisma.category.findFirst({
        where: { name: cat.name, type: cat.type, isSystem: true },
      });

      if (!existing) {
        await this.prisma.category.create({
          data: {
            tenantId: null,
            name: cat.name,
            type: cat.type,
            color: cat.color,
            icon: cat.icon,
            isSystem: true,
            isActive: true,
          },
        });
      }
    }
  }
}
