'use client';

import { useMemo } from 'react';
import { FlowSummaryStats } from '@/components/charts/flow-summary-stats';
import { FlowByChainChart } from '@/components/charts/flow-by-chain-chart';
import { FlowByProtocolChart } from '@/components/charts/flow-by-protocol-chart';
import { YieldFlowScatter } from '@/components/charts/yield-flow-scatter';
import { FlowBreakdownChart } from '@/components/charts/flow-breakdown-chart';
import { CapitalFlowsChart } from '@/components/charts/capital-flows-chart';
import { CuratorDisplacementFlows } from '@/components/charts/curator-displacement-flows';
import { FlowDiagram } from '@/components/charts/flow-diagram';
import { computeProtocolFlows } from '@/lib/flow-analysis';
import type { Curator, VaultData, MarketOverview } from '@/types';

interface FlowsTabProps {
  curators: Curator[];
  vaults: VaultData[];
  overview: MarketOverview;
}

export function FlowsTab({ curators, vaults, overview }: FlowsTabProps) {
  // Protocol-level flow data for the Sankey diagram (authoritative — from DeFiLlama)
  const protocolFlowEntities = useMemo(() => {
    const flows = computeProtocolFlows(overview);
    return flows
      .filter(f => Math.abs(f.flow30d) > 1_000_000) // only show >$1M flows
      .map(f => ({ name: f.name, flow: f.flow30d }));
  }, [overview]);

  return (
    <>
      {/* Flow Summary Stats */}
      <div className="mb-8">
        <FlowSummaryStats curators={curators} />
      </div>

      {/* Section: Protocol Capital Flows (Sankey — authoritative DeFiLlama data) */}
      <div className="mb-4 mt-2 border-t border-gray-200 pt-6">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Protocol Capital Flows</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          30-day net capital movement between protocols. Outflows (left) and inflows (right)
          with bands showing flow scale. Sourced from DeFiLlama protocol TVL tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <FlowDiagram
          entities={protocolFlowEntities}
          title="Protocol Flow Diagram"
          subtitle="30d net flows. Bars proportional to magnitude. Bands connect by rank."
          maxEntries={8}
        />
        <FlowByProtocolChart overview={overview} />
      </div>

      {/* Section: Curator Net Flows */}
      <div className="mb-4 mt-2 border-t border-gray-200 pt-6">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Curator Net Flows</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Per-curator TVL change over 7d/30d/90d. Historical data from DeFiLlama.
        </p>
      </div>

      <div className="mb-8">
        <CuratorDisplacementFlows />
      </div>

      {/* Section: Where Money Flows */}
      <div className="mb-4 mt-2 border-t border-gray-200 pt-6">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Chain & Curator Flows</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Net capital movement across chains and per curator.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <FlowByChainChart curators={curators} vaults={vaults} />
        <CapitalFlowsChart curators={curators} />
      </div>

      {/* Section: Yield-Chasing Patterns */}
      <div className="mb-4 mt-2 border-t border-gray-200 pt-6">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Yield-Chasing Patterns</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Does higher yield attract more capital? Bubble size represents TVL.</p>
      </div>

      <div className="mb-8">
        <YieldFlowScatter curators={curators} vaults={vaults} />
      </div>

      {/* Section: Flow Breakdown */}
      <div className="mb-4 mt-2 border-t border-gray-200 pt-6">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Flow Breakdown</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Detailed flow analysis by asset type.</p>
      </div>

      <div className="mb-8">
        <FlowBreakdownChart curators={curators} vaults={vaults} />
      </div>
    </>
  );
}
