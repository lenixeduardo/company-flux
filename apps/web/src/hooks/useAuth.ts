'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore, type AuthState } from '@/store/auth.store';
import { authApi } from '@/lib/api-client';

export type UseAuthReturn = AuthState & { logout: () => Promise<void> };

export function useAuth(): UseAuthReturn {
  const store = useAuthStore();
  const router = useRouter();

  const logout = async () => {
    try {
      if (store.refreshToken) await authApi.logout(store.refreshToken);
    } catch (_) { /* logout errors are non-fatal */ }
    store.clearAuth();
    router.push('/login');
  };

  return { ...store, logout };
}
