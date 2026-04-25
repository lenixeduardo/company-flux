export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: UserRole;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export interface TenantSummary {
  id: string;
  name: string;
  cnpj?: string | null;
  logoUrl?: string | null;
  planType: string;
  isActive: boolean;
}

export interface AuthResponse {
  user: UserProfile;
  tenant: TenantSummary;
  accessToken: string;
  refreshToken: string;
}

export interface PlanUsage {
  transactionsThisMonth: number;
  bankAccountsCount: number;
  suppliersCount: number;
  invoicesThisMonth: number;
  usersCount: number;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
  color: string;
  icon?: string | null;
  parentId?: string | null;
  isSystem: boolean;
}

export interface BankAccount {
  id: string;
  tenantId: string;
  name: string;
  bankName?: string | null;
  accountType: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH';
  balance: number;
  currency: string;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
}

export interface Invoice {
  id: string;
  tenantId: string;
  supplierId?: string | null;
  number: string;
  issueDate: string;
  totalAmount: number;
  status: InvoiceStatus;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  CANCELLED = 'CANCELLED',
}

export interface TaxObligation {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  competenceMonth: number;
  competenceYear: number;
  dueDate: string;
  estimatedAmount?: number | null;
  status: TaxObligationStatus;
}

export enum TaxObligationStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export interface DashboardSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  netResult: number;
  incomeChange: number;
  expenseChange: number;
  balanceChange: number;
}

export interface CashFlowDataPoint {
  month: string;
  income: number;
  expense: number;
}

export interface Insight {
  id: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'TIP';
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export interface TransactionFilters {
  page?: number;
  perPage?: number;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status?: 'PENDING' | 'CONFIRMED' | 'RECONCILED' | 'CANCELLED';
  categoryId?: string;
  bankAccountId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
