'use client';

import { cn, formatTvl, formatPercent } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  format?: 'tvl' | 'percent' | 'number';
  accent?: 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan';
}

const accentColors = {
  blue: 'border-t-indigo-500',
  emerald: 'border-t-emerald-400',
  amber: 'border-t-amber-400',
  rose: 'border-t-rose-400',
  cyan: 'border-t-cyan-400',
};

export function StatCard({ title, value, change, subtitle, format = 'tvl', accent }: StatCardProps) {
  const formattedValue = typeof value === 'number'
    ? format === 'tvl' ? formatTvl(value) : format === 'percent' ? formatPercent(value) : value.toLocaleString()
    : value;

  return (
    <div className={cn(
      'p-5',
      accent && `border-t-2 ${accentColors[accent]}`
    )}>
      <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium">{title}</p>
      <p className="mt-2 text-[28px] font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
        {formattedValue}
      </p>
      {(change !== undefined || subtitle) && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {change !== undefined && (
            <span className={cn(
              'text-[13px] font-medium',
              change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-slate-500'
            )} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
              {change > 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
          {subtitle && <span className="text-slate-600 text-[12px]">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
