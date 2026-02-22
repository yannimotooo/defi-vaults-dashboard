'use client';

import { StatCard } from '@/components/ui/stat-card';
import { TvlByChainChart } from '@/components/charts/tvl-by-chain';
import { TvlByProtocolChart } from '@/components/charts/tvl-by-protocol';
import { CuratorTvlChart } from '@/components/charts/curator-tvl-chart';
import { RiskSummaryCard } from '@/components/charts/risk-summary-card';
import type { MarketOverview, Curator } from '@/types';

interface OverviewTabProps {
  overviewData: MarketOverview;
  curators: Curator[];
  onNavigate: (tab: 'curators') => void;
}

export function OverviewTab({ overviewData, curators, onNavigate }: OverviewTabProps) {
  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700/30 rounded-xl overflow-hidden mb-8 border border-slate-700/35">
        <div className="bg-[#111827]/80 accent-border-blue">
          <StatCard
            title="Total Vault TVL"
            value={overviewData.totalTvl}
            change={overviewData.totalTvlChange24h}
            subtitle="24h"
            accent="blue"
          />
        </div>
        <div className="bg-[#111827]/80 accent-border-emerald">
          <StatCard
            title="EVM Chains"
            value={overviewData.evmTvl}
            accent="emerald"
          />
        </div>
        <div className="bg-[#111827]/80 accent-border-cyan">
          <StatCard
            title="Solana"
            value={overviewData.solanaTvl}
            accent="cyan"
          />
        </div>
        <div className="bg-[#111827]/80 accent-border-amber">
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
            <h2 className="text-[15px] font-semibold text-slate-100">Top Curators</h2>
            <button
              onClick={() => onNavigate('curators')}
              className="text-[13px] text-slate-400 hover:text-white transition-colors"
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
