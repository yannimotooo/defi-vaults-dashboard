'use client';

import { StatCard } from '@/components/ui/stat-card';
import { TvlByProtocolChart } from '@/components/charts/tvl-by-protocol';
import { ProtocolTable } from '@/components/charts/protocol-table';
import type { MarketOverview } from '@/types';

interface ProtocolsTabProps {
  overviewData: MarketOverview;
}

export function ProtocolsTab({ overviewData }: ProtocolsTabProps) {
  return (
    <>
      {/* Protocol Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#2d3548]/40 rounded-[14px] overflow-hidden mb-8 border border-[#2d3548]/60">
        <div className="bg-[#1a1f2e] accent-border-blue">
          <StatCard
            title="Total Protocol TVL"
            value={overviewData.totalTvl}
            change={overviewData.totalTvlChange24h}
            subtitle="24h"
            accent="blue"
          />
        </div>
        <div className="bg-[#1a1f2e] accent-border-amber">
          <StatCard
            title="Protocols Tracked"
            value={overviewData.tvlByProtocol.length}
            format="number"
            accent="amber"
          />
        </div>
        <div className="bg-[#1a1f2e] accent-border-cyan">
          <StatCard
            title="Chains Covered"
            value={overviewData.tvlByChain.length}
            format="number"
            accent="cyan"
          />
        </div>
        <div className="bg-[#1a1f2e] accent-border-emerald">
          <StatCard
            title="7d Change"
            value={overviewData.totalTvlChange7d}
            format="percent"
            accent="emerald"
          />
        </div>
      </div>

      {/* Protocol Chart */}
      <div className="mb-8">
        <TvlByProtocolChart data={overviewData.tvlByProtocol} />
      </div>

      {/* Protocol Table */}
      <ProtocolTable data={overviewData.tvlByProtocol} />
    </>
  );
}
