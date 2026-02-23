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
      .filter(c =>
        (c.grossApy !== undefined && c.grossApy > 0) ||
        (c.avgPerformanceFee !== undefined && c.avgPerformanceFee > 0) ||
        (c.avgManagementFee !== undefined && c.avgManagementFee > 0)
      )
      .map(c => {
        const perfFeePct = c.avgPerformanceFee || 0;
        const mgmtFeePct = c.avgManagementFee || 0;

        // Use grossApy if available, otherwise estimate from avgApy + fees
        const grossApy = c.grossApy && c.grossApy > 0
          ? c.grossApy
          : c.avgApy > 0 && perfFeePct > 0
            ? c.avgApy / (1 - perfFeePct / 100) + mgmtFeePct
            : c.avgApy + (c.avgApy * perfFeePct / 100) + mgmtFeePct;
        const netApy = c.netApy !== undefined ? c.netApy : c.avgApy;

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
      })
      .filter(d => d.grossApy > 0.01 || d.netApy > 0.01); // Exclude empty bars

    if (sortBy === 'feeImpact') {
      withFees.sort((a, b) => b.feeRatio - a.feeRatio);
    } else {
      withFees.sort((a, b) => b.grossApy - a.grossApy);
    }

    return withFees.slice(0, 10);
  }, [curators, sortBy]);

  // TVL-weighted average fee ratio across all curators with fee data
  const avgFeeRatio = useMemo(() => {
    const withFeeData = curators.filter(
      c => c.grossApy !== undefined && c.grossApy > 0 && c.avgPerformanceFee !== undefined,
    );
    if (withFeeData.length === 0) return 0;

    let totalTvl = 0;
    let weightedFeeRatio = 0;

    for (const c of withFeeData) {
      const grossApy = c.grossApy || 0;
      const netApy = c.netApy !== undefined ? c.netApy : c.avgApy;
      const feeRatio = grossApy > 0 ? ((grossApy - netApy) / grossApy) * 100 : 0;
      weightedFeeRatio += feeRatio * c.totalTvl;
      totalTvl += c.totalTvl;
    }

    return totalTvl > 0 ? weightedFeeRatio / totalTvl : 0;
  }, [curators]);

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
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Fee Economics</p>
            <div className="flex items-center gap-2.5">
              <CardTitle>Curator Fees</CardTitle>
              {avgFeeRatio > 0 && (
                <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                  Avg: {avgFeeRatio.toFixed(1)}% of yield
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5 border border-gray-200">
            {([
              { key: 'feeImpact' as SortBy, label: 'By Fee %' },
              { key: 'grossApy' as SortBy, label: 'By APY' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium rounded-full transition-all ${
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
              <defs>
                <linearGradient id="feeGradientNet" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="feeGradientPerf" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="feeGradientMgmt" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={1} />
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
                width={90}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white backdrop-blur-sm p-3 shadow-lg min-w-[220px]">
                        <p className="font-medium text-gray-900 text-[14px] mb-2">{data.fullName}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Gross APY</span>
                            <span className="font-mono text-gray-900">{data.grossApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-600">- Perf Fee ({data.perfFeePct.toFixed(0)}%)</span>
                            <span className="font-mono text-amber-600">-{data.perfFeeImpact.toFixed(2)}%</span>
                          </div>
                          {data.mgmtFeeImpact > 0 && (
                            <div className="flex justify-between">
                              <span className="text-red-600">- Mgmt Fee</span>
                              <span className="font-mono text-red-600">-{data.mgmtFeeImpact.toFixed(2)}%</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1.5 border-t border-gray-200">
                            <span className="text-emerald-600">Net APY</span>
                            <span className="font-mono text-emerald-600">{data.netApy.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Fee Ratio</span>
                            <span className="font-mono text-gray-500">{data.feeRatio.toFixed(1)}% of yield</span>
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
                  <div className="flex items-center justify-center gap-4 mt-2 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span className="text-gray-500">Net Yield</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                      <span className="text-gray-500">Perf Fee</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                      <span className="text-gray-500">Mgmt Fee</span>
                    </span>
                  </div>
                )}
              />
              <Bar
                dataKey="netApy"
                stackId="a"
                fill="url(#feeGradientNet)"
                radius={[0, 0, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              />
              <Bar
                dataKey="perfFeeImpact"
                stackId="a"
                fill="url(#feeGradientPerf)"
                radius={[0, 0, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(data) => handleBarClick(data)}
              />
              <Bar
                dataKey="mgmtFeeImpact"
                stackId="a"
                fill="url(#feeGradientMgmt)"
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
