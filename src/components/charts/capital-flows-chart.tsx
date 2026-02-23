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
    const data = curators
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
      .filter(d => Math.abs(d.flow) > 1000)
      .sort((a, b) => b.flow - a.flow)
      .slice(0, 12);
    return data;
  }, [curators, period]);

  // Find the biggest mover by absolute flow
  const biggestMover = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((max, d) => Math.abs(d.flow) > Math.abs(max.flow) ? d : max, chartData[0]);
  }, [chartData]);

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
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Capital Movement</p>
            <div className="flex items-center gap-3">
              <CardTitle>Where&apos;s the Money Going?</CardTitle>
              {biggestMover && (
                <span className="text-[11px] text-gray-400 hidden lg:inline">
                  Biggest mover:{' '}
                  <span className={`font-mono font-medium ${biggestMover.flow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {biggestMover.fullName} ({formatFlow(biggestMover.flow)})
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5 border border-gray-200">
              {(['7d', '30d'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium rounded-full transition-all ${
                    period === p
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-400 hidden sm:inline">Click bar for details</span>
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
              <defs>
                <linearGradient id="flowGradientPos" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="flowGradientNeg" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis
                type="number"
                domain={domain}
                tickFormatter={(v) => formatTvl(v, true)}
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
                width={100}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine x={0} stroke="#E5E7EB" strokeDasharray="3 6" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isPositive = data.flow >= 0;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white backdrop-blur-sm p-3 shadow-lg min-w-[200px]">
                        <p className="font-medium text-gray-900 text-[14px] mb-2">{data.fullName}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Net Flow ({period})</span>
                            <span className={`font-mono ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatFlow(data.flow)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">% of TVL</span>
                            <span className={`font-mono ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {data.flowPercent >= 0 ? '+' : ''}{data.flowPercent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-gray-200">
                            <span className="text-gray-500">Current TVL</span>
                            <span className="font-mono text-gray-700">{formatTvl(data.tvl)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }}
              />
              <Bar
                dataKey="flow"
                radius={[6, 6, 6, 6]}
                maxBarSize={24}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.flow >= 0 ? 'url(#flowGradientPos)' : 'url(#flowGradientNeg)'}
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
