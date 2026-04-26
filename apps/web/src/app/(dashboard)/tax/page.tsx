'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/shared/DataTable';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api-client';
import type { ColumnDef } from '@tanstack/react-table';

// inline api calls
const taxApi = {
  calculate: (data: { month: number; year: number }) => api.post('/tax/calculate', data).then(r => r.data),
  listObligations: (params?: any) => api.get('/tax/obligations', { params }).then(r => r.data),
  markAsPaid: (id: string) => api.post(`/tax/obligations/${id}/pay`).then(r => r.data),
  getAlerts: () => api.get('/tax/alerts').then(r => r.data),
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'; icon: React.ReactNode }> = {
  PENDING:   { label: 'Pendente',  variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  PAID:      { label: 'Pago',      variant: 'success',   icon: <CheckCircle2 className="h-3 w-3" /> },
  OVERDUE:   { label: 'Atrasado',  variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelado', variant: 'outline',   icon: null },
};

const TAX_REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
};

export default function TaxPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: obligations, isLoading } = useQuery({
    queryKey: ['tax-obligations', year],
    queryFn: () => taxApi.listObligations({ year }),
  });

  const { data: alerts } = useQuery({
    queryKey: ['tax-alerts'],
    queryFn: taxApi.getAlerts,
  });

  const calcMutation = useMutation({
    mutationFn: () => taxApi.calculate({ month, year }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tax-obligations'] });
      toast.success(`${data.obligations?.length ?? 0} obrigação(ões) calculada(s) para ${month}/${year}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao calcular impostos'),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => taxApi.markAsPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-obligations'] });
      toast.success('Obrigação marcada como paga');
    },
  });

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'taxName',
      header: 'Tributo',
      cell: ({ row }) => <span className="font-semibold">{row.original.taxName}</span>,
    },
    {
      accessorKey: 'regime',
      header: 'Regime',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{TAX_REGIME_LABELS[row.original.regime] ?? row.original.regime}</span>,
    },
    {
      header: 'Referência',
      cell: ({ row }) => <span>{String(row.original.referenceMonth).padStart(2, '0')}/{row.original.referenceYear}</span>,
    },
    {
      accessorKey: 'baseAmount',
      header: 'Base de Cálculo',
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.baseAmount)}</span>,
    },
    {
      accessorKey: 'rate',
      header: 'Alíquota',
      cell: ({ row }) => <span className="tabular-nums">{Number(row.original.rate).toFixed(2)}%</span>,
    },
    {
      accessorKey: 'totalAmount',
      header: 'Valor',
      cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.totalAmount)}</span>,
    },
    {
      accessorKey: 'dueDate',
      header: 'Vencimento',
      cell: ({ row }) => {
        const due = new Date(row.original.dueDate);
        const overdue = due < new Date() && row.original.status === 'PENDING';
        return <span className={overdue ? 'text-red-600 font-medium' : ''}>{formatDate(due)}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const cfg = STATUS_CONFIG[row.original.status] ?? STATUS_CONFIG.PENDING;
        return (
          <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
            {cfg.icon}{cfg.label}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) =>
        row.original.status === 'PENDING' ? (
          <Button size="sm" variant="outline" onClick={() => payMutation.mutate(row.original.id)} disabled={payMutation.isPending}>
            Marcar Pago
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-1">Obrigações tributárias e cálculos automáticos</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={e => setMonth(+e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>
                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2024, i, 1))}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={() => calcMutation.mutate()} disabled={calcMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
            {calcMutation.isPending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Calculando...</> : <><Calculator className="mr-2 h-4 w-4" />Calcular Impostos</>}
          </Button>
        </div>
      </div>

      {/* Alert banner */}
      {alerts && alerts.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Obrigações vencendo em breve</p>
            <p className="text-sm text-amber-700 mt-0.5">
              {alerts.length} obrigação(ões) com vencimento nos próximos 10 dias:{' '}
              {alerts.map((a: any) => a.taxName).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            {['PENDING', 'PAID', 'OVERDUE'].map(status => {
              const items = (obligations ?? []).filter((o: any) => o.status === status);
              const total = items.reduce((s: number, o: any) => s + Number(o.totalAmount), 0);
              const cfg = STATUS_CONFIG[status];
              return (
                <Card key={status}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      <span className="text-sm text-muted-foreground">{items.length} obrigação(ões)</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums">{formatCurrency(total)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Obrigações Fiscais — {year}</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={obligations ?? []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="Nenhuma obrigação fiscal. Clique em 'Calcular Impostos' para gerar."
          />
        </CardContent>
      </Card>
    </div>
  );
}
