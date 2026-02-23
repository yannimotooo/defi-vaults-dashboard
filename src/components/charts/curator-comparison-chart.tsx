'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
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
          <div className="h-[200px] flex items-center justify-center text-gray-500 text-[14px]">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Historical</p>
            <CardTitle>{title}</CardTitle>
          </div>
          <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5 border border-gray-200">
            {(['7d', '30d', '90d', '1y', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium rounded-full transition-all ${
                  period === p
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'all' ? 'ALL' : p.toUpperCase()}
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
                className={`flex items-center gap-2 px-2 py-1 rounded-md text-[12px] transition-all ${
                  isHidden ? 'opacity-40' : 'opacity-100'
                } hover:bg-gray-100`}
              >
                <div
                  className="w-3 h-0.5 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-700">{curator.name}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0 pr-2 sm:pr-4 pb-4">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <defs>
                {curators.map((curator, index) => {
                  const color = CURATOR_COLORS[curator.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length];
                  return (
                    <linearGradient key={curator.slug} id={`gradient-${curator.slug}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={50}
              />
              <YAxis
                tickFormatter={(value) => formatTvl(value)}
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length && label) {
                    return (
                      <div className="rounded-xl border border-gray-200 bg-white backdrop-blur-xl px-4 py-3 shadow-lg min-w-[200px]">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
                          {new Date(label as number).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <div className="space-y-1.5">
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
                                    <span className="text-[12px] text-gray-500">
                                      {curator?.name || entry.dataKey}
                                    </span>
                                  </div>
                                  <span className="text-[12px] text-gray-900" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
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
                  <Area
                    key={curator.slug}
                    type="monotone"
                    dataKey={curator.slug}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#gradient-${curator.slug})`}
                    dot={false}
                    hide={isHidden}
                    connectNulls
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
