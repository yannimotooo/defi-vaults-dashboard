'use client';

import { useMemo } from 'react';
import { formatTvl } from '@/lib/utils';
import { computeFlowSummary } from '@/lib/flow-analysis';
import type { Curator } from '@/types';

interface FlowSummaryStatsProps {
  curators: Curator[];
}

function FlowStatCard({ title, value, subtitle, accent }: {
  title: string;
  value: number;
  subtitle?: string;
  accent: 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const isPositive = value >= 0;
  const arrow = value === 0 ? '' : isPositive ? '\u2191' : '\u2193';
  const valueColor = accent === 'blue' || accent === 'amber'
    ? isPositive ? 'text-emerald-600' : 'text-red-600'
    : accent === 'emerald' ? 'text-emerald-600' : 'text-red-600';

  const accentBorders: Record<string, string> = {
    blue: 'border-t-indigo-600',
    emerald: 'border-t-emerald-600',
    amber: 'border-t-amber-500',
    rose: 'border-t-rose-500',
  };

  const bgTints: Record<string, string> = {
    blue: isPositive ? 'bg-emerald-500/[0.02]' : 'bg-red-500/[0.02]',
    amber: isPositive ? 'bg-emerald-500/[0.02]' : 'bg-red-500/[0.02]',
    emerald: 'bg-emerald-500/[0.02]',
    rose: 'bg-red-500/[0.02]',
  };

  return (
    <div className={`p-3 sm:p-5 border-t-2 ${accentBorders[accent]} ${bgTints[accent]}`}>
      <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-gray-500 font-medium">{title}</p>
      <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5">
        {arrow && (
          <span className={`text-[16px] sm:text-[20px] ${valueColor}`}>{arrow}</span>
        )}
        <p
          className={`text-[20px] sm:text-[28px] font-semibold tracking-tight ${valueColor}`}
          style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          {formatTvl(Math.abs(value))}
        </p>
      </div>
      {subtitle && (
        <p className="mt-1.5 text-gray-400 text-[12px]">{subtitle}</p>
      )}
    </div>
  );
}

export function FlowSummaryStats({ curators }: FlowSummaryStatsProps) {
  const summary = useMemo(() => computeFlowSummary(curators), [curators]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200/50 rounded-xl overflow-hidden border border-gray-200">
      <div className="bg-white">
        <FlowStatCard
          title="Net Flow (7d)"
          value={summary.totalFlow7d}
          accent="blue"
        />
      </div>
      <div className="bg-white">
        <FlowStatCard
          title="Net Flow (30d)"
          value={summary.totalFlow30d}
          accent="amber"
        />
      </div>
      <div className="bg-white">
        <FlowStatCard
          title="Biggest Inflow (7d)"
          value={summary.biggestInflow ? summary.biggestInflow.flow : 0}
          subtitle={summary.biggestInflow?.name}
          accent="emerald"
        />
      </div>
      <div className="bg-white">
        <FlowStatCard
          title="Biggest Outflow (7d)"
          value={summary.biggestOutflow ? summary.biggestOutflow.flow : 0}
          subtitle={summary.biggestOutflow?.name}
          accent="rose"
        />
      </div>
    </div>
  );
}
