'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataConfidenceBadge } from '@/components/ui/data-source-badge';
import { RiskBadge } from '@/components/ui/risk-badge';
import { formatTvl, formatFlow, cn } from '@/lib/utils';
import { CURATOR_COLORS, FALLBACK_CURATOR_COLORS } from '@/lib/colors';
import type { Curator } from '@/types';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface CuratorLeaderboardProps {
  curators: Curator[];
}

export function CuratorLeaderboard({ curators }: CuratorLeaderboardProps) {
  const [expandedCurator, setExpandedCurator] = useState<string | null>(null);

  const toggleExpanded = (slug: string) => {
    setExpandedCurator(expandedCurator === slug ? null : slug);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curator Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider w-12">#</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Curator</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">TVL</th>
                <th className="px-5 py-3 text-center text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Risk</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Vaults</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">APY</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">7d Flow</th>
              </tr>
            </thead>
            <tbody>
              {curators.map((curator, index) => (
                <Fragment key={curator.slug}>
                  <tr
                    onClick={() => toggleExpanded(curator.slug)}
                    className={cn(
                      'border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors cursor-pointer',
                      expandedCurator === curator.slug && 'bg-zinc-800/20'
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {expandedCurator === curator.slug ? (
                          <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
                        )}
                        <span className="font-mono text-zinc-500 text-[13px]">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/curator/${curator.slug}`}
                        className="flex items-center gap-2.5 group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CURATOR_COLORS[curator.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length] }}
                        />
                        <div>
                          <p className="text-[14px] text-white group-hover:text-blue-400 transition-colors flex items-center gap-1">
                            {curator.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            {curator.protocols.slice(0, 2).join(' · ')}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-white text-[14px]">
                          {formatTvl(curator.totalTvl)}
                        </span>
                        {curator.dataConfidence && (
                          <DataConfidenceBadge
                            confidence={curator.dataConfidence}
                            tvlSource={curator.tvlSource}
                            duneTvl={curator.duneTvl}
                            defillamaTvl={curator.defillamaTvl || curator.totalTvl}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {curator.riskLevel ? (
                        <RiskBadge
                          riskLevel={curator.riskLevel}
                          riskScore={curator.riskScore}
                          compact
                        />
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-zinc-400 text-[14px]">{curator.vaultCount}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-emerald-400 text-[14px]">
                        {curator.avgApy.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={cn(
                        'font-mono text-[14px]',
                        curator.netFlow7d > 0 ? 'text-emerald-400' : curator.netFlow7d < 0 ? 'text-red-400' : 'text-zinc-500'
                      )}>
                        {formatFlow(curator.netFlow7d)}
                      </span>
                    </td>
                  </tr>
                  {expandedCurator === curator.slug && (
                    <tr key={`${curator.slug}-expanded`} className="bg-zinc-900/50">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pl-8">
                          <div>
                            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                              Chains ({curator.chains.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {curator.chains.map((chain) => (
                                <span
                                  key={chain}
                                  className="px-2 py-0.5 text-[12px] text-zinc-300 bg-zinc-800 rounded"
                                >
                                  {chain}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                              Protocols
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {curator.protocols.map((protocol) => (
                                <span
                                  key={protocol}
                                  className="px-2 py-0.5 text-[12px] text-zinc-300 bg-zinc-800 rounded"
                                >
                                  {protocol}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                              30d Flow
                            </p>
                            <span className={cn(
                              'font-mono text-[14px]',
                              curator.netFlow30d > 0 ? 'text-emerald-400' : curator.netFlow30d < 0 ? 'text-red-400' : 'text-zinc-500'
                            )}>
                              {formatFlow(curator.netFlow30d)}
                            </span>
                          </div>
                          {/* Risk Metrics */}
                          {curator.riskLevel && (
                            <div>
                              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                                Risk Details
                              </p>
                              <div className="space-y-1 text-[12px]">
                                <p className="text-zinc-400">
                                  Score: <span className="font-mono text-white">{curator.riskScore}/100</span>
                                </p>
                                {(curator.liquidationVolume7d ?? 0) > 0 && (
                                  <p className="text-zinc-400">
                                    7d Liquidations: <span className="font-mono text-amber-400">{formatTvl(curator.liquidationVolume7d!)}</span>
                                  </p>
                                )}
                                {curator.hasBadDebt && (
                                  <p className="text-red-400">Has Bad Debt</p>
                                )}
                                {(curator.redWarningCount ?? 0) > 0 && (
                                  <p className="text-red-400">{curator.redWarningCount} critical warnings</p>
                                )}
                                {curator.avgUtilization !== undefined && (
                                  <p className="text-zinc-400">
                                    Utilization: <span className="font-mono">{(curator.avgUtilization * 100).toFixed(0)}%</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {curator.duneTvl && (
                            <div>
                              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                                Dune TVL
                              </p>
                              <span className="font-mono text-[14px] text-zinc-400">
                                {formatTvl(curator.duneTvl)}
                              </span>
                              <p className="text-[10px] text-zinc-600 mt-0.5">
                                vs {formatTvl(curator.defillamaTvl || curator.totalTvl)} DeFiLlama
                              </p>
                            </div>
                          )}
                          {curator.avgPerformanceFee !== undefined && (
                            <div>
                              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                                Avg Perf Fee
                              </p>
                              <span className={cn(
                                'font-mono text-[14px]',
                                curator.avgPerformanceFee > 15 ? 'text-amber-400' :
                                curator.avgPerformanceFee > 10 ? 'text-zinc-300' : 'text-emerald-400'
                              )}>
                                {curator.avgPerformanceFee.toFixed(1)}%
                              </span>
                              {curator.estimatedAnnualRevenue !== undefined && (
                                <p className="text-[10px] text-zinc-600 mt-0.5">
                                  ~{formatTvl(curator.estimatedAnnualRevenue)}/yr revenue
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
