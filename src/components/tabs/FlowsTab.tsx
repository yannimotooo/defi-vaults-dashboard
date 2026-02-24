'use client';

import { FlowSummaryStats } from '@/components/charts/flow-summary-stats';
import { FlowByChainChart } from '@/components/charts/flow-by-chain-chart';
import { FlowByProtocolChart } from '@/components/charts/flow-by-protocol-chart';
import { YieldFlowScatter } from '@/components/charts/yield-flow-scatter';
import { FlowBreakdownChart } from '@/components/charts/flow-breakdown-chart';
import { CapitalFlowsChart } from '@/components/charts/capital-flows-chart';
import type { Curator, VaultData, MarketOverview } from '@/types';

interface FlowsTabProps {
  curators: Curator[];
  vaults: VaultData[];
  overview: MarketOverview;
}

export function FlowsTab({ curators, vaults, overview }: FlowsTabProps) {
  return (
    <>
      {/* Flow Summary Stats */}
      <div className="mb-8">
        <FlowSummaryStats curators={curators} />
      </div>

      {/* Flows by Chain + Flows by Protocol */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <FlowByChainChart curators={curators} vaults={vaults} />
        <FlowByProtocolChart overview={overview} />
      </div>

      {/* Yield-Chasing Scatter — signature chart */}
      <div className="mb-8">
        <YieldFlowScatter curators={curators} vaults={vaults} />
      </div>

      {/* Flow Direction Breakdown */}
      <div className="mb-8">
        <FlowBreakdownChart curators={curators} vaults={vaults} />
      </div>

      {/* Capital Flows by Curator (reuse existing) */}
      <CapitalFlowsChart curators={curators} />
    </>
  );
}
