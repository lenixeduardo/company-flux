import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Request interceptor: inject Authorization header
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('flux-auth-store');
    if (stored) {
      try {
        const state = JSON.parse(stored);
        const token = state?.state?.accessToken;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch (_) {}
    }
  }
  return config;
});

// Response interceptor: handle 401 with token refresh
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }
      isRefreshing = true;
      try {
        const stored = localStorage.getItem('flux-auth-store');
        const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
        // Update store
        const parsedStore = JSON.parse(stored!);
        parsedStore.state.accessToken = data.accessToken;
        parsedStore.state.refreshToken = data.refreshToken;
        localStorage.setItem('flux-auth-store', JSON.stringify(parsedStore));
        refreshQueue.forEach(({ resolve }) => resolve(data.accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        refreshQueue.forEach(({ reject }) => reject(refreshError));
        refreshQueue = [];
        localStorage.removeItem('flux-auth-store');
        if (typeof document !== 'undefined') {
          document.cookie = 'flux-session=; path=/; max-age=0; SameSite=Lax';
        }
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// Typed API namespaces
export const authApi = {
  register: (data: Record<string, unknown>) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (data: Record<string, unknown>) =>
    api.post('/auth/reset-password', data).then((r) => r.data),
  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email/${token}`).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const tenantsApi = {
  getCurrent: () => api.get('/tenants/current').then((r) => r.data),
  update: (data: Record<string, unknown>) =>
    api.patch('/tenants/current', data).then((r) => r.data),
  getUsage: () => api.get('/tenants/current/usage').then((r) => r.data),
  progressOnboarding: (step: number) =>
    api.post('/tenants/onboarding/step', { step }).then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  updateRole: (id: string, role: string) =>
    api.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
  updateProfile: (data: Record<string, unknown>) =>
    api.patch('/users/me/profile', data).then((r) => r.data),
  changePassword: (data: Record<string, unknown>) =>
    api.patch('/users/me/password', data).then((r) => r.data),
};

export const invitesApi = {
  create: (data: Record<string, unknown>) =>
    api.post('/invites', data).then((r) => r.data),
  list: () => api.get('/invites').then((r) => r.data),
  cancel: (id: string) => api.delete(`/invites/${id}`).then((r) => r.data),
  getInfo: (token: string) =>
    api.get(`/invites/info/${token}`).then((r) => r.data),
  accept: (token: string, data?: Record<string, unknown>) =>
    api.post(`/invites/${token}/accept`, data ?? {}).then((r) => r.data),
};

export const transactionsApi = {
  list: (params?: any) => api.get('/transactions', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/transactions/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/transactions', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/transactions/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/transactions/${id}`).then((r) => r.data),
  confirm: (id: string) => api.post(`/transactions/${id}/confirm`).then((r) => r.data),
};

export const categoriesApi = {
  list: () => api.get('/categories').then((r) => r.data),
  create: (data: any) => api.post('/categories', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/categories/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data),
};

export const bankAccountsApi = {
  list: () => api.get('/bank-accounts').then((r) => r.data),
  create: (data: any) => api.post('/bank-accounts', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/bank-accounts/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/bank-accounts/${id}`).then((r) => r.data),
  getSummary: () => api.get('/bank-accounts/summary').then((r) => r.data),
};

export const dashboardApi = {
  getSummary: (year?: number, month?: number) =>
    api.get('/dashboard/summary', { params: { year, month } }).then((r) => r.data),
  getMonthlyComparison: (months = 6) =>
    api.get('/dashboard/monthly-comparison', { params: { months } }).then((r) => r.data),
  getCategoryBreakdown: (type: 'INCOME' | 'EXPENSE', year?: number, month?: number) =>
    api.get('/dashboard/category-breakdown', { params: { type, year, month } }).then((r) => r.data),
  getUpcoming: (days = 7) =>
    api.get('/dashboard/upcoming', { params: { days } }).then((r) => r.data),
  getBurnRate: () => api.get('/dashboard/burn-rate').then((r) => r.data),
};

export const suppliersApi = {
  list: (params?: any) => api.get('/suppliers', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/suppliers/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/suppliers', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/suppliers/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/suppliers/${id}`).then((r) => r.data),
  getPaymentHistory: (id: string) => api.get(`/suppliers/${id}/payment-history`).then((r) => r.data),
};

export const invoicesApi = {
  list: (params?: any) => api.get('/invoices', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/invoices/${id}`).then((r) => r.data),
  upload: (file: File, supplierId?: string) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/invoices/upload${supplierId ? `?supplierId=${supplierId}` : ''}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  getDownloadUrl: (id: string) => api.get(`/invoices/${id}/download`).then((r) => r.data),
  remove: (id: string) => api.delete(`/invoices/${id}`).then((r) => r.data),
};

export default api;
