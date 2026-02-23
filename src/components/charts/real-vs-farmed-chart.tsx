'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl } from '@/lib/utils';
import type { Curator, VaultData } from '@/types';

interface RealVsFarmedChartProps {
  vaults: VaultData[];
  curators: Curator[];
}

type SortBy = 'tvl' | 'organicPct' | 'totalApy';

export function RealVsFarmedChart({ vaults, curators }: RealVsFarmedChartProps) {
  const [sortBy, setSortBy] = useState<SortBy>('tvl');
  const router = useRouter();

  const { chartData, overallOrganicPct } = useMemo(() => {
    // Group vaults by curator
    const curatorVaults = new Map<string, VaultData[]>();
    for (const vault of vaults) {
      if (!vault.curator || vault.isRawMarket) continue;
      const key = vault.curator;
      if (!curatorVaults.has(key)) curatorVaults.set(key, []);
      curatorVaults.get(key)!.push(vault);
    }

    // Build slug lookup from curators array
    const slugLookup = new Map<string, string>();
    for (const c of curators) {
      slugLookup.set(c.name, c.slug);
    }

    const results: {
      name: string;
      fullName: string;
      slug: string;
      organicApy: number;
      farmedApy: number;
      totalApy: number;
      organicPercent: number;
      vaultCount: number;
      totalTvl: number;
    }[] = [];

    let allWeightedBase = 0;
    let allWeightedReward = 0;
    let allTvl = 0;

    for (const [curatorName, cvaults] of curatorVaults) {
      const totalTvl = cvaults.reduce((s, v) => s + v.tvl, 0);
      if (totalTvl === 0) continue;

      let weightedBase = 0;
      let weightedReward = 0;

      for (const v of cvaults) {
        const weight = v.tvl / totalTvl;
        weightedBase += (v.apyBase || 0) * weight;
        weightedReward += (v.apyReward || 0) * weight;
      }

      allWeightedBase += weightedBase * totalTvl;
      allWeightedReward += weightedReward * totalTvl;
      allTvl += totalTvl;

      const total = weightedBase + weightedReward;

      results.push({
        name: formatName(curatorName),
        fullName: curatorName,
        slug: slugLookup.get(curatorName) || curatorName.toLowerCase().replace(/\s+/g, '-'),
        organicApy: weightedBase,
        farmedApy: weightedReward,
        totalApy: total,
        organicPercent: total > 0 ? (weightedBase / total) * 100 : 0,
        vaultCount: cvaults.length,
        totalTvl,
      });
    }

    // Sort based on selected criteria
    const filtered = results.filter(r => r.totalApy > 0);
    if (sortBy === 'tvl') {
      filtered.sort((a, b) => b.totalTvl - a.totalTvl);
    } else if (sortBy === 'organicPct') {
      filtered.sort((a, b) => a.organicPercent - b.organicPercent); // lowest organic first (most farmed)
    } else {
      filtered.sort((a, b) => b.totalApy - a.totalApy);
    }

    const overallBase = allTvl > 0 ? allWeightedBase / allTvl : 0;
    const overallReward = allTvl > 0 ? allWeightedReward / allTvl : 0;
    const overallTotal = overallBase + overallReward;
    const overallOrgPct = overallTotal > 0 ? (overallBase / overallTotal) * 100 : 0;

    return {
      chartData: filtered.slice(0, 10),
      overallOrganicPct: overallOrgPct,
    };
  }, [vaults, curators, sortBy]);

  const handleBarClick = (data: unknown) => {
    const item = data as { slug?: string };
    if (item?.slug) {
      router.push(`/curator/${item.slug}`);
    }
  };

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1">Yield Quality</p>
              <CardTitle>Real vs Farmed Yield</CardTitle>
            </div>
            <div className="flex gap-0.5 bg-[#141922] rounded-full p-0.5 border border-[#2d3548]/50">
              {([
                { key: 'tvl' as SortBy, label: 'By TVL' },
                { key: 'organicPct' as SortBy, label: 'By Organic %' },
                { key: 'totalApy' as SortBy, label: 'By APY' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium rounded-full transition-all ${
                    sortBy === key
                      ? 'bg-[#2d3548] text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Summary headline */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[#1a1f2e]/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(overallOrganicPct, 100)}%` }}
              />
            </div>
            <span className="text-[12px] font-mono text-emerald-400 whitespace-nowrap">
              {overallOrganicPct.toFixed(0)}% organic
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 pr-2 sm:pr-5 pb-4">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
              barCategoryGap="18%"
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `${v.toFixed(1)}%`}
                stroke="#334155"
                fontSize={11}
                fontFamily="var(--font-jetbrains-mono), monospace"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748b"
                fontSize={11}
                width={90}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const orgColor = data.organicPercent >= 60 ? 'text-emerald-400' : data.organicPercent >= 30 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <div className="rounded-lg border border-[#2d3548]/60 bg-[#1a1f2e]/95 backdrop-blur-sm p-3 shadow-xl min-w-[220px]">
                        <p className="font-medium text-white text-[14px] mb-2">{data.fullName}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-emerald-500">Organic Yield</span>
                            <span className="font-mono text-emerald-400">{data.organicApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-violet-500">Incentive Yield</span>
                            <span className="font-mono text-violet-400">{data.farmedApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-slate-700/40">
                            <span className="text-slate-500">Total APY</span>
                            <span className="font-mono text-white">{data.totalApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Organic Share</span>
                            <span className={`font-mono ${orgColor}`}>{data.organicPercent.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-slate-700/40">
                            <span className="text-slate-500">Vaults</span>
                            <span className="font-mono text-slate-300">{data.vaultCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">TVL</span>
                            <span className="font-mono text-slate-300">{formatTvl(data.totalTvl)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
              />
              <Legend
                content={() => (
                  <div className="flex items-center justify-center gap-4 mt-2 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span className="text-slate-400">Organic (base)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                      <span className="text-slate-400">Incentives</span>
                    </span>
                  </div>
                )}
              />
              <Bar
                dataKey="organicApy"
                stackId="yield"
                fill="#10B981"
                radius={[0, 0, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              />
              <Bar
                dataKey="farmedApy"
                stackId="yield"
                fill="#8B5CF6"
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function formatName(name: string): string {
  const shortNames: Record<string, string> = {
    'Steakhouse Financial': 'Steakhouse',
    'UltraYield by Edge': 'UltraYield',
    'Varlamore Capital': 'Varlamore',
    'Block Analitica': 'Block Anal.',
  };
  if (shortNames[name]) return shortNames[name];
  if (name.length > 14) return name.slice(0, 12) + '...';
  return name;
}
