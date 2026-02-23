'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Curator } from '@/types';

interface FeeTaxChartProps {
  curators: Curator[];
}

type SortBy = 'feeImpact' | 'grossApy';

export function FeeTaxChart({ curators }: FeeTaxChartProps) {
  const [sortBy, setSortBy] = useState<SortBy>('feeImpact');
  const router = useRouter();

  const chartData = useMemo(() => {
    const withFees = curators
      .filter(c => c.grossApy !== undefined && c.grossApy > 0 && c.netApy !== undefined)
      .map(c => {
        const grossApy = c.grossApy!;
        const netApy = c.netApy!;
        const perfFeePct = c.avgPerformanceFee || 0;
        const mgmtFeePct = c.avgManagementFee || 0;

        // Performance fee takes X% of yield
        const perfFeeImpact = grossApy * (perfFeePct / 100);
        // Management fee is flat annual fee on TVL (already in APY terms)
        const mgmtFeeImpact = mgmtFeePct;
        // Use actual net APY from the data for accuracy
        const actualNetApy = Math.max(0, netApy);

        return {
          name: formatName(c.name),
          fullName: c.name,
          slug: c.slug,
          netApy: actualNetApy,
          perfFeeImpact: Math.max(0, perfFeeImpact),
          mgmtFeeImpact: Math.max(0, mgmtFeeImpact),
          grossApy,
          perfFeePct,
          mgmtFeePct,
          feeRatio: grossApy > 0 ? ((grossApy - actualNetApy) / grossApy) * 100 : 0,
          tvl: c.totalTvl,
        };
      });

    if (sortBy === 'feeImpact') {
      withFees.sort((a, b) => b.feeRatio - a.feeRatio);
    } else {
      withFees.sort((a, b) => b.grossApy - a.grossApy);
    }

    return withFees.slice(0, 10);
  }, [curators, sortBy]);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1">Fee Economics</p>
            <CardTitle>The Fee Tax</CardTitle>
          </div>
          <div className="flex gap-0.5 bg-[#141922] rounded-full p-0.5 border border-[#2d3548]/50">
            {([
              { key: 'feeImpact' as SortBy, label: 'By Fee %' },
              { key: 'grossApy' as SortBy, label: 'By APY' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium rounded-full transition-all ${
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
                    return (
                      <div className="rounded-lg border border-[#2d3548]/60 bg-[#1a1f2e]/95 backdrop-blur-sm p-3 shadow-xl min-w-[220px]">
                        <p className="font-medium text-white text-[14px] mb-2">{data.fullName}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Gross APY</span>
                            <span className="font-mono text-white">{data.grossApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-500">- Perf Fee ({data.perfFeePct.toFixed(0)}%)</span>
                            <span className="font-mono text-amber-400">-{data.perfFeeImpact.toFixed(2)}%</span>
                          </div>
                          {data.mgmtFeeImpact > 0 && (
                            <div className="flex justify-between">
                              <span className="text-red-500">- Mgmt Fee</span>
                              <span className="font-mono text-red-400">-{data.mgmtFeeImpact.toFixed(2)}%</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1.5 border-t border-slate-700/40">
                            <span className="text-emerald-500">Net APY</span>
                            <span className="font-mono text-emerald-400">{data.netApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Fee Ratio</span>
                            <span className="font-mono text-slate-400">{data.feeRatio.toFixed(1)}% of yield</span>
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
                      <span className="text-slate-400">Net Yield</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                      <span className="text-slate-400">Perf Fee</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                      <span className="text-slate-400">Mgmt Fee</span>
                    </span>
                  </div>
                )}
              />
              <Bar
                dataKey="netApy"
                stackId="a"
                fill="#10B981"
                radius={[0, 0, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              />
              <Bar
                dataKey="perfFeeImpact"
                stackId="a"
                fill="#F59E0B"
                radius={[0, 0, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              />
              <Bar
                dataKey="mgmtFeeImpact"
                stackId="a"
                fill="#EF4444"
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
