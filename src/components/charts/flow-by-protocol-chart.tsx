'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatTvl, formatFlow } from '@/lib/utils';
import { getProtocolColor } from '@/lib/colors';
import { computeProtocolFlows } from '@/lib/flow-analysis';
import type { MarketOverview } from '@/types';

type Period = '7d' | '30d';

interface FlowByProtocolChartProps {
  overview: MarketOverview;
}

export function FlowByProtocolChart({ overview }: FlowByProtocolChartProps) {
  const [period, setPeriod] = useState<Period>('7d');

  const chartData = useMemo(() => {
    const flows = computeProtocolFlows(overview);
    return flows.slice(0, 10).map(d => ({
      ...d,
      flow: period === '7d' ? d.flow7d : d.flow30d,
      color: getProtocolColor(d.name),
    }));
  }, [overview, period]);

  if (chartData.length === 0) {
    return <EmptyStateCard title="Flows by Protocol" message="No protocol flow data available." />;
  }

  const maxAbs = Math.max(...chartData.map(d => Math.abs(d.flow)));
  const domain = [-maxAbs * 1.1, maxAbs * 1.1];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Protocol Flows</p>
            <CardTitle>Capital by Protocol</CardTitle>
          </div>
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
        </div>
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
                <linearGradient id="protoFlowPos" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="40%" stopColor="#10B981" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="protoFlowNeg" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.35} />
                  <stop offset="40%" stopColor="#EF4444" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={1} />
                </linearGradient>
                <filter id="protoBarShadow">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.06" />
                </filter>
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
                width={110}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine x={0} stroke="#D1D5DB" strokeWidth={1.5} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm p-3 shadow-lg min-w-[200px]">
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
              <Bar dataKey="flow" radius={[6, 6, 6, 6]} maxBarSize={24} cursor="pointer" style={{ filter: 'url(#protoBarShadow)' }}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.flow >= 0 ? 'url(#protoFlowPos)' : 'url(#protoFlowNeg)'}
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
