'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, cn } from '@/lib/utils';
import { PROTOCOL_COLORS, FALLBACK_CURATOR_COLORS } from '@/lib/colors';
import { ProtocolIcon } from '@/components/ui/protocol-icon';
import type { ProtocolTVL } from '@/types';

interface TvlByProtocolChartProps {
  data: ProtocolTVL[];
}

export function TvlByProtocolChart({ data }: TvlByProtocolChartProps) {
  const chartData = data.slice(0, 8).map((item, index) => ({
    name: item.name,
    value: item.tvl,
    change: item.change24h,
    color: PROTOCOL_COLORS[item.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length],
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Breakdown</p>
        <CardTitle>TVL by Protocol</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
          <div className="h-[200px] w-[200px] mx-auto flex-shrink-0 relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Total</span>
              <span className="text-[16px] font-semibold text-gray-900" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
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
                        <div className="rounded-lg border border-gray-200 bg-white backdrop-blur-sm px-3 py-2 shadow-lg">
                          <p className="text-[13px] text-gray-900">{data.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-mono text-gray-500">{formatTvl(data.value)}</span>
                            <span className={`text-[11px] font-mono ${data.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {data.change >= 0 ? '+' : ''}{data.change.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1">
            {chartData.map((item, index) => {
              const pct = (item.value / total) * 100;
              return (
                <div
                  key={item.name}
                  className={cn(
                    'flex items-center gap-3 py-1.5 px-2 rounded-lg',
                    index % 2 === 1 && 'bg-gray-50/70'
                  )}
                >
                  <ProtocolIcon name={item.name} size={18} />
                  <span className="text-[13px] text-gray-700 min-w-[120px]">{item.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-[13px] font-mono text-gray-900 min-w-[70px] text-right">{formatTvl(item.value)}</span>
                  <span className="text-[11px] text-gray-400 min-w-[40px] text-right">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
