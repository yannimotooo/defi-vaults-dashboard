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
      <div className="h-[300px] flex items-center justify-center text-slate-500">
        No liquidation data available
      </div>
    );
  }

  // Format date helper (defined before use)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;

    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
    const dayData = data.find(d => formatDate(d.date) === label);

    return (
      <div className="bg-[#111827]/90 border border-slate-700/40 rounded-lg p-3 shadow-lg">
        <div className="text-slate-400 text-sm mb-2">{label}</div>
        <div className="space-y-1">
          {payload.filter(p => p.value > 0).map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-300">{entry.name}</span>
              </div>
              <span className="font-mono text-slate-200">
                {formatTvl(entry.value)}
              </span>
            </div>
          ))}
          <div className="border-t border-slate-700/40 pt-1 mt-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total</span>
              <span className="font-mono text-slate-200 font-medium">
                {formatTvl(total)}
              </span>
            </div>
            {dayData && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Liquidations</span>
                  <span className="text-slate-400">{dayData.count}</span>
                </div>
                {dayData.badDebt > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Bad Debt</span>
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
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={(value) => formatTvl(value, true)}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          {showByProtocol && protocols.length > 0 && (
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => (
                <span className="text-slate-400 text-sm">{value}</span>
              )}
            />
          )}
          {showByProtocol && protocols.length > 0 ? (
            // Stacked bars by protocol
            protocols.map((protocol) => (
              <Bar
                key={protocol}
                dataKey={protocol}
                stackId="volume"
                fill={PROTOCOL_COLORS[protocol] || '#64748b'}
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-700/30 rounded-xl overflow-hidden border border-slate-700/35">
      <div className="bg-[#111827]/80 p-4 border-t-2 border-t-indigo-500">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">24h Volume</div>
        <div className="text-[22px] font-semibold text-slate-100 mt-1.5" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          {formatTvl(volume24h)}
        </div>
        <div className="text-slate-600 text-[11px] mt-1">
          {count24h} liquidations
        </div>
      </div>

      <div className="bg-[#111827]/80 p-4 border-t-2 border-t-amber-400">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">7d Volume</div>
        <div className="text-[22px] font-semibold text-slate-100 mt-1.5" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          {formatTvl(volume7d)}
        </div>
        <div className="text-slate-600 text-[11px] mt-1">
          {count7d} liquidations
        </div>
      </div>

      <div className="bg-[#111827]/80 p-4 border-t-2 border-t-cyan-400">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Daily Avg</div>
        <div className="text-[22px] font-semibold text-slate-100 mt-1.5" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          {formatTvl(volume7d / 7)}
        </div>
        <div className="text-slate-600 text-[11px] mt-1">
          ~{Math.round(count7d / 7)} per day
        </div>
      </div>

      <div className="bg-[#111827]/80 p-4 border-t-2 border-t-rose-400">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">7d Bad Debt</div>
        <div className={`text-[22px] font-semibold mt-1.5 ${
          badDebt7d > 10000 ? 'text-red-400' : badDebt7d > 0 ? 'text-amber-400' : 'text-emerald-400'
        }`} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
          {badDebt7d > 0 ? formatTvl(badDebt7d) : '$0'}
        </div>
        <div className="text-slate-600 text-[11px] mt-1">
          {badDebt7d > 0 ? 'Requires monitoring' : 'No bad debt'}
        </div>
      </div>
    </div>
  );
}
