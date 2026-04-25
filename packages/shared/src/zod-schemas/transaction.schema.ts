import { z } from 'zod';
import { TransactionStatus, TransactionType } from '../types/transaction.types.js';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z
  .string()
  .regex(ISO_DATE_REGEX, 'Date must be in YYYY-MM-DD format')
  .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' });

export const createTransactionSchema = z.object({
  type: z.nativeEnum(TransactionType, { required_error: 'Transaction type is required' }),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than zero')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  description: z
    .string({ required_error: 'Description is required' })
    .min(1, 'Description is required')
    .max(500, 'Description must be at most 500 characters'),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  bankAccountId: z.string().uuid('Invalid bank account ID').optional(),
  dueDate: dateString,
  competenceDate: dateString.optional(),
  notes: z.string().max(2000, 'Notes must be at most 2000 characters').optional(),
  tags: z.array(z.string().max(50)).max(20, 'Maximum 20 tags allowed').default([]),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  attachmentUrl: z.string().url('Invalid attachment URL').optional(),
  externalRef: z.string().max(200).optional(),
  isRecurring: z.boolean().default(false),
  recurringTemplateId: z.string().uuid('Invalid recurring template ID').optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionFilterSchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  categoryId: z.string().uuid().optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  page: z.coerce
    .number()
    .int()
    .positive()
    .default(1),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(100, 'Cannot request more than 100 records per page')
    .default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(200).optional(),
  bankAccountId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  amountMin: z.coerce.number().positive().optional(),
  amountMax: z.coerce.number().positive().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
