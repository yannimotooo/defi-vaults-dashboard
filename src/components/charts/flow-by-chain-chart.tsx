'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatTvl, formatFlow } from '@/lib/utils';
import { getChainColor } from '@/lib/colors';
import { computeChainFlows } from '@/lib/flow-analysis';
import type { Curator, VaultData } from '@/types';

interface FlowByChainChartProps {
  curators: Curator[];
  vaults: VaultData[];
}

export function FlowByChainChart({ curators, vaults }: FlowByChainChartProps) {
  const chartData = useMemo(() => {
    return computeChainFlows(curators, vaults).slice(0, 10).map(d => ({
      ...d,
      color: getChainColor(d.name),
    }));
  }, [curators, vaults]);

  if (chartData.length === 0) {
    return <EmptyStateCard title="Flows by Chain" message="No chain flow data available." />;
  }

  const maxAbs = Math.max(...chartData.map(d => Math.abs(d.flow7d)));
  const domain = [-maxAbs * 1.1, maxAbs * 1.1];

  return (
    <Card>
      <CardHeader>
        <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Chain Flows</p>
        <CardTitle>Where Capital is Moving</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pr-2 sm:pr-5 pb-5">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
              barCategoryGap="18%"
            >
              <defs>
                <linearGradient id="chainFlowPos" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="chainFlowNeg" x1="1" y1="0" x2="0" y2="0">
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
                width={80}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine x={0} stroke="#E5E7EB" strokeDasharray="3 6" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg min-w-[200px]">
                        <p className="font-medium text-gray-900 text-[14px] mb-2">{data.name}</p>
                        <div className="space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-gray-500">7d Flow</span>
                            <span className={`font-mono ${data.flow7d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatFlow(data.flow7d)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">30d Flow</span>
                            <span className={`font-mono ${data.flow30d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatFlow(data.flow30d)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-gray-200">
                            <span className="text-gray-500">TVL</span>
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
              <Bar dataKey="flow7d" radius={[6, 6, 6, 6]} maxBarSize={24}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.flow7d >= 0 ? 'url(#chainFlowPos)' : 'url(#chainFlowNeg)'}
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
