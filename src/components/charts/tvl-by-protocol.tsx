'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, cn } from '@/lib/utils';
import { PROTOCOL_COLORS, FALLBACK_CURATOR_COLORS } from '@/lib/colors';
import type { ProtocolTVL } from '@/types';

interface TvlByProtocolChartProps {
  data: ProtocolTVL[];
}

export function TvlByProtocolChart({ data }: TvlByProtocolChartProps) {
  const chartData = data.slice(0, 8).map((item, index) => ({
    name: item.name.length > 14 ? item.name.slice(0, 12) + '...' : item.name,
    fullName: item.name,
    tvl: item.tvl,
    change: item.change24h,
    color: PROTOCOL_COLORS[item.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>TVL by Protocol</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pr-5 pb-5">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(value) => formatTvl(value)}
                stroke="#3f3f46"
                fontSize={11}
                fontFamily="monospace"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#71717a"
                fontSize={13}
                width={110}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                        <p className="text-[13px] text-white mb-1">{data.fullName}</p>
                        <p className="text-[13px] font-mono text-zinc-400">{formatTvl(data.tvl)}</p>
                        <p className={cn(
                          'text-[12px] font-mono',
                          data.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
              />
              <Bar dataKey="tvl" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
