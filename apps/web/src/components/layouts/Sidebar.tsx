'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Building2,
  Users,
  FileText,
  Calculator,
  Zap,
  Sparkles,
  Settings,
  CreditCard,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Fluxo de Caixa', href: '/cash-flow/transactions', icon: TrendingUp },
  { label: 'Contas Bancárias', href: '/bank-accounts', icon: Building2 },
  { label: 'Fornecedores', href: '/suppliers', icon: Users },
  { label: 'Notas Fiscais', href: '/invoices', icon: FileText },
  { label: 'Impostos', href: '/tax', icon: Calculator },
  { label: 'Automação', href: '/automation', icon: Zap },
  { label: 'IA & Insights', href: '/ai-insights', icon: Sparkles },
  { label: 'Configurações', href: '/settings/team', icon: Settings },
  { label: 'Assinatura', href: '/billing', icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex flex-col bg-white border-r w-64 h-screen flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-lg select-none">
          F
        </div>
        <span className="font-semibold text-gray-900 text-base leading-tight">
          Flux Financeiro
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive(href)
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 flex-shrink-0',
                isActive(href) ? 'text-indigo-600' : 'text-gray-400',
              )}
            />
            {label}
          </Link>
        ))}
      </nav>

      {/* User profile at bottom */}
      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <Avatar className="h-8 w-8 flex-shrink-0">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
            <AvatarFallback>
              {user ? getInitials(user.firstName, user.lastName) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user ? `${user.firstName} ${user.lastName}` : 'Usuário'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email ?? ''}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="h-8 w-8 text-gray-400 hover:text-red-500 flex-shrink-0"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
