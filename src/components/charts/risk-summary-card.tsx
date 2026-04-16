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
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import type { Curator, CreditRating } from '@/types';
import { useState } from 'react';

interface RiskSummaryCardProps {
  curators: Curator[];
  hideWhenEmpty?: boolean;
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
  bestRatedCurators: { name: string; rating: CreditRating; estimated?: boolean }[];
  worstRatedCurators: { name: string; rating: CreditRating; estimated?: boolean }[];
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
  const ratedCurators: { name: string; rating: CreditRating; tvl: number; estimated?: boolean }[] = [];

  for (const curator of curators) {
    if (curator.creditRating) {
      ratingDistribution[curator.creditRating]++;
      ratedCurators.push({
        name: curator.name,
        rating: curator.creditRating,
        tvl: curator.totalTvl,
        estimated: curator.ratingEstimated,
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

  const bestRatedCurators = ratedCurators
    .slice(0, 3)
    .map(c => ({ name: c.name, rating: c.rating, estimated: c.estimated }));
  const worstRatedCurators = ratedCurators
    .filter(c => c.rating !== 'NR')
    .slice(-3)
    .reverse()
    .map(c => ({ name: c.name, rating: c.rating, estimated: c.estimated }));

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

export function RiskSummaryCard({ curators, hideWhenEmpty }: RiskSummaryCardProps) {
  const [showLegend, setShowLegend] = useState(false);
  const summary = calculateRatingSummary(curators);

  // Determine overall protocol health status
  const getHealthStatus = () => {
    const rating = summary.protocolRating;
    if (['AAA', 'AA', 'A'].includes(rating)) {
      return { label: 'Healthy', color: 'text-emerald-600', bg: 'bg-emerald-500/10' };
    }
    if (rating === 'BBB') {
      return { label: 'Stable', color: 'text-green-600', bg: 'bg-green-500/10' };
    }
    if (['BB', 'B'].includes(rating)) {
      return { label: 'Elevated Risk', color: 'text-amber-600', bg: 'bg-amber-500/10' };
    }
    return { label: 'High Risk', color: 'text-red-600', bg: 'bg-red-500/10' };
  };

  const health = getHealthStatus();

  if (summary.curatorsWithRatings === 0) {
    return hideWhenEmpty ? null : <EmptyStateCard title="Protocol Risk Summary" message="No credit rating data available for assessment." />;
  }

  // Calculate rating distribution for visualization
  const investmentGradeRatings: CreditRating[] = ['AAA', 'AA', 'A', 'BBB'];
  const speculativeRatings: CreditRating[] = ['BB', 'B', 'CCC', 'CC', 'C'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Risk Assessment</p>
            <CardTitle className="text-[15px]">Protocol Risk Summary</CardTitle>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-medium border',
              health.bg, health.color,
              health.label === 'Healthy' ? 'border-emerald-500/20' :
              health.label === 'Stable' ? 'border-green-500/20' :
              health.label === 'Elevated Risk' ? 'border-amber-500/20' : 'border-red-500/20'
            )}>
              {health.label}
            </span>
            <RatingBadge rating={summary.protocolRating} size="md" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Rating Distribution */}
        <div className="mb-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2.5 font-medium">
            Rating Distribution
          </p>
          <div className="flex gap-0.5 h-7 rounded-lg overflow-hidden bg-gray-100">
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
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] text-gray-900 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm">
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
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] text-gray-900 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm">
                    {rating}: {count}
                  </div>
                </div>
              );
            })}
            {summary.notRatedCount > 0 && (
              <div
                className="bg-gray-400 relative group"
                style={{ width: `${(summary.notRatedCount / curators.length) * 100}%` }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] text-gray-900 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm">
                  NR: {summary.notRatedCount}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between mt-1 text-[10px]">
            <span className="text-emerald-600">
              {summary.investmentGradeCount} Investment Grade
            </span>
            <span className="text-amber-600">
              {summary.speculativeCount} Speculative
            </span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 7d Liquidations */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
              <TrendingDown className="h-3 w-3" />
              <span>7d Liqs</span>
            </div>
            <p className={cn(
              'font-mono text-[20px] font-medium',
              summary.totalLiquidations7d > 10_000_000 ? 'text-red-600' :
              summary.totalLiquidations7d > 1_000_000 ? 'text-amber-600' : 'text-gray-700'
            )}>
              {formatTvl(summary.totalLiquidations7d)}
            </p>
            {summary.totalLiquidations24h > 0 && (
              <p className="text-[10px] text-gray-400">
                {formatTvl(summary.totalLiquidations24h)} in 24h
              </p>
            )}
          </div>

          {/* Bad Debt */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
              <AlertTriangle className="h-3 w-3" />
              <span>Bad Debt</span>
            </div>
            <p className={cn(
              'font-mono text-[20px] font-medium',
              summary.curatorsWithBadDebt > 2 ? 'text-red-600' :
              summary.curatorsWithBadDebt > 0 ? 'text-amber-600' : 'text-emerald-600'
            )}>
              {summary.curatorsWithBadDebt}
            </p>
            <p className="text-[10px] text-gray-400">
              curator{summary.curatorsWithBadDebt !== 1 ? 's' : ''} affected
            </p>
          </div>

          {/* Investment Grade */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
              <CheckCircle className="h-3 w-3" />
              <span>Inv. Grade</span>
            </div>
            <p className="font-mono text-[20px] font-medium text-emerald-600">
              {summary.investmentGradeCount}
            </p>
            <p className="text-[10px] text-gray-400">
              of {summary.curatorsWithRatings} rated
            </p>
          </div>

          {/* Avg Utilization */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
              <Droplets className="h-3 w-3" />
              <span>Utilization</span>
            </div>
            <p className={cn(
              'font-mono text-[20px] font-medium',
              summary.avgUtilization > 0.95 ? 'text-red-600' :
              summary.avgUtilization > 0.85 ? 'text-amber-600' :
              summary.avgUtilization > 0.70 ? 'text-yellow-600' : 'text-gray-700'
            )}>
              {(summary.avgUtilization * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-gray-400">
              across {summary.curatorsWithRatings} curators
            </p>
          </div>
        </div>

        {/* Top/Bottom Rated */}
        {(summary.bestRatedCurators.length > 0 || summary.worstRatedCurators.length > 0) && (
          <div className="mt-5 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
            {summary.bestRatedCurators.length > 0 && (
              <div className="bg-emerald-500/[0.04] rounded-lg p-3 border border-emerald-500/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-medium">
                  <Shield className="h-3 w-3 text-emerald-600" /> Top Rated
                </p>
                <div className="space-y-1.5">
                  {summary.bestRatedCurators.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-700 truncate max-w-[120px]">{c.name}</span>
                      <RatingBadge rating={c.rating} size="sm" estimated={c.estimated} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.worstRatedCurators.length > 0 && (
              <div className="bg-amber-500/[0.04] rounded-lg p-3 border border-amber-500/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3 w-3 text-amber-600" /> Watch List
                </p>
                <div className="space-y-1.5">
                  {summary.worstRatedCurators.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-700 truncate max-w-[120px]">{c.name}</span>
                      <RatingBadge rating={c.rating} size="sm" estimated={c.estimated} />
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
          className="mt-3 text-[11px] text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
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
