'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Search, MoreHorizontal, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/DataTable';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { transactionsApi } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANTS: Record<string, 'secondary' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'success',
  CANCELLED: 'destructive',
};

interface Transaction {
  id: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  dueDate: string;
  status: string;
  category?: { name: string; color?: string };
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pageIndex, setPageIndex] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const PAGE_SIZE = 20;

  const filters = {
    search: search || undefined,
    type: typeFilter !== 'ALL' ? typeFilter : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    month,
    year,
    page: pageIndex + 1,
    limit: PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionsApi.list(filters),
  });

  const transactions: Transaction[] = data?.data ?? data ?? [];
  const pageCount = data?.pageCount ?? data?.meta?.pageCount ?? data?.totalPages ?? undefined;
  const totalCount = data?.total ?? data?.meta?.total ?? undefined;

  const confirmMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.confirm(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME' && t.status !== 'CANCELLED')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE' && t.status !== 'CANCELLED')
    .reduce((s, t) => s + t.amount, 0);
  const result = totalIncome - totalExpense;

  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: 'dueDate',
      header: 'Data',
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{formatDate(row.original.dueDate)}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Descrição',
      cell: ({ row }) => (
        <span className="font-medium text-sm max-w-48 block truncate">
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Categoria',
      enableSorting: false,
      cell: ({ row }) => {
        const cat = row.original.category;
        if (!cat) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: cat.color ?? '#9ca3af' }}
            />
            <span className="text-sm">{cat.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge variant={row.original.type === 'INCOME' ? 'success' : 'destructive'}>
          {row.original.type === 'INCOME' ? 'Receita' : 'Despesa'}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'}>
            {STATUS_LABELS[status] ?? status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'amount',
      header: 'Valor',
      cell: ({ row }) => (
        <span
          className={`tabular-nums font-semibold text-sm ${
            row.original.type === 'INCOME' ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {row.original.type === 'EXPENSE' ? '− ' : '+ '}
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {tx.status === 'PENDING' && (
                <>
                  <DropdownMenuItem
                    onClick={() => confirmMutation.mutate(tx.id)}
                    className="text-green-600 focus:text-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => {
                  setEditingTransaction(tx);
                  setIsDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-700"
                onClick={() => {
                  if (confirm('Excluir esta transação?')) deleteMutation.mutate(tx.id);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
        <Button
          onClick={() => {
            setEditingTransaction(null);
            setIsDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Transação
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar descrição..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="INCOME">Receita</SelectItem>
            <SelectItem value="EXPENSE">Despesa</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={`${year}-${month}`}
          onValueChange={(v) => {
            const [y, m] = v.split('-').map(Number);
            setYear(y);
            setMonth(m);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              return (
                <SelectItem key={`${y}-${m}`} value={`${y}-${m}`}>
                  {MONTH_NAMES[m - 1]} / {y}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="CONFIRMED">Confirmado</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          <span className="text-xs font-medium text-green-700">Receitas:</span>
          <span className="text-xs font-bold text-green-700 tabular-nums">
            {formatCurrency(totalIncome)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1">
          <span className="text-xs font-medium text-red-600">Despesas:</span>
          <span className="text-xs font-bold text-red-600 tabular-nums">
            {formatCurrency(totalExpense)}
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 border rounded-full px-3 py-1 ${
            result >= 0
              ? 'bg-blue-50 border-blue-200'
              : 'bg-orange-50 border-orange-200'
          }`}
        >
          <span
            className={`text-xs font-medium ${result >= 0 ? 'text-blue-700' : 'text-orange-700'}`}
          >
            Resultado:
          </span>
          <span
            className={`text-xs font-bold tabular-nums ${
              result >= 0 ? 'text-blue-700' : 'text-orange-700'
            }`}
          >
            {formatCurrency(result)}
          </span>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={transactions}
        columns={columns}
        isLoading={isLoading}
        totalCount={totalCount}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        onPageChange={setPageIndex}
        emptyMessage="Nenhuma transação encontrada para este período."
        showColumnToggle
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
            </DialogTitle>
          </DialogHeader>
          <TransactionForm
            onSuccess={() => {
              setIsDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
