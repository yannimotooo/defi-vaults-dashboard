'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import { formatTvl, formatFlow } from '@/lib/utils';
import { TrendingUp, TrendingDown, Layers } from 'lucide-react';

interface Allocator {
  slug: string;
  name: string;
  tvl: number;
  chains: string[];
  change7d: number | null;
  change30d: number | null;
  chainTvls: Record<string, number>;
}

interface AllocatorsResponse {
  allocators: Allocator[];
  count: number;
  totalTvl: number;
  timestamp: string;
}

const fetcher = (url: string): Promise<AllocatorsResponse> =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`Failed: ${r.status}`);
    return r.json();
  });

export function AllocatorsTab() {
  const { data, error, isLoading } = useSWR<AllocatorsResponse>(
    '/api/allocators',
    fetcher,
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false },
  );

  const allocators = useMemo(() => data?.allocators ?? [], [data?.allocators]);

  // Aggregate chain distribution across all allocators
  const chainBreakdown = useMemo(() => {
    const chains = new Map<string, number>();
    for (const a of allocators) {
      for (const [chain, tvl] of Object.entries(a.chainTvls)) {
        chains.set(chain, (chains.get(chain) || 0) + tvl);
      }
    }
    return Array.from(chains.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [allocators]);

  if (error) {
    return <EmptyStateCard title="Capital Allocators" message="Failed to load allocator data." />;
  }

  return (
    <>
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px border border-gray-200 rounded-xl overflow-hidden mb-8">
        <StatCard
          title="Total Allocator TVL"
          value={formatTvl(data?.totalTvl ?? 0)}
          accent="blue"
        />
        <StatCard
          title="Active Allocators"
          value={String(data?.count ?? 0)}
          accent="cyan"
        />
        <StatCard
          title="Chains Covered"
          value={String(chainBreakdown.length)}
          accent="amber"
        />
        <StatCard
          title="Avg TVL / Allocator"
          value={data && data.count > 0 ? formatTvl(data.totalTvl / data.count) : '—'}
          accent="emerald"
        />
      </div>

      {/* Section: Chain Distribution */}
      <div className="mb-4 mt-2 border-t border-gray-200 pt-6">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Chain Distribution</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Where capital allocators deploy across chains.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {chainBreakdown.map(([chain, tvl]) => (
          <div key={chain} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">{chain}</p>
            <p className="text-[15px] font-semibold text-gray-900 mt-1" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
              {formatTvl(tvl)}
            </p>
          </div>
        ))}
      </div>

      {/* Section: Allocator Leaderboard */}
      <div className="mb-4 mt-2 border-t border-gray-200 pt-6">
        <h3 className="text-[13px] font-semibold text-gray-800 tracking-tight">Capital Allocators</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Vault platforms and capital allocators. These are NOT risk curators — they deploy capital
          across protocols, sometimes using third-party curators to manage individual vaults.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px]">Allocator Leaderboard</CardTitle>
            <span className="text-[12px] text-gray-400 font-mono">{allocators.length} allocators</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="space-y-2 animate-pulse p-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-gray-100" />
              ))}
            </div>
          ) : allocators.length === 0 ? (
            <EmptyStateCard message="No allocator data available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Allocator</th>
                    <th className="px-4 py-3 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">TVL</th>
                    <th className="px-4 py-3 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">7d Change</th>
                    <th className="px-4 py-3 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">30d Change</th>
                    <th className="px-4 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Chains</th>
                  </tr>
                </thead>
                <tbody>
                  {allocators.map((a, i) => {
                    const flow7d = a.change7d != null ? (a.tvl * a.change7d) / 100 : null;
                    const flow30d = a.change30d != null ? (a.tvl * a.change30d) / 100 : null;
                    return (
                      <tr key={a.slug} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-[13px] text-gray-900 font-medium">{a.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              {a.chains.length} chain{a.chains.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 text-[13px]">
                          {formatTvl(a.tvl)}
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          {flow7d != null ? (
                            <span className={`flex items-center justify-end gap-1 font-mono text-[12px] ${flow7d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {flow7d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatFlow(flow7d)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          {flow30d != null ? (
                            <span className={`flex items-center justify-end gap-1 font-mono text-[12px] ${flow30d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {flow30d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatFlow(flow30d)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {a.chains.slice(0, 4).map(chain => (
                              <span key={chain} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                                {chain}
                              </span>
                            ))}
                            {a.chains.length > 4 && (
                              <span className="text-[9px] text-gray-400 self-center">+{a.chains.length - 4}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
