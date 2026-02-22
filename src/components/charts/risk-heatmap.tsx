'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getCuratorColor } from '@/lib/colors';
import { formatTvl } from '@/lib/utils';
import type { Curator } from '@/types';
import type { CreditRating } from '@/lib/risk-rating';

const PILLARS = [
  { key: 'capitalSafetyRating' as const, label: 'Capital Safety', shortLabel: 'Capital' },
  { key: 'liquidityHealthRating' as const, label: 'Liquidity Health', shortLabel: 'Liquidity' },
  { key: 'curatorQualityRating' as const, label: 'Curator Quality', shortLabel: 'Quality' },
];

const RATING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AAA: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  AA: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  A: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/20' },
  BBB: { bg: 'bg-lime-500/12', text: 'text-lime-400', border: 'border-lime-500/20' },
  BB: { bg: 'bg-amber-500/12', text: 'text-amber-400', border: 'border-amber-500/20' },
  B: { bg: 'bg-orange-500/12', text: 'text-orange-400', border: 'border-orange-500/20' },
  CCC: { bg: 'bg-red-500/12', text: 'text-red-400', border: 'border-red-500/20' },
  CC: { bg: 'bg-red-500/18', text: 'text-red-300', border: 'border-red-500/30' },
  C: { bg: 'bg-red-500/25', text: 'text-red-200', border: 'border-red-500/40' },
  NR: { bg: 'bg-slate-700/20', text: 'text-slate-500', border: 'border-slate-700/20' },
};

function RatingCell({ rating }: { rating?: CreditRating }) {
  const grade = rating || 'NR';
  const colors = RATING_COLORS[grade] || RATING_COLORS.NR;

  return (
    <td className="px-2 py-2.5 text-center">
      <span
        className={`inline-block px-2 py-0.5 rounded text-[12px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', minWidth: '36px' }}
      >
        {grade}
      </span>
    </td>
  );
}

interface RiskHeatmapProps {
  curators: Curator[];
}

export function RiskHeatmap({ curators }: RiskHeatmapProps) {
  // Only show curators that have at least one pillar rating
  const ratedCurators = useMemo(() => {
    return curators
      .filter(c => c.creditRating || c.capitalSafetyRating || c.liquidityHealthRating || c.curatorQualityRating)
      .sort((a, b) => {
        // Sort by composite rating (best first), then by TVL
        const ratingOrder: Record<string, number> = {
          AAA: 0, AA: 1, A: 2, BBB: 3, BB: 4, B: 5, CCC: 6, CC: 7, C: 8, NR: 9,
        };
        const aRank = ratingOrder[a.creditRating || 'NR'] ?? 9;
        const bRank = ratingOrder[b.creditRating || 'NR'] ?? 9;
        if (aRank !== bRank) return aRank - bRank;
        return b.totalTvl - a.totalTvl;
      });
  }, [curators]);

  if (ratedCurators.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1">Risk Assessment</p>
        <div className="flex items-center justify-between">
          <CardTitle>Credit Rating Heatmap</CardTitle>
          <span className="text-[11px] text-slate-500 px-2 py-0.5 rounded bg-[#1a1f2e]/40 border border-slate-700/30">
            {ratedCurators.length} rated
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#141922]/60">
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  Curator
                </th>
                <th className="text-center px-2 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  Composite
                </th>
                {PILLARS.map(p => (
                  <th key={p.key} className="text-center px-2 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                    <span className="hidden sm:inline">{p.label}</span>
                    <span className="sm:hidden">{p.shortLabel}</span>
                  </th>
                ))}
                <th className="text-right px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-medium hidden md:table-cell">
                  TVL
                </th>
              </tr>
            </thead>
            <tbody>
              {ratedCurators.map((curator, index) => {
                const color = getCuratorColor(curator.name, index);
                const compositeColors = RATING_COLORS[curator.creditRating || 'NR'] || RATING_COLORS.NR;

                return (
                  <tr
                    key={curator.slug}
                    className="border-t border-slate-700/20 hover:bg-slate-700/10 transition-colors"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-slate-200 font-medium truncate max-w-[140px] sm:max-w-[200px]">
                          {curator.name}
                        </span>
                        {curator.investmentGrade && (
                          <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium hidden sm:inline">
                            IG
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[13px] font-bold border ${compositeColors.bg} ${compositeColors.text} ${compositeColors.border}`}
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', minWidth: '40px' }}
                      >
                        {curator.creditRating || 'NR'}
                      </span>
                    </td>
                    <RatingCell rating={curator.capitalSafetyRating} />
                    <RatingCell rating={curator.liquidityHealthRating} />
                    <RatingCell rating={curator.curatorQualityRating} />
                    <td className="px-4 py-2.5 text-right hidden md:table-cell">
                      <span className="text-[12px] text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                        {formatTvl(curator.totalTvl)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-slate-700/20 flex flex-wrap gap-x-3 gap-y-1.5">
          <span className="text-[10px] text-slate-600 mr-1">Scale:</span>
          {(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'] as CreditRating[]).map(grade => {
            const colors = RATING_COLORS[grade];
            return (
              <span
                key={grade}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}
                style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                {grade}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
