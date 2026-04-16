'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatFlow, formatCuratorShortName } from '@/lib/utils';
import { ArrowRight, TrendingUp, TrendingDown, Info } from 'lucide-react';

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Per-curator flow leaderboard (2/3 width) */}
      <Card className="lg:col-span-2">
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

      {/* RIGHT: Correlated displacement candidates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold">Displacement Candidates</CardTitle>
          <p className="text-[11px] text-gray-500 mt-0.5 flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
            <span>
              Heuristic only — paired by magnitude correlation. Not a proof of capital
              migration; verify with on-chain data before acting.
            </span>
          </p>
        </CardHeader>
        <CardContent>
          {error || isLoading || pairs.length === 0 ? (
            <EmptyStateCard
              message={
                error
                  ? 'Failed to load.'
                  : isLoading
                    ? 'Computing pairs...'
                    : `No correlated swaps in last ${window}d.`
              }
            />
          ) : (
            <ul className="space-y-3">
              {pairs.slice(0, 6).map((pair, i) => (
                <li
                  key={`${pair.fromCurator}-${pair.toCurator}-${i}`}
                  className="border border-gray-100 rounded-lg p-3 bg-gray-50/50 hover:bg-white hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-2 text-[12px] font-medium text-gray-900">
                    <span className="text-red-600">{formatCuratorShortName(pair.fromCurator)}</span>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span className="text-emerald-600">
                      {formatCuratorShortName(pair.toCurator)}
                    </span>
                  </div>
                  <div
                    className="text-[13px] font-semibold text-gray-900 mt-1"
                    style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
                  >
                    ~{formatFlow(pair.estimatedFlowUsd)}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-snug">
                    {pair.rationale}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
