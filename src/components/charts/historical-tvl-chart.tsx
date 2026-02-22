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

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

interface HistoricalDataPoint {
  date: number; // Unix timestamp in seconds
  tvl: number;
}

interface HistoricalTvlChartProps {
  data: HistoricalDataPoint[];
  title?: string;
  color?: string;
  showPeriodSelector?: boolean;
  height?: number;
}

export function HistoricalTvlChart({
  data,
  title = 'TVL Over Time',
  color = '#6366f1',
  showPeriodSelector = true,
  height = 300,
}: HistoricalTvlChartProps) {
  const [period, setPeriod] = useState<Period>('30d');

  const filteredData = useMemo(() => {
    if (period === 'all' || data.length === 0) return data;

    const now = Date.now() / 1000;
    const periodSeconds: Record<Period, number> = {
      '7d': 7 * 24 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
      '90d': 90 * 24 * 60 * 60,
      '1y': 365 * 24 * 60 * 60,
      'all': Infinity,
    };

    const cutoff = now - periodSeconds[period];
    return data.filter(point => point.date >= cutoff);
  }, [data, period]);

  const chartData = useMemo(() => {
    return filteredData.map(point => ({
      date: point.date * 1000, // Convert to milliseconds for JS Date
      tvl: point.tvl,
    }));
  }, [filteredData]);

  // Calculate stats
  const stats = useMemo(() => {
    if (chartData.length < 2) return null;

    const latest = chartData[chartData.length - 1]?.tvl || 0;
    const first = chartData[0]?.tvl || 0;
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;
    const max = Math.max(...chartData.map(d => d.tvl));
    const min = Math.min(...chartData.map(d => d.tvl));

    return { latest, change, max, min };
  }, [chartData]);

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

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-slate-500 text-[14px]">
            No historical data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {stats && (
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[24px] font-semibold text-white font-mono">
                  {formatTvl(stats.latest)}
                </span>
                <span
                  className={`text-[14px] font-mono ${
                    stats.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {stats.change >= 0 ? '+' : ''}
                  {stats.change.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          {showPeriodSelector && (
            <div className="flex gap-1 bg-slate-800/40 rounded-lg p-1">
              {(['7d', '30d', '90d', '1y', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all ${
                    period === p
                      ? 'bg-slate-700/80 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p === 'all' ? 'All' : p.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 pr-4 pb-4">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={50}
              />
              <YAxis
                tickFormatter={(value) => formatTvl(value)}
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-slate-700/40 bg-[#111827]/90 backdrop-blur-sm px-3 py-2 shadow-xl">
                        <p className="text-[12px] text-slate-500 mb-1">
                          {new Date(data.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-[14px] font-mono text-white">
                          {formatTvl(data.tvl)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="tvl"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${color.replace('#', '')})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
