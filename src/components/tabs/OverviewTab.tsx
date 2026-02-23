'use client';

import { useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { TvlByChainChart } from '@/components/charts/tvl-by-chain';
import { TvlByProtocolChart } from '@/components/charts/tvl-by-protocol';
import { CuratorTvlChart } from '@/components/charts/curator-tvl-chart';
import { RiskSummaryCard } from '@/components/charts/risk-summary-card';
import { CapitalFlowsChart } from '@/components/charts/capital-flows-chart';
import { FeeTaxChart } from '@/components/charts/fee-tax-chart';
import { RealVsFarmedChart } from '@/components/charts/real-vs-farmed-chart';
import type { MarketOverview, Curator, HistoricalCuratorData, VaultData } from '@/types';

interface OverviewTabProps {
  overviewData: MarketOverview;
  curators: Curator[];
  historicalData: HistoricalCuratorData[];
  vaults: VaultData[];
  onNavigate: (tab: 'curators') => void;
}

export function OverviewTab({ overviewData, curators, historicalData, vaults, onNavigate }: OverviewTabProps) {
  // Derive aggregate TVL sparkline from per-curator historical data
  const tvlSparkline = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return undefined;

    // Aggregate TVL by date across all curators
    const dateMap = new Map<number, number>();
    for (const curator of historicalData) {
      for (const point of curator.data) {
        dateMap.set(point.date, (dateMap.get(point.date) || 0) + point.tvl);
      }
    }

    // Sort by date and take last 14 points for a clean sparkline
    const sorted = Array.from(dateMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, tvl]) => tvl);

    return sorted.length >= 2 ? sorted.slice(-14) : undefined;
  }, [historicalData]);
  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200/50 rounded-xl overflow-hidden mb-8 border border-gray-200">
        <div className="bg-white">
          <StatCard
            title="Total Vault TVL"
            value={overviewData.totalTvl}
            change={overviewData.totalTvlChange24h}
            subtitle="24h"
            accent="blue"
            sparklineData={tvlSparkline}
          />
        </div>
        <div className="bg-white">
          <StatCard
            title="EVM Chains"
            value={overviewData.evmTvl}
            accent="emerald"
          />
        </div>
        <div className="bg-white">
          <StatCard
            title="Solana"
            value={overviewData.solanaTvl}
            accent="cyan"
          />
        </div>
        <div className="bg-white">
          <StatCard
            title="Active Curators"
            value={curators.length || overviewData.totalCurators}
            format="number"
            accent="amber"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TvlByChainChart data={overviewData.tvlByChain} />
        <TvlByProtocolChart data={overviewData.tvlByProtocol} />
      </div>

      {/* Capital Flows */}
      {curators.length > 0 && (
        <div className="mb-8">
          <CapitalFlowsChart curators={curators} />
        </div>
      )}

      {/* Fee Tax + Real vs Farmed Yield */}
      {curators.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <FeeTaxChart curators={curators} />
          <RealVsFarmedChart vaults={vaults} curators={curators} />
        </div>
      )}

      {/* Risk Summary */}
      {curators.length > 0 && (
        <div className="mb-8">
          <RiskSummaryCard curators={curators} />
        </div>
      )}

      {/* Quick Curator Preview */}
      {curators.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-gray-900">Top Curators</h2>
            <button
              onClick={() => onNavigate('curators')}
              className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
            >
              View all →
            </button>
          </div>
          <CuratorTvlChart curators={curators} />
        </div>
      )}
    </>
  );
}
