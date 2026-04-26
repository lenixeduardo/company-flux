'use client';
import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Crown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api-client';

const billingApi = {
  getPlans: () => api.get('/billing/plans').then(r => r.data),
  getSubscription: () => api.get('/billing/subscription').then(r => r.data),
  createCheckout: (planType: string) => api.post('/billing/checkout', { planType }).then(r => r.data),
  createPortal: () => api.post('/billing/portal').then(r => r.data),
  cancel: () => api.post('/billing/cancel').then(r => r.data),
};

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'outline' }> = {
  ACTIVE:   { label: 'Ativo',      variant: 'success' },
  PAST_DUE: { label: 'Pagamento atrasado', variant: 'destructive' },
  CANCELLED:{ label: 'Cancelado',  variant: 'secondary' },
  TRIALING: { label: 'Trial',      variant: 'default' },
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { tenant } = useAuthStore();
  const currentPlan = tenant?.planType ?? 'FREE';

  useEffect(() => {
    if (searchParams.get('success') === 'true') toast.success('Assinatura ativada com sucesso! 🎉');
    if (searchParams.get('cancelled') === 'true') toast.info('Checkout cancelado.');
  }, [searchParams]);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: billingApi.getPlans,
  });

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: billingApi.getSubscription,
  });

  const checkoutMutation = useMutation({
    mutationFn: (planType: string) => billingApi.createCheckout(planType),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao iniciar checkout'),
  });

  const portalMutation = useMutation({
    mutationFn: billingApi.createPortal,
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
  });

  const sub = subData?.subscription;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assinatura</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu plano e forma de pagamento</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano atual</CardTitle>
        </CardHeader>
        <CardContent>
          {subLoading ? <Skeleton className="h-20" /> : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 text-indigo-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-sm font-semibold', PLAN_COLORS[currentPlan])}>{currentPlan}</Badge>
                    {sub && <Badge variant={STATUS_LABELS[sub.status]?.variant ?? 'secondary'}>{STATUS_LABELS[sub.status]?.label ?? sub.status}</Badge>}
                    {sub?.cancelAtPeriodEnd && <Badge variant="outline">Cancela em {formatDate(sub.currentPeriodEnd)}</Badge>}
                  </div>
                  {sub?.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {sub.cancelAtPeriodEnd ? 'Ativo até' : 'Renova em'}: {formatDate(sub.currentPeriodEnd)}
                    </p>
                  )}
                </div>
              </div>
              {currentPlan !== 'FREE' && (
                <Button variant="outline" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
                  {portalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerenciar Assinatura'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Planos disponíveis</h2>
        {plansLoading ? (
          <div className="grid grid-cols-3 gap-4">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-80" />)}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(plans ?? []).map((plan: any) => {
              const isCurrent = plan.type === currentPlan;
              const isHighlighted = plan.highlighted;
              return (
                <Card key={plan.type} className={cn('relative', isHighlighted && 'border-indigo-500 border-2 shadow-lg')}>
                  {isHighlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-indigo-600 text-white text-xs px-3">Mais popular</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-2">
                      {plan.price === 0 ? (
                        <span className="text-3xl font-bold">Grátis</span>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <span className="text-3xl font-bold">{plan.price}</span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-4 pb-6 space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((f: string) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn('w-full', isHighlighted && !isCurrent && 'bg-indigo-600 hover:bg-indigo-700')}
                      variant={isCurrent ? 'outline' : 'default'}
                      disabled={isCurrent || checkoutMutation.isPending}
                      onClick={() => !isCurrent && plan.price > 0 && checkoutMutation.mutate(plan.type)}
                    >
                      {checkoutMutation.isPending && checkoutMutation.variables === plan.type
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : isCurrent ? 'Plano Atual' : plan.price === 0 ? 'Plano Gratuito' : `Assinar ${plan.name}`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
