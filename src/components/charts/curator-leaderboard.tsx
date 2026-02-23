'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataConfidenceBadge } from '@/components/ui/data-source-badge';
import { RiskBadge } from '@/components/ui/risk-badge';
import { formatTvl, formatFlow, cn } from '@/lib/utils';
import { CURATOR_COLORS, FALLBACK_CURATOR_COLORS, getProtocolColor } from '@/lib/colors';
import { ChainIcon, ProtocolIcon } from '@/components/ui/protocol-icon';
import type { Curator } from '@/types';
import { ChevronDown, ChevronRight, ExternalLink, AlertTriangle, TrendingDown } from 'lucide-react';

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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Rankings</p>
            <CardTitle>Curator Leaderboard</CardTitle>
          </div>
          <span className="text-[12px] text-gray-400 font-mono">{curators.length} curators</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 sm:px-5 py-3 text-left text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider w-10 sm:w-12">#</th>
                <th className="px-3 sm:px-5 py-3 text-left text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider">Curator</th>
                <th className="px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider">TVL</th>
                <th className="hidden sm:table-cell px-3 sm:px-5 py-3 text-center text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="hidden lg:table-cell px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider">7d Liqs</th>
                <th className="hidden md:table-cell px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider">Vaults</th>
                <th className="px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider">APY</th>
                <th className="hidden lg:table-cell px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider">7d Flow</th>
              </tr>
            </thead>
            <tbody>
              {curators.map((curator, index) => (
                <Fragment key={curator.slug}>
                  <tr
                    onClick={() => toggleExpanded(curator.slug)}
                    className={cn(
                      'border-b border-gray-200 hover:bg-gray-50 transition-all cursor-pointer',
                      expandedCurator === curator.slug && 'bg-gray-50',
                      expandedCurator !== curator.slug && index % 2 === 1 && 'bg-gray-50/70'
                    )}
                    style={{
                      borderLeft: `3px solid ${CURATOR_COLORS[curator.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length]}`,
                    }}
                  >
                    <td className="px-3 sm:px-5 py-3 sm:py-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {expandedCurator === curator.slug ? (
                          <ChevronDown className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="font-mono text-gray-500 text-[12px] sm:text-[13px]">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4">
                      <Link
                        href={`/curator/${curator.slug}`}
                        className="flex items-center gap-2 sm:gap-2.5 group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white/80"
                          style={{ backgroundColor: CURATOR_COLORS[curator.name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length] }}
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] sm:text-[14px] text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1 truncate">
                            {curator.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                            {curator.protocols.slice(0, 2).map((protocol, i) => (
                              <span key={protocol} className="flex items-center gap-1">
                                <ProtocolIcon name={protocol} size={12} className="flex-shrink-0" />
                                <span className="truncate">{protocol}</span>
                                {i < Math.min(curator.protocols.length, 2) - 1 && <span className="text-gray-400 ml-0.5">·</span>}
                              </span>
                            ))}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                        <span className="font-mono text-gray-900 text-[12px] sm:text-[14px]">
                          {formatTvl(curator.totalTvl)}
                        </span>
                        <span className="hidden sm:inline">
                          {curator.dataConfidence && (
                            <DataConfidenceBadge
                              confidence={curator.dataConfidence}
                              tvlSource={curator.tvlSource}
                              duneTvl={curator.duneTvl}
                              defillamaTvl={curator.defillamaTvl || curator.totalTvl}
                              morphoTvl={curator.morphoTvl}
                              hasApyData={curator.avgApy > 0}
                            />
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-5 py-3 sm:py-4 text-center">
                      {curator.riskLevel ? (
                        <RiskBadge
                          riskLevel={curator.riskLevel}
                          riskScore={curator.riskScore}
                          compact
                        />
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-5 py-3 sm:py-4 text-right">
                      {(curator.liquidationVolume7d ?? 0) > 0 ? (
                        <span className={cn(
                          'font-mono text-[12px]',
                          curator.liquidationVolume7d! > 1_000_000 ? 'text-red-600' :
                          curator.liquidationVolume7d! > 100_000 ? 'text-amber-600' : 'text-gray-500'
                        )}>
                          {formatTvl(curator.liquidationVolume7d!)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">$0</span>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-5 py-3 sm:py-4 text-right">
                      <span
                        className={cn(
                          'font-mono text-[14px]',
                          curator.vaultCountEstimated ? 'text-gray-400' : 'text-gray-500'
                        )}
                        title={curator.vaultCountEstimated ? 'Estimated from TVL' : 'Actual vault count'}
                      >
                        {curator.vaultCountEstimated ? `~${curator.vaultCount}` : curator.vaultCount}
                      </span>
                    </td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4 text-right">
                      {curator.avgApy > 0 ? (
                        <div className="group relative inline-block">
                          <span className="font-mono text-emerald-600 text-[12px] sm:text-[14px] cursor-help">
                            {curator.avgApy.toFixed(1)}%
                          </span>
                          {/* APY Tooltip with Gross/Net breakdown - hidden on mobile */}
                          {(curator.grossApy || curator.netApy || curator.avgPerformanceFee) && (
                            <div className="hidden sm:block absolute bottom-full right-0 mb-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                              <div className="space-y-1">
                                {curator.grossApy !== undefined && (
                                  <p className="text-gray-500">
                                    Gross APY: <span className="font-mono text-gray-900">{curator.grossApy.toFixed(2)}%</span>
                                  </p>
                                )}
                                {curator.avgPerformanceFee !== undefined && (
                                  <p className="text-gray-500">
                                    Perf Fee: <span className="font-mono text-amber-600">-{curator.avgPerformanceFee.toFixed(1)}%</span>
                                  </p>
                                )}
                                {curator.netApy !== undefined && (
                                  <p className="text-gray-500 border-t border-gray-200 pt-1 mt-1">
                                    Net APY: <span className="font-mono text-emerald-600">{curator.netApy.toFixed(2)}%</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400" title="APY data not available">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-5 py-3 sm:py-4 text-right">
                      <span className={cn(
                        'font-mono text-[14px]',
                        curator.netFlow7d > 0 ? 'text-emerald-600' : curator.netFlow7d < 0 ? 'text-red-600' : 'text-gray-500'
                      )}>
                        {formatFlow(curator.netFlow7d)}
                      </span>
                    </td>
                  </tr>
                  {expandedCurator === curator.slug && (
                    <tr key={`${curator.slug}-expanded`} className="bg-gray-50">
                      <td colSpan={100} className="px-3 sm:px-5 py-4 sm:py-5">
                        <div className="sm:pl-8 space-y-4">
                          {/* Row 1: Basic Info */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                            <div>
                              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                                Chains ({curator.chains.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {curator.chains.map((chain) => (
                                  <span
                                    key={chain}
                                    className="px-2 py-0.5 text-[12px] text-gray-700 bg-gray-100 rounded flex items-center gap-1.5"
                                  >
                                    <ChainIcon name={chain} size={12} />
                                    {chain}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                                Protocols
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {curator.protocols.map((protocol) => (
                                  <span
                                    key={protocol}
                                    className="px-2 py-0.5 text-[12px] text-gray-700 bg-gray-100 rounded flex items-center gap-1.5"
                                  >
                                    <ProtocolIcon name={protocol} size={12} />
                                    {protocol}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {curator.netFlow30d !== 0 && (
                              <div>
                                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                                  30d Flow
                                </p>
                                <span className={cn(
                                  'font-mono text-[14px]',
                                  curator.netFlow30d > 0 ? 'text-emerald-600' : curator.netFlow30d < 0 ? 'text-red-600' : 'text-gray-500'
                                )}>
                                  {formatFlow(curator.netFlow30d)}
                                </span>
                              </div>
                            )}
                            {curator.avgPerformanceFee !== undefined && (
                              <div>
                                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                                  Fee Structure
                                </p>
                                <div className="space-y-0.5">
                                  <p className="text-[12px]">
                                    <span className="text-gray-500">Perf:</span>{' '}
                                    <span className={cn(
                                      'font-mono',
                                      curator.avgPerformanceFee > 15 ? 'text-amber-600' :
                                      curator.avgPerformanceFee > 10 ? 'text-gray-700' : 'text-emerald-600'
                                    )}>
                                      {curator.avgPerformanceFee.toFixed(1)}%
                                    </span>
                                  </p>
                                  {curator.avgManagementFee !== undefined && curator.avgManagementFee > 0 && (
                                    <p className="text-[12px]">
                                      <span className="text-gray-500">Mgmt:</span>{' '}
                                      <span className="font-mono text-gray-500">{curator.avgManagementFee.toFixed(2)}%</span>
                                    </p>
                                  )}
                                  {curator.estimatedAnnualRevenue !== undefined && curator.estimatedAnnualRevenue > 0 && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      Est. {formatTvl(curator.estimatedAnnualRevenue)}/yr
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            {curator.duneTvl && (
                              <div>
                                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                                  Cross-Reference
                                </p>
                                <span className="font-mono text-[13px] text-gray-500">
                                  {formatTvl(curator.duneTvl)}
                                </span>
                                <p className="text-[10px] text-gray-400">Dune Analytics</p>
                              </div>
                            )}
                          </div>

                          {/* Row 2: Risk & Health - Always show if any risk data exists */}
                          {(curator.riskLevel || (curator.liquidationVolume7d ?? 0) > 0 || curator.hasBadDebt || curator.avgUtilization !== undefined || curator.riskScore !== undefined) && (
                            <div className="border-t border-gray-200 pt-4">
                              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                Risk & Health Metrics
                                {curator.hasBadDebt && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium bg-red-50 text-red-600 rounded flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    BAD DEBT
                                  </span>
                                )}
                                {(curator.redWarningCount ?? 0) > 0 && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-50 text-amber-600 rounded">
                                    {curator.redWarningCount} WARNING{curator.redWarningCount! > 1 ? 'S' : ''}
                                  </span>
                                )}
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {curator.riskScore !== undefined && (
                                  <div>
                                    <p className="text-[10px] text-gray-400 mb-1">Risk Score</p>
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        'font-mono text-[14px]',
                                        curator.riskScore < 30 ? 'text-emerald-600' :
                                        curator.riskScore < 50 ? 'text-amber-600' :
                                        curator.riskScore < 70 ? 'text-orange-600' : 'text-red-600'
                                      )}>
                                        {curator.riskScore}
                                      </span>
                                      <span className="text-[11px] text-gray-400">/100</span>
                                    </div>
                                  </div>
                                )}
                                {curator.avgUtilization !== undefined && (
                                  <div>
                                    <p className="text-[10px] text-gray-400 mb-1">Avg Utilization</p>
                                    <span className={cn(
                                      'font-mono text-[14px]',
                                      curator.avgUtilization > 0.95 ? 'text-red-600' :
                                      curator.avgUtilization > 0.85 ? 'text-amber-600' :
                                      curator.avgUtilization > 0.70 ? 'text-yellow-600' : 'text-gray-700'
                                    )}>
                                      {(curator.avgUtilization * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                )}
                                {(curator.liquidationVolume7d ?? 0) > 0 && (
                                  <div>
                                    <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                                      <TrendingDown className="h-3 w-3" />
                                      7d Liquidations
                                    </p>
                                    <span className={cn(
                                      'font-mono text-[14px]',
                                      curator.liquidationVolume7d! > 1_000_000 ? 'text-red-600' :
                                      curator.liquidationVolume7d! > 100_000 ? 'text-amber-600' : 'text-gray-700'
                                    )}>
                                      {formatTvl(curator.liquidationVolume7d!)}
                                    </span>
                                  </div>
                                )}
                                {(curator.liquidationVolume24h ?? 0) > 0 && (
                                  <div>
                                    <p className="text-[10px] text-gray-400 mb-1">24h Liquidations</p>
                                    <span className={cn(
                                      'font-mono text-[14px]',
                                      curator.liquidationVolume24h! > 500_000 ? 'text-red-600' :
                                      curator.liquidationVolume24h! > 50_000 ? 'text-amber-600' : 'text-gray-700'
                                    )}>
                                      {formatTvl(curator.liquidationVolume24h!)}
                                    </span>
                                  </div>
                                )}
                                {curator.yellowWarningCount !== undefined && curator.yellowWarningCount > 0 && (
                                  <div>
                                    <p className="text-[10px] text-gray-400 mb-1">Yellow Warnings</p>
                                    <span className="font-mono text-[14px] text-yellow-600">
                                      {curator.yellowWarningCount}
                                    </span>
                                  </div>
                                )}
                              </div>
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
