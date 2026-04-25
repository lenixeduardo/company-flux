'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, MoreHorizontal, Download, Trash2, FileText, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { InvoiceUploadForm } from '@/components/forms/InvoiceUploadForm';
import { invoicesApi } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Invoice {
  id: string;
  originalFileName: string;
  fileType?: string;
  issuerName?: string;
  nfeNumber?: string;
  totalValue?: number;
  status: string;
  createdAt: string;
  supplier?: { name: string; tradeName?: string };
}

type InvoiceStatus =
  | 'PENDING_PROCESSING'
  | 'PROCESSED'
  | 'MATCHED'
  | 'ERROR'
  | 'ARCHIVED';

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'outline' }
> = {
  PENDING_PROCESSING: { label: 'Processando...', variant: 'secondary' },
  PROCESSED: { label: 'Processado', variant: 'default' },
  MATCHED: { label: 'Vinculado', variant: 'success' },
  ERROR: { label: 'Erro', variant: 'destructive' },
  ARCHIVED: { label: 'Arquivado', variant: 'outline' },
};

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page: pageIndex + 1, limit: PAGE_SIZE }],
    queryFn: () => invoicesApi.list({ page: pageIndex + 1, limit: PAGE_SIZE }),
  });

  const invoices: Invoice[] = data?.data ?? data ?? [];
  const pageCount = data?.pageCount ?? data?.meta?.pageCount ?? undefined;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const handleDownload = async (invoice: Invoice) => {
    try {
      const result = await invoicesApi.getDownloadUrl(invoice.id);
      const url = result?.url ?? result;
      if (url) window.open(url, '_blank');
    } catch (_) {}
  };

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: 'originalFileName',
      header: 'Arquivo',
      cell: ({ row }) => {
        const inv = row.original;
        const isXml =
          inv.fileType === 'XML' ||
          inv.originalFileName?.toLowerCase().endsWith('.xml');
        return (
          <div className="flex items-center gap-2">
            {isXml ? (
              <FileCode className="h-5 w-5 text-blue-500 flex-shrink-0" />
            ) : (
              <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <span className="text-sm truncate max-w-[180px]" title={inv.originalFileName}>
              {inv.originalFileName}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'issuerName',
      header: 'Fornecedor',
      cell: ({ row }) => {
        const inv = row.original;
        const name =
          inv.issuerName ??
          inv.supplier?.tradeName ??
          inv.supplier?.name;
        return (
          <span className="text-sm">
            {name ?? <span className="text-muted-foreground">—</span>}
          </span>
        );
      },
    },
    {
      accessorKey: 'nfeNumber',
      header: 'NF Número',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.nfeNumber ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      accessorKey: 'totalValue',
      header: 'Valor',
      cell: ({ row }) => {
        const val = row.original.totalValue;
        return (
          <span className="text-sm tabular-nums font-medium">
            {val != null ? (
              formatCurrency(val)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status as InvoiceStatus;
        const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' as const };
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Data',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDownload(inv)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-700"
                onClick={() => {
                  if (confirm('Excluir esta nota fiscal?')) deleteMutation.mutate(inv.id);
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
        <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Importar NF-e
        </Button>
      </div>

      {/* Table */}
      <DataTable
        data={invoices}
        columns={columns}
        isLoading={isLoading}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        onPageChange={setPageIndex}
        emptyMessage="Nenhuma nota fiscal importada."
      />

      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar NF-e</DialogTitle>
          </DialogHeader>
          <InvoiceUploadForm
            onSuccess={() => {
              setIsDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
