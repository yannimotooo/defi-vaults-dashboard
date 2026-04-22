'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, formatCuratorShortName } from '@/lib/utils';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import type { Curator, VaultData } from '@/types';

interface RealVsFarmedChartProps {
  vaults: VaultData[];
  curators: Curator[];
  hideWhenEmpty?: boolean;
}

type SortBy = 'tvl' | 'organicPct' | 'totalApy';

export function RealVsFarmedChart({ vaults, curators, hideWhenEmpty }: RealVsFarmedChartProps) {
  const [sortBy, setSortBy] = useState<SortBy>('tvl');
  const router = useRouter();

  const { chartData, overallOrganicPct } = useMemo(() => {
    // Build a set of known curator names so we can filter out bogus
    // attributions like "EVK Vault" (technical vault names from poolMeta).
    const knownCuratorNames = new Set(curators.map(c => c.name));
    const slugLookup = new Map<string, string>();
    for (const c of curators) {
      slugLookup.set(c.name, c.slug);
    }

    // Group vaults by curator — only if the curator is actually known
    const curatorVaults = new Map<string, VaultData[]>();
    for (const vault of vaults) {
      if (!vault.curator || vault.isRawMarket || vault.curator === 'Unknown') continue;
      // Skip vaults whose "curator" is actually a technical name, not a real curator
      if (!knownCuratorNames.has(vault.curator)) continue;
      const key = vault.curator;
      if (!curatorVaults.has(key)) curatorVaults.set(key, []);
      curatorVaults.get(key)!.push(vault);
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
        name: formatCuratorShortName(curatorName),
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
      filtered.sort((a, b) => b.organicPercent - a.organicPercent); // highest organic first
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

  const totalCurators = useMemo(() => {
    const curatorVaults = new Map<string, boolean>();
    for (const vault of vaults) {
      if (vault.curator && !vault.isRawMarket && vault.curator !== 'Unknown') {
        curatorVaults.set(vault.curator, true);
      }
    }
    return curatorVaults.size;
  }, [vaults]);

  if (chartData.length === 0) {
    return hideWhenEmpty ? null : <EmptyStateCard title="Yield Quality" message="No vault yield data available for analysis." />;
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Yield Quality</p>
              <div className="flex items-center gap-2">
              <CardTitle>Real vs Farmed Yield</CardTitle>
              {totalCurators > chartData.length && (
                <span className="text-[10px] text-gray-400">
                  Showing {chartData.length} of {totalCurators}
                </span>
              )}
            </div>
            </div>
            <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5 border border-gray-200">
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
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Summary headline */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(overallOrganicPct, 100)}%` }}
              />
            </div>
            <span className="text-[12px] font-mono text-emerald-600 whitespace-nowrap">
              {overallOrganicPct.toFixed(0)}% organic
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 pr-2 sm:pr-5 pb-4">
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
              barCategoryGap="14%"
            >
              <defs>
                <linearGradient id="yieldGradientOrganic" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="yieldGradientFarmed" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis
                type="number"
                tickFormatter={(v) => `${v.toFixed(1)}%`}
                stroke="#D1D5DB"
                fontSize={11}
                fontFamily="var(--font-jetbrains-mono), monospace"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6B7280"
                fontSize={11}
                width={105}
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={(props: { x?: string | number; y?: string | number; payload?: { value: string } }) => {
                  const x = Number(props.x || 0);
                  const y = Number(props.y || 0);
                  const payload = props.payload || { value: '' };
                  const entry = chartData.find(d => d.name === payload.value);
                  const pct = entry?.organicPercent || 0;
                  const dotColor = pct >= 60 ? '#10B981' : pct >= 30 ? '#F59E0B' : '#EF4444';
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <circle cx={-6} cy={0} r={3} fill={dotColor} />
                      <text x={-14} y={0} dy={4} textAnchor="end" fill="#6B7280" fontSize={11}>
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const orgColor = data.organicPercent >= 60 ? 'text-emerald-600' : data.organicPercent >= 30 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white backdrop-blur-sm p-3 shadow-lg min-w-[220px]">
                        <p className="font-medium text-gray-900 text-[14px] mb-2">{data.fullName}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-emerald-600">Organic Yield</span>
                            <span className="font-mono text-emerald-600">{data.organicApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-violet-600">Incentive Yield</span>
                            <span className="font-mono text-violet-600">{data.farmedApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-gray-200">
                            <span className="text-gray-500">Total APY</span>
                            <span className="font-mono text-gray-900">{data.totalApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Organic Share</span>
                            <span className={`font-mono ${orgColor}`}>{data.organicPercent.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-gray-200">
                            <span className="text-gray-500">Vaults</span>
                            <span className="font-mono text-gray-700">{data.vaultCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">TVL</span>
                            <span className="font-mono text-gray-700">{formatTvl(data.totalTvl)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }}
              />
              <Legend
                content={() => (
                  <div className="flex items-center justify-center gap-3 sm:gap-4 mt-2 text-[11px] flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span className="text-gray-500">Organic (base)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                      <span className="text-gray-500">Incentives</span>
                    </span>
                    <span className="text-gray-300 hidden sm:inline">|</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-gray-400">≥60%</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-gray-400">30-60%</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-gray-400">&lt;30%</span>
                    </span>
                  </div>
                )}
              />
              <Bar
                dataKey="organicApy"
                stackId="yield"
                fill="url(#yieldGradientOrganic)"
                radius={[0, 0, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              />
              <Bar
                dataKey="farmedApy"
                stackId="yield"
                fill="url(#yieldGradientFarmed)"
                radius={[0, 6, 6, 0]}
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

