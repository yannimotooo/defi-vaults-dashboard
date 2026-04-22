'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatTvl, formatCuratorShortName } from '@/lib/utils';

interface FlowEntity {
  name: string;
  flow: number; // negative = outflow, positive = inflow
}

interface FlowDiagramProps {
  /** Entities with their net flow values. Will be split into losers/gainers. */
  entities: FlowEntity[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  maxEntries?: number;
}

/**
 * Sankey-style flow diagram showing capital movement.
 *
 * Left stacked bars = entities with outflows (red).
 * Right stacked bars = entities with inflows (green).
 * Curved filled bands connect losers to gainers, width proportional to
 * the smaller of the two magnitudes (the "matched" portion of the flow).
 *
 * When used for protocol flows, the data is authoritative (DeFiLlama TVL
 * changes). When used for curator displacement, it's heuristic.
 *
 * Pure SVG — no charting library dependency.
 */
export function FlowDiagram({
  entities,
  title = 'Capital Flows',
  subtitle,
  isLoading,
  maxEntries = 6,
}: FlowDiagramProps) {
  const layout = useMemo(() => {
    const losers = entities
      .filter(e => e.flow < 0)
      .sort((a, b) => a.flow - b.flow) // most negative first
      .slice(0, maxEntries)
      .map(e => ({ name: e.name, total: Math.abs(e.flow) }));
    const gainers = entities
      .filter(e => e.flow > 0)
      .sort((a, b) => b.flow - a.flow) // largest gain first
      .slice(0, maxEntries)
      .map(e => ({ name: e.name, total: e.flow }));

    if (losers.length === 0 && gainers.length === 0) return null;

    // Layout constants
    const BAR_W = 14;
    const LABEL_W = 130;
    const GAP = 100;
    const SVG_W = LABEL_W + BAR_W + GAP + BAR_W + LABEL_W;
    const SPACING = 4;
    const MIN_SEG_H = 20;
    const MAX_TOTAL_H = 250;

    const totalLoser = losers.reduce((s, l) => s + l.total, 0);
    const totalGainer = gainers.reduce((s, g) => s + g.total, 0);
    const maxSideTotal = Math.max(totalLoser, totalGainer, 1);

    function computePositions(items: Array<{ name: string; total: number }>) {
      const totalH = Math.min(MAX_TOTAL_H, items.length * 45);
      const positions: Array<{ name: string; total: number; y: number; h: number }> = [];
      let y = 0;
      for (const item of items) {
        const h = Math.max(MIN_SEG_H, (item.total / maxSideTotal) * totalH);
        positions.push({ ...item, y, h });
        y += h + SPACING;
      }
      return positions;
    }

    const loserPos = computePositions(losers);
    const gainerPos = computePositions(gainers);
    const svgH = Math.max(
      loserPos.length > 0 ? loserPos[loserPos.length - 1].y + loserPos[loserPos.length - 1].h : 50,
      gainerPos.length > 0 ? gainerPos[gainerPos.length - 1].y + gainerPos[gainerPos.length - 1].h : 50,
    ) + 10;

    const leftBarX = LABEL_W;
    const rightBarX = LABEL_W + BAR_W + GAP;

    // Build flow bands: match losers to gainers by rank (top loser → top gainer).
    // This isn't proving capital paths — it's a visual showing the scale of
    // movement from outflow entities to inflow entities.
    const bands: Array<{
      d: string;
      flow: number;
      from: string;
      to: string;
      midY: number;
    }> = [];

    const pairCount = Math.min(loserPos.length, gainerPos.length);
    const loserUsedY = loserPos.map(l => l.y);
    const gainerUsedY = gainerPos.map(g => g.y);

    for (let i = 0; i < pairCount; i++) {
      const lp = loserPos[i];
      const gp = gainerPos[i];
      const matchedFlow = Math.min(lp.total, gp.total);
      const bandH = Math.max(4, (matchedFlow / maxSideTotal) * Math.min(MAX_TOTAL_H, pairCount * 45));

      const y1 = loserUsedY[i];
      const y2 = gainerUsedY[i];
      loserUsedY[i] += bandH;
      gainerUsedY[i] += bandH;

      const x1 = leftBarX + BAR_W;
      const x2 = rightBarX;
      const cx = (x1 + x2) / 2;

      const d = [
        `M ${x1} ${y1}`,
        `C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
        `L ${x2} ${y2 + bandH}`,
        `C ${cx} ${y2 + bandH}, ${cx} ${y1 + bandH}, ${x1} ${y1 + bandH}`,
        'Z',
      ].join(' ');

      bands.push({
        d,
        flow: matchedFlow,
        from: lp.name,
        to: gp.name,
        midY: (y1 + y2) / 2 + bandH / 2,
      });
    }

    return { loserPos, gainerPos, bands, svgH, SVG_W, leftBarX, rightBarX, BAR_W, GAP };
  }, [entities, maxEntries]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px] font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-40 animate-pulse bg-gray-100 rounded-lg" />
        ) : !layout ? (
          <EmptyStateCard message="No flow data available." />
        ) : (
          <div className="overflow-x-auto">
            <svg
              width="100%"
              viewBox={`0 0 ${layout.SVG_W} ${layout.svgH}`}
              className="mx-auto"
              style={{ maxWidth: layout.SVG_W }}
            >
              {/* Flow bands */}
              {layout.bands.map((band, i) => (
                <g key={`band-${i}`}>
                  <path
                    d={band.d}
                    fill="url(#sankeyGradient)"
                    opacity={0.3}
                    className="hover:opacity-50 transition-opacity"
                  />
                  <text
                    x={layout.leftBarX + layout.BAR_W + layout.GAP / 2}
                    y={band.midY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-gray-500"
                    fontSize={10}
                    fontWeight={500}
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    {formatTvl(band.flow)}
                  </text>
                </g>
              ))}

              {/* Left bars (outflows) */}
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
                  <text
                    x={layout.leftBarX - 6}
                    y={l.y + l.h / 2 - 6}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-gray-800"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {formatCuratorShortName(l.name)}
                  </text>
                  <text
                    x={layout.leftBarX - 6}
                    y={l.y + l.h / 2 + 8}
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

              {/* Right bars (inflows) */}
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
                  <text
                    x={layout.rightBarX + layout.BAR_W + 6}
                    y={g.y + g.h / 2 - 6}
                    textAnchor="start"
                    dominantBaseline="central"
                    className="fill-gray-800"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {formatCuratorShortName(g.name)}
                  </text>
                  <text
                    x={layout.rightBarX + layout.BAR_W + 6}
                    y={g.y + g.h / 2 + 8}
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

              <defs>
                <linearGradient id="sankeyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EF4444" />
                  <stop offset="50%" stopColor="#D1D5DB" />
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
