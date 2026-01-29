'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl } from '@/lib/utils';
import { CHAIN_COLORS, FALLBACK_CURATOR_COLORS } from '@/lib/colors';
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
        <CardTitle>TVL by Chain</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          <div className="h-[200px] w-[200px] flex-shrink-0">
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
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                          <p className="text-[13px] text-white">{data.name}</p>
                          <p className="text-[13px] font-mono text-zinc-400">{formatTvl(data.value)}</p>
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
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[13px] text-zinc-300">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[13px] font-mono text-white">{formatTvl(item.value)}</span>
                  <span className="text-[11px] text-zinc-600 ml-2">
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
