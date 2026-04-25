'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api-client';

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  const logout = async () => {
    try {
      if (store.refreshToken) await authApi.logout(store.refreshToken);
    } catch (_) {}
    store.clearAuth();
    router.push('/login');
  };

  return { ...store, logout };
}
