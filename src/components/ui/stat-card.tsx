'use client';

import { cn, formatTvl, formatPercent } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  format?: 'tvl' | 'percent' | 'number';
}

export function StatCard({ title, value, change, subtitle, format = 'tvl' }: StatCardProps) {
  const formattedValue = typeof value === 'number'
    ? format === 'tvl' ? formatTvl(value) : format === 'percent' ? formatPercent(value) : value.toLocaleString()
    : value;

  return (
    <div className="p-5">
      <p className="text-[13px] text-zinc-500 font-medium">{title}</p>
      <p className="mt-2 text-[28px] font-semibold text-white tracking-tight font-mono">{formattedValue}</p>
      {change !== undefined && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={cn(
            'text-[13px] font-medium font-mono',
            change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-zinc-500'
          )}>
            {change > 0 ? '+' : ''}{change.toFixed(2)}%
          </span>
          {subtitle && <span className="text-zinc-600 text-[13px]">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
