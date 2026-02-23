'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface VaultYieldData {
  symbol: string;
  tvl: number;
  apy: number;
  apyBase: number;
  apyReward: number;
}

interface YieldQualityChartProps {
  vaults: VaultYieldData[];
  title?: string;
  curatorName?: string;
}

export function YieldQualityChart({
  vaults,
  title = 'Yield Quality Breakdown',
  curatorName,
}: YieldQualityChartProps) {
  const analysis = useMemo(() => {
    if (vaults.length === 0) {
      return {
        totalTvl: 0,
        weightedAvgApy: 0,
        weightedBaseApy: 0,
        weightedRewardApy: 0,
        organicPercent: 0,
        incentivizedPercent: 0,
        pureOrganic: 0,
        mixed: 0,
        pureIncentivized: 0,
        topOrganic: [],
        topIncentivized: [],
      };
    }

    const totalTvl = vaults.reduce((sum, v) => sum + v.tvl, 0);

    // TVL-weighted APY calculations
    let weightedBaseApy = 0;
    let weightedRewardApy = 0;
    let weightedTotalApy = 0;

    vaults.forEach(v => {
      const weight = v.tvl / totalTvl;
      weightedBaseApy += (v.apyBase || 0) * weight;
      weightedRewardApy += (v.apyReward || 0) * weight;
      weightedTotalApy += (v.apy || 0) * weight;
    });

    // Calculate organic vs incentivized split
    const totalWeightedApy = weightedBaseApy + weightedRewardApy;
    const organicPercent = totalWeightedApy > 0 ? (weightedBaseApy / totalWeightedApy) * 100 : 0;
    const incentivizedPercent = totalWeightedApy > 0 ? (weightedRewardApy / totalWeightedApy) * 100 : 0;

    // Categorize vaults
    let pureOrganic = 0; // 100% base APY
    let mixed = 0; // Mix of base and reward
    let pureIncentivized = 0; // 100% reward APY

    vaults.forEach(v => {
      const base = v.apyBase || 0;
      const reward = v.apyReward || 0;
      const total = base + reward;

      if (total === 0) return;

      const rewardRatio = reward / total;
      if (rewardRatio === 0) pureOrganic++;
      else if (rewardRatio === 1) pureIncentivized++;
      else mixed++;
    });

    // Top organic yield vaults (sorted by base APY, filtered for >50% organic)
    const topOrganic = vaults
      .filter(v => {
        const total = (v.apyBase || 0) + (v.apyReward || 0);
        return total > 0 && (v.apyBase || 0) / total > 0.5;
      })
      .sort((a, b) => (b.apyBase || 0) - (a.apyBase || 0))
      .slice(0, 5);

    // Top incentivized vaults (sorted by reward APY)
    const topIncentivized = vaults
      .filter(v => (v.apyReward || 0) > 0)
      .sort((a, b) => (b.apyReward || 0) - (a.apyReward || 0))
      .slice(0, 5);

    return {
      totalTvl,
      weightedAvgApy: weightedTotalApy,
      weightedBaseApy,
      weightedRewardApy,
      organicPercent,
      incentivizedPercent,
      pureOrganic,
      mixed,
      pureIncentivized,
      topOrganic,
      topIncentivized,
    };
  }, [vaults]);

  if (vaults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-gray-500 text-[14px]">
            No yield data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const pieData = [
    { name: 'Organic (Base)', value: analysis.organicPercent, color: '#10B981' },
    { name: 'Incentivized (Rewards)', value: analysis.incentivizedPercent, color: '#8B5CF6' },
  ].filter(d => d.value > 0);

  const categoryData = [
    { name: 'Pure Organic', count: analysis.pureOrganic, color: '#10B981' },
    { name: 'Mixed', count: analysis.mixed, color: '#F59E0B' },
    { name: 'Pure Incentivized', count: analysis.pureIncentivized, color: '#8B5CF6' },
  ].filter(d => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Yield Analysis</p>
            <CardTitle>{title}</CardTitle>
          </div>
          <span className="text-[12px] text-gray-400 font-mono">
            {vaults.length} vaults
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Summary Stats */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                TVL-Weighted Avg APY
              </p>
              <p className="text-[24px] font-mono font-semibold text-gray-900">
                {analysis.weightedAvgApy.toFixed(2)}%
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                  Organic Yield
                </p>
                <p className="text-[18px] font-mono font-semibold text-emerald-600">
                  {analysis.weightedBaseApy.toFixed(2)}%
                </p>
                <p className="text-[12px] text-gray-400">
                  {analysis.organicPercent.toFixed(0)}% of total
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                  Reward Yield
                </p>
                <p className="text-[18px] font-mono font-semibold text-violet-600">
                  {analysis.weightedRewardApy.toFixed(2)}%
                </p>
                <p className="text-[12px] text-gray-400">
                  {analysis.incentivizedPercent.toFixed(0)}% of total
                </p>
              </div>
            </div>

            {/* Yield Quality Score */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                Yield Quality Score
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.min(analysis.organicPercent, 100)}%` }}
                  />
                </div>
                <span className={cn(
                  'text-[14px] font-mono font-semibold',
                  analysis.organicPercent >= 70 ? 'text-emerald-600' :
                  analysis.organicPercent >= 40 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {analysis.organicPercent >= 70 ? 'High' :
                   analysis.organicPercent >= 40 ? 'Medium' : 'Low'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Higher organic yield = more sustainable
              </p>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="flex flex-col items-center justify-center">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
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
                            <p className="text-[14px] font-mono" style={{ color: data.color }}>
                              {data.value.toFixed(1)}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[11px] text-gray-500">{entry.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vault Categories */}
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">
              Vault Categories
            </p>
            <div className="space-y-3">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-[13px] text-gray-700">{cat.name}</span>
                  <span className="text-[13px] font-mono text-gray-500">
                    {cat.count} vault{cat.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Top Organic Vaults */}
            {analysis.topOrganic.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                  Top Organic Yield
                </p>
                <div className="space-y-2">
                  {analysis.topOrganic.slice(0, 3).map((v) => (
                    <div key={v.symbol} className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500 truncate max-w-[120px]">
                        {v.symbol}
                      </span>
                      <span className="text-[12px] font-mono text-emerald-600">
                        {(v.apyBase || 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for dashboard overview
export function YieldQualitySummary({
  vaults,
  curatorName,
}: {
  vaults: VaultYieldData[];
  curatorName?: string;
}) {
  const analysis = useMemo(() => {
    if (vaults.length === 0) return null;

    const totalTvl = vaults.reduce((sum, v) => sum + v.tvl, 0);
    let weightedBaseApy = 0;
    let weightedRewardApy = 0;

    vaults.forEach(v => {
      const weight = v.tvl / totalTvl;
      weightedBaseApy += (v.apyBase || 0) * weight;
      weightedRewardApy += (v.apyReward || 0) * weight;
    });

    const total = weightedBaseApy + weightedRewardApy;
    const organicPercent = total > 0 ? (weightedBaseApy / total) * 100 : 0;

    return {
      weightedBaseApy,
      weightedRewardApy,
      organicPercent,
      totalApy: weightedBaseApy + weightedRewardApy,
    };
  }, [vaults]);

  if (!analysis) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] text-gray-500">Yield Quality</span>
          <span className="text-[12px] font-mono text-gray-500">
            {analysis.organicPercent.toFixed(0)}% organic
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${analysis.organicPercent}%` }}
          />
          <div
            className="h-full bg-purple-500"
            style={{ width: `${100 - analysis.organicPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
