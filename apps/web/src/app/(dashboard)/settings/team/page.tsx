'use client';
import { Settings } from 'lucide-react';

export default function SettingsTeamPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
      <Settings className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Configurações da Equipe</h1>
      <p className="text-muted-foreground max-w-sm">
        Gerencie os membros da sua equipe, permissões e convites para colaboradores.
      </p>
    </div>
  );
}
