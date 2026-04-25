'use client';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconBg?: string;
  isLoading?: boolean;
  valueColor?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  iconBg = 'bg-indigo-100',
  isLoading,
  valueColor,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold mt-1 tabular-nums', valueColor)}>{value}</p>
            {change !== undefined && (
              <div
                className={cn(
                  'flex items-center gap-1 mt-1 text-xs font-medium',
                  change >= 0 ? 'text-green-600' : 'text-red-500',
                )}
              >
                {change >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                <span>
                  {Math.abs(change).toFixed(1)}% {changeLabel ?? 'vs mês anterior'}
                </span>
              </div>
            )}
          </div>
          <div className={cn('p-2.5 rounded-xl', iconBg)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
