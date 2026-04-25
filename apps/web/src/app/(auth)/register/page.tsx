'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { maskCNPJ } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const step1Schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').regex(/[A-Z]/, 'Precisa de uma maiúscula').regex(/[0-9]/, 'Precisa de um número'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Senhas não conferem', path: ['confirmPassword'] });

const step2Schema = z.object({
  firstName: z.string().min(2, 'Nome muito curto'),
  lastName: z.string().min(2, 'Sobrenome muito curto'),
});

const step3Schema = z.object({
  companyName: z.string().min(2, 'Nome da empresa obrigatório'),
  cnpj: z.string().min(18, 'CNPJ inválido'),
  taxRegime: z.string().optional(),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

const STEPS = ['Acesso', 'Seus dados', 'Empresa'];
const TAX_REGIMES = [
  { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL', label: 'Lucro Real' },
  { value: 'MEI', label: 'MEI' },
];

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<Partial<Step1 & Step2 & Step3>>({});

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema) });
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema) });

  const handleStep1 = (data: Step1) => { setFormData((p) => ({ ...p, ...data })); setStep(1); };
  const handleStep2 = (data: Step2) => { setFormData((p) => ({ ...p, ...data })); setStep(2); };

  const handleStep3 = async (data: Step3) => {
    const merged = { ...formData, ...data };
    try {
      const res = await authApi.register({
        email: merged.email,
        password: merged.password,
        firstName: merged.firstName,
        lastName: merged.lastName,
        companyName: merged.companyName,
        cnpj: merged.cnpj?.replace(/\D/g, ''),
        taxRegime: merged.taxRegime || undefined,
      });
      setAuth(res);
      toast.success('Empresa criada com sucesso!');
      router.push('/onboarding');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao criar conta');
    }
  };

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${i < step ? 'bg-indigo-600 text-white' : i === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-200 text-gray-500'}`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 mx-1 ${i < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <CardTitle className="text-xl font-semibold text-center">
          {['Criar sua conta', 'Sobre você', 'Sua empresa'][step]}
        </CardTitle>
        <CardDescription className="text-center">Passo {step + 1} de {STEPS.length}</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 0 && (
          <form onSubmit={form1.handleSubmit(handleStep1)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com.br" {...form1.register('email')} />
              {form1.formState.errors.email && <p className="text-xs text-red-500">{form1.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" {...form1.register('password')} className="pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form1.formState.errors.password && <p className="text-xs text-red-500">{form1.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" type="password" placeholder="••••••••" {...form1.register('confirmPassword')} />
              {form1.formState.errors.confirmPassword && <p className="text-xs text-red-500">{form1.formState.errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">Continuar <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </form>
        )}
        {step === 1 && (
          <form onSubmit={form2.handleSubmit(handleStep2)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="João" {...form2.register('firstName')} />
              {form2.formState.errors.firstName && <p className="text-xs text-red-500">{form2.formState.errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Sobrenome</Label>
              <Input placeholder="Silva" {...form2.register('lastName')} />
              {form2.formState.errors.lastName && <p className="text-xs text-red-500">{form2.formState.errors.lastName.message}</p>}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(0)}><ChevronLeft className="mr-2 h-4 w-4" />Voltar</Button>
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Continuar <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={form3.handleSubmit(handleStep3)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input placeholder="Acme Ltda" {...form3.register('companyName')} />
              {form3.formState.errors.companyName && <p className="text-xs text-red-500">{form3.formState.errors.companyName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input placeholder="00.000.000/0000-00" {...form3.register('cnpj')} onChange={(e) => form3.setValue('cnpj', maskCNPJ(e.target.value), { shouldValidate: true })} />
              {form3.formState.errors.cnpj && <p className="text-xs text-red-500">{form3.formState.errors.cnpj.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Regime tributário (opcional)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form3.register('taxRegime')}>
                <option value="">Não sei ainda</option>
                {TAX_REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" />Voltar</Button>
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700" disabled={form3.formState.isSubmitting}>
                {form3.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : 'Criar conta'}
              </Button>
            </div>
          </form>
        )}
        <div className="mt-6 text-center text-sm text-gray-500">
          Já tem conta?{' '}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">Entrar</Link>
        </div>
      </CardContent>
    </Card>
  );
}
