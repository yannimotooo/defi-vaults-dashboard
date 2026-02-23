'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, formatFlow } from '@/lib/utils';
import { getCuratorColor } from '@/lib/colors';
import type { Curator } from '@/types';

interface CapitalFlowsChartProps {
  curators: Curator[];
}

type Period = '7d' | '30d';

export function CapitalFlowsChart({ curators }: CapitalFlowsChartProps) {
  const [period, setPeriod] = useState<Period>('7d');
  const router = useRouter();

  const chartData = useMemo(() => {
    return curators
      .map((c, i) => {
        const flow = period === '7d' ? c.netFlow7d : c.netFlow30d;
        return {
          name: formatName(c.name),
          fullName: c.name,
          slug: c.slug,
          flow,
          tvl: c.totalTvl,
          flowPercent: c.totalTvl > 0 ? (flow / c.totalTvl) * 100 : 0,
          color: getCuratorColor(c.name, i),
        };
      })
      .filter(d => Math.abs(d.flow) > 1000) // filter out noise
      .sort((a, b) => b.flow - a.flow)
      .slice(0, 12);
  }, [curators, period]);

  const handleBarClick = (data: unknown) => {
    const item = data as { slug?: string };
    if (item?.slug) {
      router.push(`/curator/${item.slug}`);
    }
  };

  if (chartData.length === 0) {
    return null;
  }

  // Find the max absolute value for symmetric axis
  const maxAbs = Math.max(...chartData.map(d => Math.abs(d.flow)));
  const domain = [-maxAbs * 1.1, maxAbs * 1.1];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1">Capital Movement</p>
            <CardTitle>Where&apos;s the Money Going?</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-[#141922] rounded-full p-0.5 border border-[#2d3548]/50">
              {(['7d', '30d'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium rounded-full transition-all ${
                    period === p
                      ? 'bg-[#2d3548] text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-600 hidden sm:inline">Click bar for details</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pr-2 sm:pr-5 pb-5">
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
              barCategoryGap="18%"
            >
              <XAxis
                type="number"
                domain={domain}
                tickFormatter={(v) => formatTvl(v, true)}
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
              <ReferenceLine x={0} stroke="#2d3548" strokeDasharray="3 6" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isPositive = data.flow >= 0;
                    return (
                      <div className="rounded-lg border border-[#2d3548]/60 bg-[#1a1f2e]/95 backdrop-blur-sm p-3 shadow-xl min-w-[200px]">
                        <p className="font-medium text-white text-[14px] mb-2">{data.fullName}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Net Flow ({period})</span>
                            <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatFlow(data.flow)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">% of TVL</span>
                            <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {data.flowPercent >= 0 ? '+' : ''}{data.flowPercent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-slate-700/40">
                            <span className="text-slate-500">Current TVL</span>
                            <span className="font-mono text-slate-300">{formatTvl(data.tvl)}</span>
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
                dataKey="flow"
                radius={[4, 4, 4, 4]}
                maxBarSize={24}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.flow >= 0 ? '#10B981' : '#EF4444'}
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
