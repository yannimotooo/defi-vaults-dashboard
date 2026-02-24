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

      {/* Section: Where Money Flows */}
      <div className="mb-4 mt-2">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Where Money Flows</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Net capital movement across chains and protocols over the selected period.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <FlowByChainChart curators={curators} vaults={vaults} />
        <FlowByProtocolChart overview={overview} />
      </div>

      {/* Section: Yield-Chasing Patterns */}
      <div className="mb-4 mt-2">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Yield-Chasing Patterns</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Does higher yield attract more capital? Bubble size represents TVL.</p>
      </div>

      <div className="mb-8">
        <YieldFlowScatter curators={curators} vaults={vaults} />
      </div>

      {/* Section: Flow Breakdown */}
      <div className="mb-4 mt-2">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Flow Breakdown</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Detailed flow analysis by asset type and per-curator capital movement.</p>
      </div>

      <div className="mb-8">
        <FlowBreakdownChart curators={curators} vaults={vaults} />
      </div>

      <CapitalFlowsChart curators={curators} />
    </>
  );
}
