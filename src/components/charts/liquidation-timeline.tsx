'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatTvl } from '@/lib/utils';

interface DailyVolume {
  date: string;
  volume: number;
  count: number;
  badDebt: number;
  byProtocol: Record<string, number>;
}

interface LiquidationTimelineProps {
  data: DailyVolume[];
  showByProtocol?: boolean;
}

const PROTOCOL_COLORS: Record<string, string> = {
  Morpho: '#2470FF',
  Aave: '#B6509E',
  Euler: '#E04141',
  Spark: '#F97316',
  Kamino: '#13C4A3',
};

export function LiquidationTimeline({
  data,
  showByProtocol = true,
}: LiquidationTimelineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500">
        No liquidation data available
      </div>
    );
  }

  // Get all unique protocols across all days
  const allProtocols = new Set<string>();
  data.forEach(day => {
    Object.keys(day.byProtocol || {}).forEach(p => allProtocols.add(p));
  });
  const protocols = Array.from(allProtocols);

  // Format data for stacked bar chart
  const chartData = data.map(day => ({
    date: formatDate(day.date),
    ...day.byProtocol,
    total: day.volume,
    count: day.count,
    badDebt: day.badDebt,
  }));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;

    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
    const dayData = data.find(d => formatDate(d.date) === label);

    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
        <div className="text-zinc-400 text-sm mb-2">{label}</div>
        <div className="space-y-1">
          {payload.filter(p => p.value > 0).map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-zinc-300">{entry.name}</span>
              </div>
              <span className="font-mono text-zinc-200">
                {formatTvl(entry.value)}
              </span>
            </div>
          ))}
          <div className="border-t border-zinc-700 pt-1 mt-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Total</span>
              <span className="font-mono text-zinc-200 font-medium">
                {formatTvl(total)}
              </span>
            </div>
            {dayData && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Liquidations</span>
                  <span className="text-zinc-400">{dayData.count}</span>
                </div>
                {dayData.badDebt > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Bad Debt</span>
                    <span className="text-red-400 font-mono">
                      {formatTvl(dayData.badDebt)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickFormatter={(value) => formatTvl(value, true)}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          {showByProtocol && protocols.length > 1 && (
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => (
                <span className="text-zinc-400 text-sm">{value}</span>
              )}
            />
          )}
          {showByProtocol && protocols.length > 1 ? (
            // Stacked bars by protocol
            protocols.map((protocol) => (
              <Bar
                key={protocol}
                dataKey={protocol}
                stackId="volume"
                fill={PROTOCOL_COLORS[protocol] || '#71717a'}
                radius={protocol === protocols[protocols.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))
          ) : (
            // Single bar for total
            <Bar
              dataKey="total"
              fill="#2470FF"
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Summary stats cards
interface LiquidationStatsProps {
  volume24h: number;
  volume7d: number;
  count24h: number;
  count7d: number;
  badDebt7d: number;
}

export function LiquidationStats({
  volume24h,
  volume7d,
  count24h,
  count7d,
  badDebt7d,
}: LiquidationStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
        <div className="text-zinc-500 text-sm">24h Volume</div>
        <div className="text-2xl font-bold text-zinc-100 font-mono mt-1">
          {formatTvl(volume24h)}
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          {count24h} liquidations
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
        <div className="text-zinc-500 text-sm">7d Volume</div>
        <div className="text-2xl font-bold text-zinc-100 font-mono mt-1">
          {formatTvl(volume7d)}
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          {count7d} liquidations
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
        <div className="text-zinc-500 text-sm">Daily Avg</div>
        <div className="text-2xl font-bold text-zinc-100 font-mono mt-1">
          {formatTvl(volume7d / 7)}
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          ~{Math.round(count7d / 7)} per day
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
        <div className="text-zinc-500 text-sm">7d Bad Debt</div>
        <div className={`text-2xl font-bold font-mono mt-1 ${
          badDebt7d > 10000 ? 'text-red-400' : badDebt7d > 0 ? 'text-yellow-500' : 'text-green-500'
        }`}>
          {badDebt7d > 0 ? formatTvl(badDebt7d) : '$0'}
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          {badDebt7d > 0 ? 'Requires monitoring' : 'No bad debt'}
        </div>
      </div>
    </div>
  );
}
