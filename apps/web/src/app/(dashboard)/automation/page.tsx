'use client';
import { Zap } from 'lucide-react';

export default function AutomationPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
      <Zap className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Automação</h1>
      <p className="text-muted-foreground max-w-sm">
        Configure regras automáticas para categorização de transações, alertas e integrações com seu ERP.
      </p>
    </div>
  );
}
