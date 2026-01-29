'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl } from '@/lib/utils';
import { CURATOR_COLORS, FALLBACK_CURATOR_COLORS } from '@/lib/colors';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

interface HistoricalDataPoint {
  date: number;
  tvl: number;
}

interface CuratorData {
  name: string;
  slug: string;
  color: string;
  data: HistoricalDataPoint[];
}

interface CuratorComparisonChartProps {
  curators: CuratorData[];
  title?: string;
  height?: number;
}

export function CuratorComparisonChart({
  curators,
  title = 'Curator TVL Comparison',
  height = 350,
}: CuratorComparisonChartProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [hiddenCurators, setHiddenCurators] = useState<Set<string>>(new Set());

  // Merge all curator data into unified timeline
  const chartData = useMemo(() => {
    if (curators.length === 0) return [];

    // Get period cutoff
    const now = Date.now() / 1000;
    const periodSeconds: Record<Period, number> = {
      '7d': 7 * 24 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
      '90d': 90 * 24 * 60 * 60,
      '1y': 365 * 24 * 60 * 60,
      'all': Infinity,
    };
    const cutoff = period === 'all' ? 0 : now - periodSeconds[period];

    // Collect all unique dates
    const allDates = new Set<number>();
    curators.forEach(curator => {
      curator.data
        .filter(d => d.date >= cutoff)
        .forEach(d => allDates.add(d.date));
    });

    // Sort dates
    const sortedDates = Array.from(allDates).sort((a, b) => a - b);

    // Sample dates if too many (for performance)
    const maxPoints = 100;
    const step = Math.max(1, Math.floor(sortedDates.length / maxPoints));
    const sampledDates = sortedDates.filter((_, i) => i % step === 0);

    // Build merged data
    return sampledDates.map(date => {
      const point: Record<string, number> = { date: date * 1000 };

      curators.forEach(curator => {
        // Find closest data point for this curator
        const curatorFiltered = curator.data.filter(d => d.date >= cutoff);
        const closest = curatorFiltered.reduce((prev, curr) => {
          return Math.abs(curr.date - date) < Math.abs(prev.date - date) ? curr : prev;
        }, curatorFiltered[0]);

        if (closest && Math.abs(closest.date - date) < 24 * 60 * 60 * 2) {
          point[curator.slug] = closest.tvl;
        }
      });

      return point;
    });
  }, [curators, period]);

  const toggleCurator = (slug: string) => {
    setHiddenCurators(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    if (period === '7d') {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    if (period === '30d' || period === '90d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (curators.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-zinc-500 text-[14px]">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-1">
            {(['7d', '30d', '90d', '1y', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
                  period === p
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p === 'all' ? 'All' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {curators.map((curator, index) => {
            const color = CURATOR_COLORS[curator.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length];
            const isHidden = hiddenCurators.has(curator.slug);
            return (
              <button
                key={curator.slug}
                onClick={() => toggleCurator(curator.slug)}
                className={`flex items-center gap-2 px-2 py-1 rounded text-[12px] transition-all ${
                  isHidden ? 'opacity-40' : 'opacity-100'
                } hover:bg-zinc-800`}
              >
                <div
                  className="w-3 h-0.5 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="text-zinc-300">{curator.name}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0 pr-4 pb-4">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={50}
              />
              <YAxis
                tickFormatter={(value) => formatTvl(value)}
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length && label) {
                    return (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl min-w-[180px]">
                        <p className="text-[12px] text-zinc-500 mb-2">
                          {new Date(label as number).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <div className="space-y-1">
                          {payload
                            .filter(p => p.value !== undefined)
                            .sort((a, b) => (b.value as number) - (a.value as number))
                            .map((entry) => {
                              const curator = curators.find(c => c.slug === entry.dataKey);
                              return (
                                <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-[12px] text-zinc-400">
                                      {curator?.name || entry.dataKey}
                                    </span>
                                  </div>
                                  <span className="text-[12px] font-mono text-white">
                                    {formatTvl(entry.value as number)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {curators.map((curator, index) => {
                const color = CURATOR_COLORS[curator.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length];
                const isHidden = hiddenCurators.has(curator.slug);
                return (
                  <Line
                    key={curator.slug}
                    type="monotone"
                    dataKey={curator.slug}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    hide={isHidden}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
