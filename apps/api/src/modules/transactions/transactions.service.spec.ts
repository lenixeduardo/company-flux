import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock @flux/shared so tests don't depend on real module resolution
// ---------------------------------------------------------------------------
jest.mock('@flux/shared', () => ({
  PLAN_LIMITS: {
    FREE: {
      maxTransactionsPerMonth: 100,
      maxUsersPerTenant: 2,
      maxBankAccounts: 1,
    },
    STARTER: {
      maxTransactionsPerMonth: 1000,
      maxUsersPerTenant: 5,
      maxBankAccounts: 3,
    },
    PROFESSIONAL: {
      maxTransactionsPerMonth: Infinity,
    },
    ENTERPRISE: {
      maxTransactionsPerMonth: Infinity,
    },
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tenantId = 'tenant-uuid-1';
const userId = 'user-uuid-1';

const baseTenant = {
  id: tenantId,
  planType: 'FREE',
  status: 'ACTIVE',
};

const baseTransaction = {
  id: 'tx-uuid-1',
  tenantId,
  createdById: userId,
  type: 'INCOME',
  description: 'Test income',
  amount: 100.0,
  dueDate: new Date('2025-01-15'),
  competenceDate: new Date('2025-01-15'),
  status: 'PENDING',
  paidAt: null,
  categoryId: null,
  bankAccountId: null,
  supplierId: null,
  notes: null,
  tags: [],
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: null,
  bankAccount: null,
  supplier: null,
};

const createDto = {
  type: 'INCOME' as const,
  description: 'Test income',
  amount: 100.5,
  dueDate: '2025-01-15',
  competenceDate: '2025-01-15',
};

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const prismaMock = {
  tenant: {
    findUnique: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  bankAccount: {
    update: jest.fn(),
    aggregate: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  // -------------------------------------------------------------------------
  // create() — plan limit enforcement
  // -------------------------------------------------------------------------

  describe('create() — plan limit enforcement', () => {
    it('throws ForbiddenException when monthly count >= FREE plan limit (100)', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'FREE' });
      prismaMock.transaction.count.mockResolvedValue(100); // at limit

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with upgrade message at limit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'FREE' });
      prismaMock.transaction.count.mockResolvedValue(100);

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        'Monthly transaction limit reached (100). Upgrade your plan.',
      );
    });

    it('throws ForbiddenException when count exceeds limit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'FREE' });
      prismaMock.transaction.count.mockResolvedValue(150);

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(ForbiddenException);
    });

    it('does NOT throw when count is below FREE plan limit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'FREE' });
      prismaMock.transaction.count.mockResolvedValue(99); // below limit
      prismaMock.transaction.create.mockResolvedValue(baseTransaction);

      await expect(service.create(tenantId, userId, createDto)).resolves.toBeDefined();
    });

    it('does NOT throw for PROFESSIONAL plan with Infinity limit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'PROFESSIONAL' });
      prismaMock.transaction.count.mockResolvedValue(999999);
      prismaMock.transaction.create.mockResolvedValue(baseTransaction);

      await expect(service.create(tenantId, userId, createDto)).resolves.toBeDefined();
    });

    it('does NOT throw for ENTERPRISE plan with Infinity limit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'ENTERPRISE' });
      prismaMock.transaction.count.mockResolvedValue(999999);
      prismaMock.transaction.create.mockResolvedValue(baseTransaction);

      await expect(service.create(tenantId, userId, createDto)).resolves.toBeDefined();
    });

    it('throws NotFoundException when tenant not found', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(NotFoundException);
    });

    it('checks transaction count within current calendar month', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'FREE' });
      prismaMock.transaction.count.mockResolvedValue(50);
      prismaMock.transaction.create.mockResolvedValue(baseTransaction);

      await service.create(tenantId, userId, createDto);

      const countCall = prismaMock.transaction.count.mock.calls[0][0] as {
        where: { tenantId: string; createdAt: { gte: Date }; deletedAt: null };
      };
      expect(countCall.where.tenantId).toBe(tenantId);
      expect(countCall.where.deletedAt).toBeNull();
      expect(countCall.where.createdAt.gte).toBeInstanceOf(Date);
      // The gte date should be start of current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      expect(countCall.where.createdAt.gte.getMonth()).toBe(startOfMonth.getMonth());
      expect(countCall.where.createdAt.gte.getFullYear()).toBe(startOfMonth.getFullYear());
    });
  });

  // -------------------------------------------------------------------------
  // create() — Decimal precision
  // -------------------------------------------------------------------------

  describe('create() — Decimal precision', () => {
    beforeEach(() => {
      prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, planType: 'FREE' });
      prismaMock.transaction.count.mockResolvedValue(0);
    });

    it('stores amount rounded to 2 decimal places', async () => {
      prismaMock.transaction.create.mockResolvedValue({ ...baseTransaction, amount: 100.5 });

      await service.create(tenantId, userId, { ...createDto, amount: 100.5 });

      const createCall = prismaMock.transaction.create.mock.calls[0][0] as {
        data: { amount: number };
      };
      // 100.5 should remain 100.5 (2 decimal places already)
      expect(createCall.data.amount).toBe(100.5);
    });

    it('rounds amount to 2 decimal places for floating-point inputs', async () => {
      prismaMock.transaction.create.mockResolvedValue({ ...baseTransaction, amount: 100.56 });

      // 100.555 rounds to 100.56 at 2 decimal places
      await service.create(tenantId, userId, { ...createDto, amount: 100.555 });

      const createCall = prismaMock.transaction.create.mock.calls[0][0] as {
        data: { amount: number };
      };
      // Decimal.js toDecimalPlaces(2) uses ROUND_HALF_UP
      expect(typeof createCall.data.amount).toBe('number');
      expect(createCall.data.amount.toString()).toMatch(/^\d+\.\d{1,2}$/);
    });

    it('stores integer amounts unchanged', async () => {
      prismaMock.transaction.create.mockResolvedValue({ ...baseTransaction, amount: 500 });

      await service.create(tenantId, userId, { ...createDto, amount: 500 });

      const createCall = prismaMock.transaction.create.mock.calls[0][0] as {
        data: { amount: number };
      };
      expect(createCall.data.amount).toBe(500);
    });

    it('defaults status to PENDING when not provided', async () => {
      prismaMock.transaction.create.mockResolvedValue(baseTransaction);

      await service.create(tenantId, userId, createDto);

      const createCall = prismaMock.transaction.create.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(createCall.data.status).toBe('PENDING');
    });

    it('uses provided status when given', async () => {
      prismaMock.transaction.create.mockResolvedValue({
        ...baseTransaction,
        status: 'CONFIRMED',
      });

      await service.create(tenantId, userId, { ...createDto, status: 'CONFIRMED' });

      const createCall = prismaMock.transaction.create.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(createCall.data.status).toBe('CONFIRMED');
    });
  });

  // -------------------------------------------------------------------------
  // findAll() — pagination and filtering
  // -------------------------------------------------------------------------

  describe('findAll() — pagination and filtering', () => {
    const filter = {};

    beforeEach(() => {
      prismaMock.transaction.findMany.mockResolvedValue([baseTransaction]);
      prismaMock.transaction.count.mockResolvedValue(1);
    });

    it('returns data array and meta object', async () => {
      const result = await service.findAll(tenantId, filter);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('data contains the transactions', async () => {
      const result = await service.findAll(tenantId, filter);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(baseTransaction);
    });

    it('meta contains total, page, perPage, totalPages', async () => {
      const result = await service.findAll(tenantId, filter);

      expect(result.meta).toMatchObject({
        total: 1,
        page: 1,
        perPage: 20,
        totalPages: 1,
      });
    });

    it('filters by tenantId automatically', async () => {
      await service.findAll(tenantId, filter);

      const findManyCall = prismaMock.transaction.findMany.mock.calls[0][0] as {
        where: { tenantId: string };
      };
      expect(findManyCall.where.tenantId).toBe(tenantId);
    });

    it('excludes soft-deleted transactions', async () => {
      await service.findAll(tenantId, filter);

      const findManyCall = prismaMock.transaction.findMany.mock.calls[0][0] as {
        where: { deletedAt: null };
      };
      expect(findManyCall.where.deletedAt).toBeNull();
    });

    it('applies custom page and perPage from filter', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.count.mockResolvedValue(0);

      await service.findAll(tenantId, { page: 3, perPage: 5 });

      const findManyCall = prismaMock.transaction.findMany.mock.calls[0][0] as {
        skip: number;
        take: number;
      };
      expect(findManyCall.skip).toBe(10); // (3-1) * 5
      expect(findManyCall.take).toBe(5);
    });

    it('calculates totalPages correctly', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.count.mockResolvedValue(55);

      const result = await service.findAll(tenantId, { perPage: 20 });

      expect(result.meta.totalPages).toBe(3); // Math.ceil(55 / 20)
    });

    it('filters by type when provided', async () => {
      await service.findAll(tenantId, { type: 'INCOME' as any });

      const findManyCall = prismaMock.transaction.findMany.mock.calls[0][0] as {
        where: { type: string };
      };
      expect(findManyCall.where.type).toBe('INCOME');
    });

    it('applies dateFrom filter as gte on dueDate', async () => {
      await service.findAll(tenantId, { dateFrom: '2025-01-01' });

      const findManyCall = prismaMock.transaction.findMany.mock.calls[0][0] as {
        where: { dueDate: { gte: Date } };
      };
      expect(findManyCall.where.dueDate?.gte).toBeInstanceOf(Date);
    });

    it('calls count with same where clause as findMany', async () => {
      await service.findAll(tenantId, { type: 'EXPENSE' as any });

      const countCall = prismaMock.transaction.count.mock.calls[0][0] as {
        where: { tenantId: string; type: string };
      };
      expect(countCall.where.tenantId).toBe(tenantId);
      expect(countCall.where.type).toBe('EXPENSE');
    });
  });
});
