import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto.js';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: FilterSuppliersDto) {
    const { page = 1, perPage = 20, search, category, status } = filters;
    const where: any = { tenantId, deletedAt: null };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { cnpj: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    if (category) where.category = category;
    if (status) where.status = status;

    const [total, data] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(tenantId: string, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    const cnpjClean = dto.cnpj?.replace(/\D/g, '') ?? undefined;
    return this.prisma.supplier.create({
      data: { ...dto, tenantId, cnpj: cnpjClean },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(tenantId, id);
    const cnpjClean = dto.cnpj?.replace(/\D/g, '') ?? undefined;
    return this.prisma.supplier.update({ where: { id }, data: { ...dto, cnpj: cnpjClean } });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getPaymentHistory(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.transaction.findMany({
      where: { tenantId, supplierId: id, deletedAt: null },
      orderBy: { dueDate: 'desc' },
      take: 50,
      include: { category: { select: { name: true, color: true } } },
    });
  }

  async findByCnpj(tenantId: string, cnpj: string) {
    const clean = cnpj.replace(/\D/g, '');
    return this.prisma.supplier.findFirst({ where: { tenantId, cnpj: clean, deletedAt: null } });
  }
}
