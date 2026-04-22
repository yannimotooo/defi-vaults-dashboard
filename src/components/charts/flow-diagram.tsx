'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatTvl, formatCuratorShortName } from '@/lib/utils';
import { Info } from 'lucide-react';

interface FlowPair {
  fromCurator: string;
  toCurator: string;
  estimatedFlowUsd: number;
  confidence: 'low';
  rationale: string;
}

interface FlowDiagramProps {
  pairs: FlowPair[];
  isLoading?: boolean;
  error?: boolean;
  windowDays: number;
}

/**
 * Sankey-style flow diagram showing estimated capital displacement.
 *
 * Left stacked bars = curators losing TVL (red).
 * Right stacked bars = curators gaining TVL (green).
 * Curved filled bands connect each matched pair, width proportional to
 * estimated $ flow. Labels on bars show curator name + amount.
 *
 * Pure SVG — no charting library dependency. Layout is computed in useMemo
 * and rendered declaratively.
 */
export function FlowDiagram({ pairs, isLoading, error, windowDays }: FlowDiagramProps) {
  const layout = useMemo(() => {
    if (pairs.length === 0) return null;

    // Aggregate per-entity total flows
    const loserTotals = new Map<string, number>();
    const gainerTotals = new Map<string, number>();
    for (const p of pairs) {
      loserTotals.set(p.fromCurator, (loserTotals.get(p.fromCurator) || 0) + p.estimatedFlowUsd);
      gainerTotals.set(p.toCurator, (gainerTotals.get(p.toCurator) || 0) + p.estimatedFlowUsd);
    }

    // Sort by total flow descending for visual prominence
    const losers = Array.from(loserTotals.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, total]) => ({ name, total }));
    const gainers = Array.from(gainerTotals.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, total]) => ({ name, total }));

    // Layout constants
    const BAR_W = 14;
    const LABEL_W = 130;
    const GAP = 120; // center gap for the flow bands
    const SVG_W = LABEL_W + BAR_W + GAP + BAR_W + LABEL_W;
    const SPACING = 6; // gap between stacked bar segments
    const MIN_SEGMENT_H = 24;

    // Compute total flow to scale bar heights
    const totalLoserFlow = losers.reduce((s, l) => s + l.total, 0);
    const totalGainerFlow = gainers.reduce((s, g) => s + g.total, 0);
    const maxFlow = Math.max(totalLoserFlow, totalGainerFlow);

    // Available height: scale so the taller column is ~300px, minimum 200px
    const TARGET_H = Math.max(200, Math.min(350, losers.length * 50));

    // Compute y-positions for each segment
    function computePositions(items: Array<{ name: string; total: number }>) {
      const positions: Array<{ name: string; total: number; y: number; h: number }> = [];
      let y = 0;
      for (const item of items) {
        const h = Math.max(MIN_SEGMENT_H, (item.total / maxFlow) * TARGET_H);
        positions.push({ ...item, y, h });
        y += h + SPACING;
      }
      return positions;
    }

    const loserPos = computePositions(losers);
    const gainerPos = computePositions(gainers);
    const svgH = Math.max(
      loserPos.length > 0 ? loserPos[loserPos.length - 1].y + loserPos[loserPos.length - 1].h : 100,
      gainerPos.length > 0 ? gainerPos[gainerPos.length - 1].y + gainerPos[gainerPos.length - 1].h : 100,
    ) + 20; // padding

    // X coordinates
    const leftBarX = LABEL_W;
    const rightBarX = LABEL_W + BAR_W + GAP;

    // Build flow band paths. Track the "used" y offset within each bar segment
    // so multiple flows from the same entity stack vertically within the bar.
    const loserUsedY = new Map<string, number>(loserPos.map(l => [l.name, l.y]));
    const gainerUsedY = new Map<string, number>(gainerPos.map(g => [g.name, g.y]));

    const bands = pairs.map((pair) => {
      const lp = loserPos.find(l => l.name === pair.fromCurator);
      const gp = gainerPos.find(g => g.name === pair.toCurator);
      if (!lp || !gp) return null;

      // Band height proportional to flow within the segment
      const bandH = Math.max(4, (pair.estimatedFlowUsd / maxFlow) * TARGET_H);

      const y1 = loserUsedY.get(pair.fromCurator)!;
      const y2 = gainerUsedY.get(pair.toCurator)!;
      loserUsedY.set(pair.fromCurator, y1 + bandH);
      gainerUsedY.set(pair.toCurator, y2 + bandH);

      // Curved filled band: cubic bezier from left bar edge to right bar edge
      const x1 = leftBarX + BAR_W;
      const x2 = rightBarX;
      const cx = (x1 + x2) / 2;

      // Path: top edge (left→right), then bottom edge (right→left)
      const d = [
        `M ${x1} ${y1}`,
        `C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
        `L ${x2} ${y2 + bandH}`,
        `C ${cx} ${y2 + bandH}, ${cx} ${y1 + bandH}, ${x1} ${y1 + bandH}`,
        'Z',
      ].join(' ');

      return {
        d,
        flow: pair.estimatedFlowUsd,
        from: pair.fromCurator,
        to: pair.toCurator,
        midY: (y1 + y2) / 2 + bandH / 2,
      };
    }).filter(Boolean) as Array<{ d: string; flow: number; from: string; to: string; midY: number }>;

    return { loserPos, gainerPos, bands, svgH, SVG_W, leftBarX, rightBarX, BAR_W, LABEL_W, GAP };
  }, [pairs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px] font-semibold">Capital Displacement</CardTitle>
        <p className="text-[11px] text-gray-500 mt-0.5 flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
          <span>
            Estimated flows based on magnitude correlation over {windowDays}d.
            Width proportional to estimated $ movement. Not proof of capital migration.
          </span>
        </p>
      </CardHeader>
      <CardContent>
        {error ? (
          <EmptyStateCard message="Failed to load flow data." />
        ) : isLoading || !layout ? (
          pairs.length === 0 && !isLoading ? (
            <EmptyStateCard message={`No correlated displacement in last ${windowDays}d.`} />
          ) : (
            <div className="h-40 animate-pulse bg-gray-100 rounded-lg" />
          )
        ) : (
          <div className="overflow-x-auto">
            <svg
              width="100%"
              viewBox={`0 0 ${layout.SVG_W} ${layout.svgH}`}
              className="mx-auto"
              style={{ maxWidth: layout.SVG_W }}
            >
              {/* Flow bands (rendered first so bars overlay) */}
              {layout.bands.map((band, i) => (
                <g key={`band-${i}`}>
                  <path
                    d={band.d}
                    fill="url(#sankeyGradient)"
                    opacity={0.35}
                    className="hover:opacity-60 transition-opacity"
                  />
                  {/* Flow label at midpoint */}
                  <text
                    x={layout.leftBarX + layout.BAR_W + layout.GAP / 2}
                    y={band.midY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-gray-600"
                    fontSize={10}
                    fontWeight={500}
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    {formatTvl(band.flow)}
                  </text>
                </g>
              ))}

              {/* Left bars (losers) */}
              {layout.loserPos.map((l, i) => (
                <g key={`loser-${i}`}>
                  <rect
                    x={layout.leftBarX}
                    y={l.y}
                    width={layout.BAR_W}
                    height={l.h}
                    rx={3}
                    className="fill-red-400"
                  />
                  {/* Label to the left */}
                  <text
                    x={layout.leftBarX - 8}
                    y={l.y + l.h / 2}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-gray-800"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {formatCuratorShortName(l.name)}
                  </text>
                  <text
                    x={layout.leftBarX - 8}
                    y={l.y + l.h / 2 + 13}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-red-500"
                    fontSize={9}
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    -{formatTvl(l.total)}
                  </text>
                </g>
              ))}

              {/* Right bars (gainers) */}
              {layout.gainerPos.map((g, i) => (
                <g key={`gainer-${i}`}>
                  <rect
                    x={layout.rightBarX}
                    y={g.y}
                    width={layout.BAR_W}
                    height={g.h}
                    rx={3}
                    className="fill-emerald-400"
                  />
                  {/* Label to the right */}
                  <text
                    x={layout.rightBarX + layout.BAR_W + 8}
                    y={g.y + g.h / 2}
                    textAnchor="start"
                    dominantBaseline="central"
                    className="fill-gray-800"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {formatCuratorShortName(g.name)}
                  </text>
                  <text
                    x={layout.rightBarX + layout.BAR_W + 8}
                    y={g.y + g.h / 2 + 13}
                    textAnchor="start"
                    dominantBaseline="central"
                    className="fill-emerald-600"
                    fontSize={9}
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    +{formatTvl(g.total)}
                  </text>
                </g>
              ))}

              {/* Gradient definition */}
              <defs>
                <linearGradient id="sankeyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EF4444" />
                  <stop offset="50%" stopColor="#9CA3AF" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
