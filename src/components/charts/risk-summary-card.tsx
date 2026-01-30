'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RatingBadge, RatingScaleLegend } from '@/components/ui/credit-rating';
import { formatTvl, cn } from '@/lib/utils';
import {
  AlertTriangle,
  TrendingDown,
  Shield,
  Droplets,
  Users,
  CheckCircle,
  Info,
} from 'lucide-react';
import type { Curator, CreditRating } from '@/types';
import { useState } from 'react';

interface RiskSummaryCardProps {
  curators: Curator[];
}

interface RatingSummary {
  // Rating distribution
  ratingDistribution: Record<CreditRating, number>;
  investmentGradeCount: number;
  speculativeCount: number;
  notRatedCount: number;
  // Risk indicators
  totalLiquidations7d: number;
  totalLiquidations24h: number;
  curatorsWithBadDebt: number;
  avgUtilization: number;
  // Best and worst
  bestRatedCurators: { name: string; rating: CreditRating }[];
  worstRatedCurators: { name: string; rating: CreditRating }[];
  // Overall protocol health
  protocolRating: CreditRating;
  curatorsWithRatings: number;
}

function calculateRatingSummary(curators: Curator[]): RatingSummary {
  const ratingDistribution: Record<CreditRating, number> = {
    'AAA': 0, 'AA': 0, 'A': 0, 'BBB': 0,
    'BB': 0, 'B': 0, 'CCC': 0, 'CC': 0, 'C': 0, 'NR': 0,
  };

  let investmentGradeCount = 0;
  let speculativeCount = 0;
  let notRatedCount = 0;
  const ratedCurators: { name: string; rating: CreditRating; tvl: number }[] = [];

  for (const curator of curators) {
    if (curator.creditRating) {
      ratingDistribution[curator.creditRating]++;
      ratedCurators.push({
        name: curator.name,
        rating: curator.creditRating,
        tvl: curator.totalTvl,
      });

      if (curator.investmentGrade) {
        investmentGradeCount++;
      } else {
        speculativeCount++;
      }
    } else {
      notRatedCount++;
      ratingDistribution['NR']++;
    }
  }

  // Sort by rating quality (AAA best, C worst)
  const ratingOrder: CreditRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'NR'];
  ratedCurators.sort((a, b) => {
    const aIdx = ratingOrder.indexOf(a.rating);
    const bIdx = ratingOrder.indexOf(b.rating);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return b.tvl - a.tvl; // If same rating, sort by TVL
  });

  const bestRatedCurators = ratedCurators.slice(0, 3).map(c => ({ name: c.name, rating: c.rating }));
  const worstRatedCurators = ratedCurators
    .filter(c => c.rating !== 'NR')
    .slice(-3)
    .reverse()
    .map(c => ({ name: c.name, rating: c.rating }));

  // Calculate overall protocol rating based on TVL-weighted average
  let weightedScore = 0;
  let totalTvl = 0;
  const ratingScores: Record<CreditRating, number> = {
    'AAA': 0, 'AA': 5, 'A': 12, 'BBB': 25,
    'BB': 40, 'B': 55, 'CCC': 70, 'CC': 85, 'C': 95, 'NR': 50,
  };

  for (const curator of ratedCurators) {
    weightedScore += ratingScores[curator.rating] * curator.tvl;
    totalTvl += curator.tvl;
  }

  const avgScore = totalTvl > 0 ? weightedScore / totalTvl : 50;
  let protocolRating: CreditRating = 'BBB';
  if (avgScore <= 5) protocolRating = 'AAA';
  else if (avgScore <= 12) protocolRating = 'AA';
  else if (avgScore <= 20) protocolRating = 'A';
  else if (avgScore <= 30) protocolRating = 'BBB';
  else if (avgScore <= 45) protocolRating = 'BB';
  else if (avgScore <= 60) protocolRating = 'B';
  else if (avgScore <= 75) protocolRating = 'CCC';
  else if (avgScore <= 90) protocolRating = 'CC';
  else protocolRating = 'C';

  // Calculate other metrics
  const curatorsWithRisk = curators.filter(c => c.riskLevel !== undefined);

  return {
    ratingDistribution,
    investmentGradeCount,
    speculativeCount,
    notRatedCount,
    totalLiquidations7d: curators.reduce((sum, c) => sum + (c.liquidationVolume7d || 0), 0),
    totalLiquidations24h: curators.reduce((sum, c) => sum + (c.liquidationVolume24h || 0), 0),
    curatorsWithBadDebt: curators.filter(c => c.hasBadDebt).length,
    avgUtilization: curatorsWithRisk.length > 0
      ? curatorsWithRisk.reduce((sum, c) => sum + (c.avgUtilization || 0), 0) / curatorsWithRisk.length
      : 0,
    bestRatedCurators,
    worstRatedCurators,
    protocolRating,
    curatorsWithRatings: ratedCurators.length,
  };
}

