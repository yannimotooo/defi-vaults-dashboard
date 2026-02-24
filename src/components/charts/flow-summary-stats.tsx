'use client';

import { useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { computeFlowSummary } from '@/lib/flow-analysis';
import type { Curator } from '@/types';

interface FlowSummaryStatsProps {
  curators: Curator[];
}

export function FlowSummaryStats({ curators }: FlowSummaryStatsProps) {
  const summary = useMemo(() => computeFlowSummary(curators), [curators]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200/50 rounded-xl overflow-hidden border border-gray-200">
      <div className="bg-white">
        <StatCard
          title="Net Flow (7d)"
          value={summary.totalFlow7d}
          format="tvl"
          accent="blue"
        />
      </div>
      <div className="bg-white">
        <StatCard
          title="Net Flow (30d)"
          value={summary.totalFlow30d}
          format="tvl"
          accent="amber"
        />
      </div>
      <div className="bg-white">
        <StatCard
          title="Biggest Inflow (7d)"
          value={summary.biggestInflow ? summary.biggestInflow.flow : 0}
          format="tvl"
          subtitle={summary.biggestInflow?.name}
          accent="emerald"
        />
      </div>
      <div className="bg-white">
        <StatCard
          title="Biggest Outflow (7d)"
          value={summary.biggestOutflow ? summary.biggestOutflow.flow : 0}
          format="tvl"
          subtitle={summary.biggestOutflow?.name}
          accent="rose"
        />
      </div>
    </div>
  );
}
