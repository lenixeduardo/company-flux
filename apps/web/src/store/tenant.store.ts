'use client';
import { create } from 'zustand';
import { PLAN_LIMITS, PlanType } from '@flux/shared';

interface PlanUsage {
  userCount: number;
  transactionCount: number;
  bankAccountCount: number;
  invoiceCount: number;
  planType: string;
  limits: (typeof PLAN_LIMITS)[PlanType];
}

interface TenantStoreState {
  usage: PlanUsage | null;
  setUsage: (usage: PlanUsage) => void;
  canUseFeature: (feature: string) => boolean;
}

export const useTenantStore = create<TenantStoreState>()((set, get) => ({
  usage: null,
  setUsage: (usage) => set({ usage }),
  canUseFeature: (feature: string) => {
    const { usage } = get();
    if (!usage) return false;
    const limits = usage.limits as Record<string, unknown>;
    return Boolean(limits[feature]);
  },
}));
