'use client';

import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl } from '@/lib/utils';
import { CURATOR_COLORS, FALLBACK_CURATOR_COLORS } from '@/lib/colors';
import type { Curator } from '@/types';

interface CuratorTvlChartProps {
  curators: Curator[];
}

export function CuratorTvlChart({ curators }: CuratorTvlChartProps) {
  const router = useRouter();

  const chartData = curators.slice(0, 10).map((curator, index) => ({
    name: formatCuratorNameForChart(curator.name),
    fullName: curator.name,
    slug: curator.slug,
    tvl: curator.totalTvl,
    apy: curator.avgApy,
    vaults: curator.vaultCount,
    chains: curator.chains,
    protocols: curator.protocols,
    rank: index + 1,
    color: CURATOR_COLORS[curator.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length],
  }));

  const handleBarClick = (data: unknown) => {
    const item = data as { slug?: string };
    if (item?.slug) {
      router.push(`/curator/${item.slug}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1">Rankings</p>
            <CardTitle>Top Curators by TVL</CardTitle>
          </div>
          <span className="text-[11px] text-slate-600">Click bar for details</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 pr-2 sm:pr-5 pb-5">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <XAxis
                type="number"
                tickFormatter={(value) => formatTvl(value)}
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
                width={100}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-[#2d3548]/60 bg-[#1a1f2e]/95 backdrop-blur-sm p-3 shadow-xl min-w-[200px]">
                        <p className="font-medium text-white text-[14px] mb-2">{data.fullName}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">TVL</span>
                            <span className="font-mono text-white">{formatTvl(data.tvl)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">APY</span>
                            <span className="font-mono text-emerald-400">{data.apy.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Vaults</span>
                            <span className="font-mono text-slate-300">{data.vaults}</span>
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-700/40">
                            <div className="flex flex-wrap gap-1">
                              {data.chains.slice(0, 4).map((chain: string) => (
                                <span key={chain} className="text-[11px] text-slate-400">
                                  {chain}
                                </span>
                              ))}
                              {data.chains.length > 4 && (
                                <span className="text-[11px] text-slate-500">+{data.chains.length - 4}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
              />
              <Bar
                dataKey="tvl"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCuratorNameForChart(name: string): string {
  const shortNames: Record<string, string> = {
    'Steakhouse Financial': 'Steakhouse',
    'UltraYield by Edge': 'UltraYield',
    'Varlamore Capital': 'Varlamore',
  };

  if (shortNames[name]) return shortNames[name];
  if (name.length > 14) return name.slice(0, 12) + '...';
  return name;
}
