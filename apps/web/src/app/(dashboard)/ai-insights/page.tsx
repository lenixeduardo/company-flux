'use client';
import { Sparkles } from 'lucide-react';

export default function AiInsightsPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
      <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">IA & Insights</h1>
      <p className="text-muted-foreground max-w-sm">
        Análises inteligentes do seu fluxo de caixa, previsões e recomendações geradas por inteligência artificial.
      </p>
    </div>
  );
}
