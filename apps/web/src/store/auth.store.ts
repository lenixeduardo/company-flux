'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

interface TenantSummary {
  id: string;
  slug: string;
  companyName: string;
  cnpj: string;
  planType: string;
  status: string;
  taxRegime?: string;
  onboardingDone: boolean;
  onboardingStep: number;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  tenant: TenantSummary | null;
  role: string | null;
  isAuthenticated: boolean;
  setAuth: (data: {
    user: UserProfile;
    tenant: TenantSummary;
    accessToken: string;
    refreshToken: string;
    role?: string;
  }) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<UserProfile>) => void;
  updateTenant: (tenant: Partial<TenantSummary>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      tenant: null,
      role: null,
      isAuthenticated: false,
      setAuth: (data) => {
        if (typeof document !== 'undefined') {
          document.cookie = `flux-session=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
        }
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tenant: data.tenant,
          role: data.role ?? null,
          isAuthenticated: true,
        });
      },
      clearAuth: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'flux-session=; path=/; max-age=0; SameSite=Lax';
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          tenant: null,
          role: null,
          isAuthenticated: false,
        });
      },
      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
      updateTenant: (partial) =>
        set((s) => ({ tenant: s.tenant ? { ...s.tenant, ...partial } : null })),
    }),
    { name: 'flux-auth-store' },
  ),
);
