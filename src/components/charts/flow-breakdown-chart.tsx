'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatTvl } from '@/lib/utils';
import { computeFlowBreakdown } from '@/lib/flow-analysis';
import type { Curator, VaultData } from '@/types';

interface FlowBreakdownChartProps {
  curators: Curator[];
  vaults: VaultData[];
}

export function FlowBreakdownChart({ curators, vaults }: FlowBreakdownChartProps) {
  const chartData = useMemo(() => {
    return computeFlowBreakdown(curators, vaults).slice(0, 8);
  }, [curators, vaults]);

  if (chartData.length === 0) {
    return <EmptyStateCard title="Flow Direction Breakdown" message="Not enough vault data for breakdown analysis." />;
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Flow Direction</p>
          <CardTitle>Stablecoin vs Non-Stable Flows by Protocol</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 pr-2 sm:pr-5 pb-4">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ left: 0, right: 0, top: 10, bottom: 5 }}
              barCategoryGap="20%"
            >
              <defs>
                <linearGradient id="breakStableIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={1} />
                  <stop offset="50%" stopColor="#6366F1" stopOpacity={0.75} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="breakNonStableIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                  <stop offset="50%" stopColor="#10B981" stopOpacity={0.75} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="breakStableOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={1} />
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.75} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="breakNonStableOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
                  <stop offset="50%" stopColor="#EF4444" stopOpacity={0.75} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                stroke="#6B7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatTvl(v, true)}
                stroke="#D1D5DB"
                fontSize={11}
                fontFamily="var(--font-jetbrains-mono), monospace"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm p-3 shadow-lg min-w-[200px]">
                        <p className="font-medium text-gray-900 text-[14px] mb-2">{data.name}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-indigo-600">Stable Inflow</span>
                            <span className="font-mono text-indigo-600">{formatTvl(data.stablecoinInflow)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-600">Non-Stable In</span>
                            <span className="font-mono text-emerald-600">{formatTvl(data.nonStableInflow)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-600">Stable Outflow</span>
                            <span className="font-mono text-amber-600">{formatTvl(data.stablecoinOutflow)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-600">Non-Stable Out</span>
                            <span className="font-mono text-red-600">{formatTvl(data.nonStableOutflow)}</span>
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
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 text-[11px] flex-wrap">
                    <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/50">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Stable In
                    </span>
                    <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/50">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Non-Stable In
                    </span>
                    <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200/50">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Stable Out
                    </span>
                    <span className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200/50">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Non-Stable Out
                    </span>
                  </div>
                )}
              />
              <Bar dataKey="stablecoinInflow" stackId="inflow" fill="url(#breakStableIn)" radius={[0, 0, 0, 0]} maxBarSize={28} cursor="pointer" />
              <Bar dataKey="nonStableInflow" stackId="inflow" fill="url(#breakNonStableIn)" radius={[4, 4, 0, 0]} maxBarSize={28} cursor="pointer" />
              <Bar dataKey="stablecoinOutflow" stackId="outflow" fill="url(#breakStableOut)" radius={[0, 0, 0, 0]} maxBarSize={28} cursor="pointer" />
              <Bar dataKey="nonStableOutflow" stackId="outflow" fill="url(#breakNonStableOut)" radius={[4, 4, 0, 0]} maxBarSize={28} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
