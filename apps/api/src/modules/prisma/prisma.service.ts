import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { TenantContext } from '../../common/types/tenant-context.js';

export const tenantContext = new AsyncLocalStorage<TenantContext>();

const TENANT_SCOPED_MODELS = new Set([
  'Transaction',
  'Category',
  'Supplier',
  'Invoice',
  'TaxObligation',
  'BankAccount',
  'Notification',
  'AuditLog',
  'AutomationRule',
  'RecurringTemplate',
  'AiInsight',
]);

const READ_ACTIONS = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow', 'groupBy']);
const CREATE_ACTIONS = new Set(['create', 'createMany', 'upsert']);
const WRITE_ACTIONS = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get<string>('DATABASE_URL'),
        },
      },
    });

    // Register middleware that auto-injects tenantId on every query
    this.$use(async (params, next) => {
      const tenantId = tenantContext.getStore()?.tenantId;

      if (tenantId && params.model && TENANT_SCOPED_MODELS.has(params.model)) {
        if (READ_ACTIONS.has(params.action)) {
          params.args = params.args ?? {};
          params.args.where = { ...((params.args.where as Record<string, unknown>) ?? {}), tenantId };
        } else if (CREATE_ACTIONS.has(params.action)) {
          if (params.action === 'upsert') {
            params.args = params.args ?? {};
            params.args.where = { ...((params.args.where as Record<string, unknown>) ?? {}), tenantId };
            params.args.create = { ...((params.args.create as Record<string, unknown>) ?? {}), tenantId };
            params.args.update = params.args.update ?? {};
          } else if (params.action === 'createMany') {
            params.args = params.args ?? {};
            if (Array.isArray((params.args as { data?: unknown }).data)) {
              (params.args as { data: Record<string, unknown>[] }).data = (
                params.args as { data: Record<string, unknown>[] }
              ).data.map((item) => ({ ...item, tenantId }));
            }
          } else {
            params.args = params.args ?? {};
            params.args.data = { ...((params.args.data as Record<string, unknown>) ?? {}), tenantId };
          }
        } else if (WRITE_ACTIONS.has(params.action)) {
          params.args = params.args ?? {};
          params.args.where = { ...((params.args.where as Record<string, unknown>) ?? {}), tenantId };
        }
      }

      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
