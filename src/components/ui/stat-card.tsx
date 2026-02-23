'use client';

import { cn, formatTvl, formatPercent } from '@/lib/utils';
import { Sparkline } from '@/components/ui/sparkline';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  format?: 'tvl' | 'percent' | 'number';
  accent?: 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan';
  sparklineData?: number[];
}

const accentColors = {
  blue: 'border-t-indigo-600',
  emerald: 'border-t-emerald-600',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
  cyan: 'border-t-cyan-600',
};

const sparklineColors = {
  blue: '#4F46E5',
  emerald: '#059669',
  amber: '#D97706',
  rose: '#E11D48',
  cyan: '#0891B2',
};

export function StatCard({
  title,
  value,
  change,
  subtitle,
  format = 'tvl',
  accent,
  sparklineData,
}: StatCardProps) {
  const formattedValue =
    typeof value === 'number'
      ? format === 'tvl'
        ? formatTvl(value)
        : format === 'percent'
          ? formatPercent(value)
          : value.toLocaleString()
      : value;

  return (
    <div className={cn('p-3 sm:p-5', accent && `border-t-2 ${accentColors[accent]}`)}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-gray-500 font-medium">{title}</p>
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline
            data={sparklineData}
            color={accent ? sparklineColors[accent] : '#6366f1'}
            width={56}
            height={20}
          />
        )}
      </div>
      <p
        className="mt-1.5 sm:mt-2 text-[20px] sm:text-[28px] font-semibold text-gray-900 tracking-tight"
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >
        {formattedValue}
      </p>
      {(change !== undefined || subtitle) && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {change !== undefined && (
            <span
              className={cn(
                'text-[13px] font-medium',
                change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-gray-500',
              )}
              style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              {change > 0 ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          )}
          {subtitle && <span className="text-gray-400 text-[12px]">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
