'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardPage() {
  const { isAuthenticated, tenant } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (tenant && !tenant.onboardingDone) { router.replace('/onboarding'); return; }
    // Future phases will render actual dashboard here
  }, [isAuthenticated, tenant, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    </div>
  );
}
