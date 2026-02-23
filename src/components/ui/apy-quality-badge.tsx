'use client';

import { cn } from '@/lib/utils';

interface ApyQualityBadgeProps {
  apy: number;
  apyBase: number;
  apyReward: number;
  compact?: boolean;
  showBar?: boolean;
}

export function ApyQualityBadge({
  apy,
  apyBase,
  apyReward,
  compact = false,
  showBar = true
}: ApyQualityBadgeProps) {
  // Calculate organic percentage (base APY as portion of total)
  const organicPct = apy > 0 ? (apyBase / apy) * 100 : 0;

  // Determine quality level
  const getQuality = () => {
    if (organicPct >= 80) return { label: 'Organic', color: 'text-emerald-600', barColor: 'bg-emerald-500' };
    if (organicPct >= 50) return { label: 'Mixed', color: 'text-amber-600', barColor: 'bg-amber-500' };
    if (organicPct >= 20) return { label: 'Incentivized', color: 'text-orange-600', barColor: 'bg-orange-500' };
    return { label: 'Rewards', color: 'text-red-600', barColor: 'bg-red-500' };
  };

  const quality = getQuality();

  if (apy === 0) {
    return <span className="text-[11px] text-gray-400">—</span>;
  }

  if (compact) {
    return (
      <div className="group relative inline-flex items-center gap-1.5">
        <span className={cn('text-[10px]', quality.color)}>
          {Math.round(organicPct)}%
        </span>
        {showBar && (
          <div className="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', quality.barColor)}
              style={{ width: `${Math.min(organicPct, 100)}%` }}
            />
          </div>
        )}
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
          <p className="text-gray-700 font-medium mb-1">{quality.label} Yield</p>
          <p className="text-gray-500">Base: <span className="text-emerald-600">{apyBase.toFixed(2)}%</span></p>
          <p className="text-gray-500">Rewards: <span className="text-amber-600">{apyReward.toFixed(2)}%</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[11px] font-medium', quality.color)}>
          {quality.label}
        </span>
        <span className="text-[11px] text-gray-500">
          {Math.round(organicPct)}% organic
        </span>
      </div>
      {showBar && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', quality.barColor)}
            style={{ width: `${Math.min(organicPct, 100)}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>Base: {apyBase.toFixed(1)}%</span>
        <span>Rewards: {apyReward.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Simple inline version for tables
export function ApyWithQuality({
  apy,
  apyBase,
  apyReward
}: {
  apy: number;
  apyBase: number;
  apyReward: number;
}) {
  const organicPct = apy > 0 ? (apyBase / apy) * 100 : 0;

  const getColor = () => {
    if (organicPct >= 80) return 'text-emerald-600';
    if (organicPct >= 50) return 'text-emerald-500';
    if (organicPct >= 20) return 'text-amber-600';
    return 'text-orange-600';
  };

  if (apy === 0) {
    return <span className="text-[11px] text-gray-400">—</span>;
  }

  return (
    <div className="group relative inline-block">
      <span className={cn('font-mono text-[14px]', getColor())}>
        {apy.toFixed(2)}%
      </span>
      {/* Tooltip with breakdown */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">Base APY:</span>
            <span className="font-mono text-emerald-600">{apyBase.toFixed(2)}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">Rewards:</span>
            <span className="font-mono text-amber-600">{apyReward.toFixed(2)}%</span>
          </div>
          <div className="border-t border-gray-200 pt-1.5 flex items-center justify-between gap-4">
            <span className="text-gray-500">Organic:</span>
            <span className={cn('font-mono', getColor())}>{Math.round(organicPct)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
