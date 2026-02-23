'use client';

import { useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CuratorLeaderboard } from '@/components/charts/curator-leaderboard';
import { CuratorTvlChart } from '@/components/charts/curator-tvl-chart';
import { CuratorComparisonChart } from '@/components/charts/curator-comparison-chart';
import { RiskHeatmap } from '@/components/charts/risk-heatmap';
import { getCuratorColor } from '@/lib/colors';
import type { Curator, HistoricalCuratorData } from '@/types';

interface CuratorsTabProps {
  curators: Curator[];
  historicalData: HistoricalCuratorData[];
}

export function CuratorsTab({ curators, historicalData }: CuratorsTabProps) {
  const stats = useMemo(() => {
    const totalTvl = curators.reduce((sum, c) => sum + c.totalTvl, 0);
    const totalVaults = curators.reduce((sum, c) => sum + c.vaultCount, 0);
    const avgApy = totalTvl > 0
      ? curators.reduce((sum, c) => sum + c.avgApy * c.totalTvl, 0) / totalTvl
      : 0;
    return { totalTvl, totalVaults, avgApy };
  }, [curators]);

  const totalTvl = stats.totalTvl;

  return (
    <>
      {/* Curator Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#2d3548]/40 rounded-[14px] overflow-hidden mb-8 border border-[#2d3548]/60">
        <div className="bg-[#1a1f2e] accent-border-blue">
          <StatCard title="Total Curator TVL" value={stats.totalTvl} accent="blue" />
        </div>
        <div className="bg-[#1a1f2e] accent-border-amber">
          <StatCard title="Total Curators" value={curators.length} format="number" accent="amber" />
        </div>
        <div className="bg-[#1a1f2e] accent-border-cyan">
          <StatCard title="Total Vaults" value={stats.totalVaults} format="number" accent="cyan" />
        </div>
        <div className="bg-[#1a1f2e] accent-border-emerald">
          <StatCard
            title="Avg APY"
            value={stats.avgApy}
            format="percent"
            subtitle="TVL-weighted"
            accent="emerald"
          />
        </div>
      </div>

      {/* Historical TVL Comparison */}
      {historicalData.length > 0 && (
        <div className="mb-8">
          <CuratorComparisonChart
            curators={historicalData}
            title="Curator TVL Over Time"
            height={380}
          />
        </div>
      )}

      {/* Current TVL Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" style={{ gridAutoRows: '1fr' }}>
        <CuratorTvlChart curators={curators} />
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Market Share</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4 pt-0">
            <div className="flex-1 flex flex-col justify-between">
              {curators.slice(0, 10).map((curator, index) => {
                const share = totalTvl > 0 ? (curator.totalTvl / totalTvl) * 100 : 0;
                return (
                  <div key={curator.slug} className="flex items-center gap-3">
                    <span className="text-[12px] text-slate-500 w-4">{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] text-slate-300">{curator.name}</span>
                        <span className="text-[13px] text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{share.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-[#1a1f2e]/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${share}%`,
                            backgroundColor: getCuratorColor(curator.name, index),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Heatmap */}
      <div className="mb-8">
        <RiskHeatmap curators={curators} />
      </div>

      {/* Curator Leaderboard */}
      <CuratorLeaderboard curators={curators} />
    </>
  );
}
