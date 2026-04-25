'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { invitesApi } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const schema = z.object({
  firstName: z.string().min(2, 'Nome muito curto'),
  lastName: z.string().min(2, 'Sobrenome muito curto'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
type FormData = z.infer<typeof schema>;

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário', ADMIN: 'Administrador', FINANCEIRO: 'Financeiro', LEITURA: 'Visualizador',
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, user, setAuth } = useAuthStore();
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    invitesApi.getInfo(token)
      .then(setInviteInfo)
      .catch((e) => setError(e?.response?.data?.message ?? 'Link inválido ou expirado'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async (data?: FormData) => {
    setAccepting(true);
    try {
      await invitesApi.accept(token, data);
      toast.success(`Bem-vindo à ${inviteInfo?.tenant?.companyName}!`);
      router.push('/login');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao aceitar convite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardContent className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></CardContent>
    </Card>
  );

  if (error) return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardContent className="py-10 text-center space-y-4">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <p className="text-gray-900 font-medium">{error}</p>
        <Link href="/register" className="text-indigo-600 hover:underline text-sm">Solicitar novo convite</Link>
      </CardContent>
    </Card>
  );

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-indigo-600" />
          </div>
        </div>
        <CardTitle className="text-xl">Você foi convidado</CardTitle>
        <CardDescription>
          Para entrar em <strong>{inviteInfo?.tenant?.companyName}</strong> como{' '}
          <Badge variant="secondary">{ROLE_LABELS[inviteInfo?.role] ?? inviteInfo?.role}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {isAuthenticated ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">Você está logado como <strong>{user?.email}</strong></p>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => handleAccept()} disabled={accepting}>
              {accepting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : `Entrar em ${inviteInfo?.tenant?.companyName}`}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleAccept)} className="space-y-4">
            <p className="text-sm text-gray-500 text-center">Crie sua senha para acessar</p>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="João" {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Sobrenome</Label>
              <Input placeholder="Silva" {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={accepting}>
              {accepting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : 'Aceitar convite'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
