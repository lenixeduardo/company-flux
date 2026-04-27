'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({ email: z.string().email('Email inválido') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await authApi.forgotPassword(data.email);
      setSent(true);
    } catch {
      toast.error('Erro ao enviar email. Tente novamente.');
    }
  };

  if (sent) {
    return (
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
              <Mail className="h-7 w-7 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Verifique seu email</h2>
          <p className="text-sm text-gray-500">Se este email estiver cadastrado, você receberá um link para redefinir sua senha em breve.</p>
          <Link href="/login" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 font-medium">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para o login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-semibold text-center">Esqueci minha senha</CardTitle>
        <CardDescription className="text-center">Digite seu email para receber um link de redefinição</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="seu@email.com.br" {...register('email')} className={errors.email ? 'border-red-500' : ''} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : 'Enviar link'}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para o login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
