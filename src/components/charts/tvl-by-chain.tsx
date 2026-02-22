'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl } from '@/lib/utils';
import { CHAIN_COLORS, FALLBACK_CURATOR_COLORS } from '@/lib/colors';
import { ChainIcon } from '@/components/ui/protocol-icon';
import type { ChainTVL } from '@/types';

interface TvlByChainChartProps {
  data: ChainTVL[];
}

export function TvlByChainChart({ data }: TvlByChainChartProps) {
  const chartData = data.slice(0, 6).map((item, index) => ({
    name: item.chain,
    value: item.tvl,
    color: CHAIN_COLORS[item.chain] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length],
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1">Distribution</p>
        <CardTitle>TVL by Chain</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="h-[180px] w-[180px] sm:h-[200px] sm:w-[200px] flex-shrink-0 relative">
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Total</span>
              <span className="text-[16px] font-semibold text-white" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                {formatTvl(total)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-[#2d3548]/60 bg-[#1a1f2e]/95 backdrop-blur-sm px-3 py-2 shadow-xl">
                          <p className="text-[13px] text-white">{data.name}</p>
                          <p className="text-[13px] font-mono text-slate-400">{formatTvl(data.value)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChainIcon name={item.name} size={14} />
                  <span className="text-[13px] text-slate-300">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[13px] font-mono text-white">{formatTvl(item.value)}</span>
                  <span className="text-[11px] text-slate-600 ml-2">
                    {((item.value / total) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
