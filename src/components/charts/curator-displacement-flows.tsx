'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatFlow, formatCuratorShortName } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

type Window = 7 | 30 | 90;

interface CuratorFlow {
  curatorSlug: string;
  curatorName: string;
  startTvl: number | null;
  endTvl: number | null;
  netFlow: number | null;
  flowPercent: number | null;
}

interface CorrelatedPair {
  fromCurator: string;
  toCurator: string;
  estimatedFlowUsd: number;
  confidence: 'low';
  rationale: string;
}

interface FlowsResponse {
  windowDays: Window;
  curators: CuratorFlow[];
  correlatedPairs: CorrelatedPair[];
  error?: string;
}

const fetcher = (url: string): Promise<FlowsResponse> =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
  });

/**
 * Curator displacement flows view — Phase 3.
 *
 * Shows two panels side-by-side:
 *   1. Per-curator net flows leaderboard (gainers ↑ / losers ↓ over the window)
 *   2. Correlated displacement candidates (heuristic pairs where one curator's
 *      losses match another's gains in magnitude — useful as investigation seeds)
 *
 * Backed by /api/curators/flows. Window selector switches between 7d/30d/90d.
 */
export function CuratorDisplacementFlows() {
  const [window, setWindow] = useState<Window>(30);
  const { data, error, isLoading } = useSWR<FlowsResponse>(
    `/api/curators/flows?window=${window}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false },
  );

  const curators = data?.curators ?? [];
  const pairs = data?.correlatedPairs ?? [];
  const top = curators.slice(0, 12);

  return (
    <div>
      {/* Per-curator flow leaderboard */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[15px] font-semibold">Curator Net Flows</CardTitle>
            <p className="text-[11px] text-gray-500 mt-0.5">
              TVL change per curator over the selected window. Sourced from DeFiLlama daily history.
            </p>
          </div>
          <div className="flex gap-1 text-[11px]">
            {([7, 30, 90] as const).map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  window === w
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <EmptyStateCard message="Failed to load flow data. Try refreshing." />
          ) : isLoading && !data ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-9 rounded-md bg-gray-100" />
              ))}
            </div>
          ) : top.length === 0 ? (
            <EmptyStateCard message="No flow data available for this window." />
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400 border-b border-gray-200">
                  <th className="text-left py-2 font-medium">Curator</th>
                  <th className="text-right py-2 font-medium">Start TVL</th>
                  <th className="text-right py-2 font-medium">End TVL</th>
                  <th className="text-right py-2 font-medium">Net Flow</th>
                  <th className="text-right py-2 font-medium">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {top.map(c => {
                  const flow = c.netFlow ?? 0;
                  const positive = flow >= 0;
                  return (
                    <tr key={c.curatorSlug} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 font-medium text-gray-900">
                        {formatCuratorShortName(c.curatorName)}
                      </td>
                      <td
                        className="py-2 text-right text-gray-600"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {c.startTvl != null ? `$${(c.startTvl / 1e6).toFixed(1)}M` : '—'}
                      </td>
                      <td
                        className="py-2 text-right text-gray-600"
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {c.endTvl != null ? `$${(c.endTvl / 1e6).toFixed(1)}M` : '—'}
                      </td>
                      <td
                        className={`py-2 text-right font-semibold flex items-center justify-end gap-1 ${
                          positive ? 'text-emerald-600' : 'text-red-600'
                        }`}
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {positive ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {formatFlow(flow)}
                      </td>
                      <td
                        className={`py-2 text-right ${positive ? 'text-emerald-600' : 'text-red-600'}`}
                        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                      >
                        {c.flowPercent != null
                          ? `${c.flowPercent >= 0 ? '+' : ''}${c.flowPercent.toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Displacement pairs removed — now shown via protocol-level Sankey
          in the FlowsTab parent component */}
    </div>
  );
}
