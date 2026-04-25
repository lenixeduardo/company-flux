'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Building2, CreditCard, Tag, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { tenantsApi } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';

const STEPS = [
  { icon: Building2, label: 'Empresa criada', description: 'Sua conta está pronta', done: true },
  { icon: CreditCard, label: 'Conta bancária', description: 'Adicione sua conta para controle de saldo' },
  { icon: Tag, label: 'Categorias', description: 'Personalize as categorias de gastos' },
  { icon: ArrowRight, label: 'Primeiro lançamento', description: 'Registre sua primeira transação' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, tenant, updateTenant } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const goToDashboard = async () => {
    setLoading(true);
    try {
      const updated = await tenantsApi.progressOnboarding(4);
      updateTenant({ onboardingDone: true, onboardingStep: 4, status: 'ACTIVE' });
      toast.success('Bem-vindo ao Flux Financeiro!');
      router.push('/dashboard');
    } catch {
      toast.error('Erro ao avançar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl mb-3">F</div>
          <h1 className="text-2xl font-bold text-gray-900">Bem-vindo, {user?.firstName}!</h1>
          <p className="text-gray-500 mt-1">Sua empresa <strong>{tenant?.companyName}</strong> foi criada com sucesso.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">Configure sua conta</h2>
          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <div key={i} className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${i === 0 ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${i === 0 ? 'bg-green-100' : 'bg-indigo-100'}`}>
                  {i === 0 ? <Check className="h-5 w-5 text-green-600" /> : <step.icon className="h-5 w-5 text-indigo-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${i === 0 ? 'text-green-800' : 'text-gray-900'}`}>{step.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                </div>
                {i === 0 && <span className="text-xs text-green-600 font-medium">Concluído</span>}
              </div>
            ))}
          </div>

          <div className="pt-2 space-y-3">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={goToDashboard} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</> : <>Ir para o Dashboard <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            <p className="text-xs text-center text-gray-400">Você pode configurar o restante depois no painel</p>
          </div>
        </div>
      </div>
    </div>
  );
}
