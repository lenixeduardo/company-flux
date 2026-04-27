import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl mb-3">
            F
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Flux Financeiro</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão financeira inteligente</p>
        </div>
        {children}
      </div>
    </div>
  );
}
