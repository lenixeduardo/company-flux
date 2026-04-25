'use client';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/KpiCard';
import { dashboardApi } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getCurrentDateLabel(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.getSummary(),
  });

  const { data: monthlyComparison, isLoading: loadingMonthly } = useQuery({
    queryKey: ['dashboard-monthly-comparison'],
    queryFn: () => dashboardApi.getMonthlyComparison(6),
  });

  const { data: upcoming, isLoading: loadingUpcoming } = useQuery({
    queryKey: ['dashboard-upcoming'],
    queryFn: () => dashboardApi.getUpcoming(7),
  });

  const netResult = (summary?.totalIncome ?? 0) - (summary?.totalExpense ?? 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}, {user?.firstName ?? 'usuário'}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{getCurrentDateLabel()}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Saldo Total"
          value={formatCurrency(summary?.totalBalance ?? 0)}
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-100"
          isLoading={loadingSummary}
          change={summary?.totalBalanceChange}
        />
        <KpiCard
          title="Receitas"
          value={formatCurrency(summary?.totalIncome ?? 0)}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-100"
          valueColor="text-green-600"
          isLoading={loadingSummary}
          change={summary?.totalIncomeChange}
        />
        <KpiCard
          title="Despesas"
          value={formatCurrency(summary?.totalExpense ?? 0)}
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-100"
          valueColor="text-red-500"
          isLoading={loadingSummary}
          change={summary?.totalExpenseChange}
        />
        <KpiCard
          title="Resultado"
          value={formatCurrency(netResult)}
          icon={
            <Activity
              className={`h-5 w-5 ${netResult >= 0 ? 'text-green-600' : 'text-red-500'}`}
            />
          }
          iconBg={netResult >= 0 ? 'bg-green-100' : 'bg-red-100'}
          valueColor={netResult >= 0 ? 'text-green-600' : 'text-red-500'}
          isLoading={loadingSummary}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Fluxo de Caixa — Últimos 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMonthly ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={monthlyComparison ?? []}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat('pt-BR', {
                        notation: 'compact',
                        style: 'currency',
                        currency: 'BRL',
                      }).format(v)
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Receitas"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#colorIncome)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#22c55e' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Despesas"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#colorExpense)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#ef4444' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Próximos Vencimentos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingUpcoming ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !upcoming || upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                <Calendar className="h-8 w-8 opacity-40" />
                <p className="text-sm">Nenhum vencimento nos próximos 7 dias</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 7).map((tx: any) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 py-1.5 border-b last:border-0"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ background: tx.category?.color ?? '#9ca3af' }}
                    />
                    <span className="flex-1 text-sm truncate">{tx.description}</span>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          tx.type === 'EXPENSE' ? 'text-red-500' : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.dueDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
