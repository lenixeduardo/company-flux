'use client';
import { Building2 } from 'lucide-react';

export default function BankAccountsPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
      <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Contas Bancárias</h1>
      <p className="text-muted-foreground max-w-sm">
        Gerencie suas contas bancárias e integre seus extratos para controle automático do fluxo de caixa.
      </p>
    </div>
  );
}
