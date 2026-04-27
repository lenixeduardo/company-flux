'use client';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { PLAN_LIMITS } from '@flux/shared';

interface PlanGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PlanGate({ feature, children, fallback }: PlanGateProps) {
  const { tenant } = useAuthStore();
  const planType = (tenant?.planType ?? 'FREE') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[planType] as Record<string, unknown>;
  const hasAccess = Boolean(limits?.[feature]);

  if (hasAccess) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <div className="relative rounded-lg overflow-hidden">
      <div className="blur-sm pointer-events-none select-none opacity-50">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-lg border border-dashed border-indigo-200">
        <Lock className="h-6 w-6 text-indigo-400 mb-2" />
        <p className="text-sm font-medium text-gray-700 text-center px-4">
          Disponível nos planos Starter e Professional
        </p>
        <Link href="/billing" className="mt-2 text-sm text-indigo-600 hover:underline font-semibold">
          Ver planos →
        </Link>
      </div>
    </div>
  );
}
