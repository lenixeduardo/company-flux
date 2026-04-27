'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Search, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
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
import { SupplierForm } from '@/components/forms/SupplierForm';
import { suppliersApi } from '@/lib/api-client';
import { formatCNPJ, formatDate } from '@/lib/utils';

const SUPPLIER_CATEGORIES: Record<string, string> = {
  SERVICES: 'Serviços',
  PRODUCTS: 'Produtos',
  UTILITIES: 'Utilidades',
  RENT: 'Aluguel',
  PAYROLL: 'Folha de Pagamento',
  TAXES: 'Impostos',
  MAINTENANCE: 'Manutenção',
  MARKETING: 'Marketing',
  TECHNOLOGY: 'Tecnologia',
  LOGISTICS: 'Logística',
  OTHER: 'Outros',
};

const STATUS_VARIANTS: Record<string, 'success' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  BLOCKED: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  BLOCKED: 'Bloqueado',
};

interface Supplier {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  category: string;
  status: string;
  email?: string;
  phone?: string;
  paymentTermDays?: number;
  notes?: string;
  lastPaymentDate?: string;
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const PAGE_SIZE = 20;

  const filters = {
    search: search || undefined,
    category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
    page: pageIndex + 1,
    limit: PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () => suppliersApi.list(filters),
  });

  const suppliers: Supplier[] = data?.data ?? data ?? [];
  const pageCount = data?.pageCount ?? data?.meta?.pageCount ?? undefined;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }) => {
        const s = row.original;
        const showTrade = s.tradeName && s.tradeName !== s.name;
        return (
          <div>
            <p className="font-medium text-sm">{s.name}</p>
            {showTrade && <p className="text-xs text-muted-foreground">{s.tradeName}</p>}
          </div>
        );
      },
    },
    {
      accessorKey: 'cnpj',
      header: 'CNPJ / CPF',
      cell: ({ row }) => {
        const cnpj = row.original.cnpj;
        if (!cnpj) return <span className="text-muted-foreground text-sm">—</span>;
        const digits = cnpj.replace(/\D/g, '');
        return (
          <span className="tabular-nums text-sm">
            {digits.length === 14 ? formatCNPJ(cnpj) : cnpj}
          </span>
        );
      },
    },
    {
      accessorKey: 'category',
      header: 'Categoria',
      cell: ({ row }) => (
        <Badge variant="secondary">
          {SUPPLIER_CATEGORIES[row.original.category] ?? row.original.category}
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
      accessorKey: 'lastPaymentDate',
      header: 'Último Pagamento',
      cell: ({ row }) => {
        const date = row.original.lastPaymentDate;
        return (
          <span className="text-sm text-muted-foreground">
            {date ? formatDate(date) : '—'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-2" />
                Ver histórico
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setEditingSupplier(supplier);
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
                  if (confirm('Excluir este fornecedor?')) deleteMutation.mutate(supplier.id);
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
        <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
        <Button
          onClick={() => {
            setEditingSupplier(null);
            setIsDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as categorias</SelectItem>
            {Object.entries(SUPPLIER_CATEGORIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        data={suppliers}
        columns={columns}
        isLoading={isLoading}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        onPageChange={setPageIndex}
        emptyMessage="Nenhum fornecedor cadastrado."
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </DialogTitle>
          </DialogHeader>
          <SupplierForm
            defaultValues={editingSupplier ?? undefined}
            onSuccess={() => {
              setIsDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
