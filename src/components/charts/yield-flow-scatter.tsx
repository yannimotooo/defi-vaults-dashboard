'use client';

import { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatTvl, formatFlow } from '@/lib/utils';
import { computeYieldFlowCorrelation } from '@/lib/flow-analysis';
import type { Curator, VaultData } from '@/types';

interface YieldFlowScatterProps {
  curators: Curator[];
  vaults: VaultData[];
}

export function YieldFlowScatter({ curators, vaults }: YieldFlowScatterProps) {
  const { stableData, nonStableData, medianApy } = useMemo(() => {
    const all = computeYieldFlowCorrelation(curators, vaults);
    const stable = all.filter(d => d.stablecoin);
    const nonStable = all.filter(d => !d.stablecoin);

    // Median APY for quadrant line
    const sortedApy = all.map(d => d.apy).sort((a, b) => a - b);
    const mid = Math.floor(sortedApy.length / 2);
    const median = sortedApy.length > 0
      ? sortedApy.length % 2 !== 0 ? sortedApy[mid] : (sortedApy[mid - 1] + sortedApy[mid]) / 2
      : 5;

    return { stableData: stable, nonStableData: nonStable, medianApy: median };
  }, [curators, vaults]);

  if (stableData.length + nonStableData.length < 3) {
    return <EmptyStateCard title="Yield vs Flow" message="Not enough data points for scatter analysis." />;
  }

  // Size range for Z-axis (TVL → bubble size)
  const allTvl = [...stableData, ...nonStableData].map(d => d.tvl);
  const minTvl = Math.min(...allTvl);
  const maxTvl = Math.max(...allTvl);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Yield Chasing</p>
            <CardTitle>APY vs Capital Flow</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-gray-500">Stablecoin</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-gray-500">Non-Stable</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-400">Size = TVL</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-5 pt-0">
        <div className="h-[400px] relative">
          {/* Quadrant labels with pill backgrounds */}
          <div className="absolute top-2 left-14 z-10">
            <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">Safety Inflow</span>
          </div>
          <div className="absolute top-2 right-4 z-10">
            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">Yield Chasing</span>
          </div>
          <div className="absolute bottom-10 left-14 z-10">
            <span className="text-[10px] text-gray-500 font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200/50">Stagnant</span>
          </div>
          <div className="absolute bottom-10 right-4 z-10">
            <span className="text-[10px] text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full border border-red-200/50">Risky Outflow</span>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <defs>
                {/* Quadrant background zones */}
                <linearGradient id="quadTopLeft" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="quadTopRight" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="quadBottomLeft" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#9CA3AF" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#9CA3AF" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="quadBottomRight" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.01} />
                </linearGradient>
                {/* Glow filters for dots */}
                <filter id="glowIndigo" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#6366F1" floodOpacity="0.4" />
                </filter>
                <filter id="glowAmber" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#F59E0B" floodOpacity="0.4" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="#F3F4F6" />
              <XAxis
                type="number"
                dataKey="apy"
                name="APY"
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                stroke="#D1D5DB"
                fontSize={11}
                fontFamily="var(--font-jetbrains-mono), monospace"
                axisLine={false}
                tickLine={false}
                label={{ value: 'APY %', position: 'bottom', offset: 0, fontSize: 10, fill: '#9CA3AF' }}
              />
              <YAxis
                type="number"
                dataKey="flow7d"
                name="Flow"
                tickFormatter={(v) => formatTvl(v, true)}
                stroke="#D1D5DB"
                fontSize={11}
                fontFamily="var(--font-jetbrains-mono), monospace"
                axisLine={false}
                tickLine={false}
                label={{ value: '7d Flow', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#9CA3AF' }}
              />
              <ZAxis
                type="number"
                dataKey="tvl"
                range={[40, 400]}
                domain={[minTvl, maxTvl]}
              />
              <ReferenceLine y={0} stroke="#E5E7EB" strokeDasharray="3 6" />
              <ReferenceLine x={medianApy} stroke="#E5E7EB" strokeDasharray="3 6" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm p-3 shadow-lg min-w-[200px]">
                        <p className="font-medium text-gray-900 text-[14px] mb-2">{data.name}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-gray-500">APY</span>
                            <span className="font-mono text-emerald-600">{data.apy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">7d Flow</span>
                            <span className={`font-mono ${data.flow7d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatFlow(data.flow7d)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-gray-200">
                            <span className="text-gray-500">TVL</span>
                            <span className="font-mono text-gray-700">{formatTvl(data.tvl)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Type</span>
                            <span className="text-gray-700">{data.stablecoin ? 'Stablecoin' : 'Non-Stable'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter
                name="Stablecoin"
                data={stableData}
                fill="#6366F1"
                fillOpacity={0.85}
                style={{ filter: 'url(#glowIndigo)' }}
              />
              <Scatter
                name="Non-Stable"
                data={nonStableData}
                fill="#F59E0B"
                fillOpacity={0.85}
                style={{ filter: 'url(#glowAmber)' }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