export function RiskSummaryCard({ curators }: RiskSummaryCardProps) {
  const [showLegend, setShowLegend] = useState(false);
  const summary = calculateRatingSummary(curators);

  // Determine overall protocol health status
  const getHealthStatus = () => {
    const rating = summary.protocolRating;
    if (['AAA', 'AA', 'A'].includes(rating)) {
      return { label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    }
    if (rating === 'BBB') {
      return { label: 'Stable', color: 'text-green-400', bg: 'bg-green-500/10' };
    }
    if (['BB', 'B'].includes(rating)) {
      return { label: 'Elevated Risk', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    }
    return { label: 'High Risk', color: 'text-red-400', bg: 'bg-red-500/10' };
  };

  const health = getHealthStatus();

  if (summary.curatorsWithRatings === 0) {
    return null; // Don't show if no rating data available
  }

  // Calculate rating distribution for visualization
  const investmentGradeRatings: CreditRating[] = ['AAA', 'AA', 'A', 'BBB'];
  const speculativeRatings: CreditRating[] = ['BB', 'B', 'CCC', 'CC', 'C'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px]">Protocol Risk Summary</CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn('px-2 py-1 rounded-full text-[11px] font-medium', health.bg, health.color)}>
              {health.label}
            </span>
            <RatingBadge rating={summary.protocolRating} size="md" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Rating Distribution */}
        <div className="mb-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Rating Distribution
          </p>
          <div className="flex gap-1 h-6 rounded overflow-hidden">
            {investmentGradeRatings.map(rating => {
              const count = summary.ratingDistribution[rating];
              const pct = summary.curatorsWithRatings > 0
                ? (count / summary.curatorsWithRatings) * 100
                : 0;
              if (pct === 0) return null;

              const colors: Record<string, string> = {
                'AAA': 'bg-emerald-500',
                'AA': 'bg-emerald-400',
                'A': 'bg-green-500',
                'BBB': 'bg-yellow-500',
              };

              return (
                <div
                  key={rating}
                  className={cn('relative group', colors[rating])}
                  style={{ width: `${pct}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {rating}: {count}
                  </div>
                </div>
              );
            })}
            {speculativeRatings.map(rating => {
              const count = summary.ratingDistribution[rating];
              const pct = summary.curatorsWithRatings > 0
                ? (count / summary.curatorsWithRatings) * 100
                : 0;
              if (pct === 0) return null;

              const colors: Record<string, string> = {
                'BB': 'bg-amber-500',
                'B': 'bg-orange-500',
                'CCC': 'bg-red-400',
                'CC': 'bg-red-500',
                'C': 'bg-red-600',
              };

              return (
                <div
                  key={rating}
                  className={cn('relative group', colors[rating])}
                  style={{ width: `${pct}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {rating}: {count}
                  </div>
                </div>
              );
            })}
            {summary.notRatedCount > 0 && (
              <div
                className="bg-zinc-600 relative group"
                style={{ width: `${(summary.notRatedCount / curators.length) * 100}%` }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  NR: {summary.notRatedCount}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between mt-1 text-[10px]">
            <span className="text-emerald-400">
              {summary.investmentGradeCount} Investment Grade
            </span>
            <span className="text-amber-400">
              {summary.speculativeCount} Speculative
            </span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 7d Liquidations */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>7d Liquidations</span>
            </div>
            <p className={cn(
              'font-mono text-[18px]',
              summary.totalLiquidations7d > 10_000_000 ? 'text-red-400' :
              summary.totalLiquidations7d > 1_000_000 ? 'text-amber-400' : 'text-zinc-300'
            )}>
              {formatTvl(summary.totalLiquidations7d)}
            </p>
            {summary.totalLiquidations24h > 0 && (
              <p className="text-[10px] text-zinc-600">
                {formatTvl(summary.totalLiquidations24h)} in 24h
              </p>
            )}
          </div>

          {/* Bad Debt */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Bad Debt</span>
            </div>
            <p className={cn(
              'font-mono text-[18px]',
              summary.curatorsWithBadDebt > 2 ? 'text-red-400' :
              summary.curatorsWithBadDebt > 0 ? 'text-amber-400' : 'text-emerald-400'
            )}>
              {summary.curatorsWithBadDebt}
            </p>
            <p className="text-[10px] text-zinc-600">
              curator{summary.curatorsWithBadDebt !== 1 ? 's' : ''} affected
            </p>
          </div>

          {/* Investment Grade */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Investment Grade</span>
            </div>
            <p className="font-mono text-[18px] text-emerald-400">
              {summary.investmentGradeCount}
            </p>
            <p className="text-[10px] text-zinc-600">
              of {summary.curatorsWithRatings} rated
            </p>
          </div>

          {/* Avg Utilization */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Droplets className="h-3.5 w-3.5" />
              <span>Avg Utilization</span>
            </div>
            <p className={cn(
              'font-mono text-[18px]',
              summary.avgUtilization > 0.95 ? 'text-red-400' :
              summary.avgUtilization > 0.85 ? 'text-amber-400' :
              summary.avgUtilization > 0.70 ? 'text-yellow-400' : 'text-zinc-300'
            )}>
              {(summary.avgUtilization * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-zinc-600">
              across {summary.curatorsWithRatings} curators
            </p>
          </div>
        </div>

        {/* Top/Bottom Rated */}
        {(summary.bestRatedCurators.length > 0 || summary.worstRatedCurators.length > 0) && (
          <div className="mt-4 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-4">
            {summary.bestRatedCurators.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-emerald-400" /> Top Rated
                </p>
                <div className="space-y-1">
                  {summary.bestRatedCurators.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400 truncate max-w-[120px]">{c.name}</span>
                      <RatingBadge rating={c.rating} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.worstRatedCurators.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-400" /> Watch List
                </p>
                <div className="space-y-1">
                  {summary.worstRatedCurators.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400 truncate max-w-[120px]">{c.name}</span>
                      <RatingBadge rating={c.rating} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend toggle */}
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="mt-3 text-[11px] text-zinc-500 hover:text-zinc-400 transition-colors flex items-center gap-1"
        >
          <Info className="h-3 w-3" />
          {showLegend ? 'Hide' : 'Show'} rating scale
        </button>

        {showLegend && (
          <div className="mt-3">
            <RatingScaleLegend />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
