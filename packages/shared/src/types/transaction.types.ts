export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  RECONCILED = 'RECONCILED',
  CANCELLED = 'CANCELLED',
}

export interface Transaction {
  id: string;
  tenantId: string;
  bankAccountId?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  invoiceId?: string | null;
  recurringTemplateId?: string | null;
  createdById: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  description: string;
  notes?: string | null;
  dueDate: Date;
  paidAt?: Date | null;
  competenceDate: Date;
  tags: string[];
  attachmentUrl?: string | null;
  externalRef?: string | null;
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface CreateTransactionDto {
  type: TransactionType;
  amount: number;
  description: string;
  categoryId?: string;
  bankAccountId?: string;
  dueDate: string;
  notes?: string;
  tags?: string[];
  supplierId?: string;
  competenceDate?: string;
  attachmentUrl?: string;
  externalRef?: string;
  isRecurring?: boolean;
  recurringTemplateId?: string;
}
