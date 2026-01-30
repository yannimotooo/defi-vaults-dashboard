'use client';

import { useState, Fragment } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CompactRating, PillarDetailCard } from '@/components/ui/credit-rating';
import { ApyWithQuality } from '@/components/ui/apy-quality-badge';
import { formatTvl, cn } from '@/lib/utils';
import { getChainColor, getProtocolColor } from '@/lib/colors';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  Shield,
  Droplets,
  Users,
  CheckCircle,
} from 'lucide-react';
import type { VaultCreditRating } from '@/lib/risk-rating';

interface MarketRisk {
  uniqueKey: string;
  loanAsset: string;
  collateralAsset: string;
  allocationUsd: number;
  allocationPct: number;
  lltv: number;
  utilization: number;
  hasRedWarning: boolean;
  hasBadDebt: boolean;
}

interface Vault {
  id: string;
  name: string;
  chain: string;
  project: string;
  symbol: string;
  tvl: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  apyChange7d: number;
  stablecoin: boolean;
  exposure: string;
  poolMeta: string | null;
  // Risk metrics (legacy)
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  maxUtilization?: number;
  avgLltv?: number;
  hasBadDebt?: boolean;
  redWarningCount?: number;
  criticalWarnings?: string[];
  markets?: MarketRisk[];
  // New credit rating
  creditRating?: VaultCreditRating;
}

interface VaultTableProps {
  vaults: Vault[];
  title?: string;
  showProject?: boolean;
  maxDisplay?: number;
}

type SortKey = 'tvl' | 'apy' | 'apyBase' | 'apyReward' | 'chain' | 'name' | 'rating';
type SortOrder = 'asc' | 'desc';

export function VaultTable({
  vaults,
  title = 'Vaults',
  showProject = false,
  maxDisplay = 20,
}: VaultTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('tvl');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showAll, setShowAll] = useState(false);
  const [expandedVault, setExpandedVault] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder(key === 'rating' ? 'asc' : 'desc'); // Lower score = better rating
    }
  };

  const sortedVaults = [...vaults].sort((a, b) => {
    let comparison = 0;

    switch (sortKey) {
      case 'tvl':
        comparison = a.tvl - b.tvl;
        break;
      case 'apy':
        comparison = a.apy - b.apy;
        break;
      case 'apyBase':
        comparison = a.apyBase - b.apyBase;
        break;
      case 'apyReward':
        comparison = a.apyReward - b.apyReward;
        break;
      case 'chain':
        comparison = a.chain.localeCompare(b.chain);
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'rating':
        // Sort by composite score (lower = better)
        const scoreA = a.creditRating?.compositeScore ?? 100;
        const scoreB = b.creditRating?.compositeScore ?? 100;
        comparison = scoreA - scoreB;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const displayedVaults = showAll ? sortedVaults : sortedVaults.slice(0, maxDisplay);
  const hasMore = sortedVaults.length > maxDisplay;

  const SortButton = ({ columnKey, label }: { columnKey: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(columnKey)}
      className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
    >
      {label}
      {sortKey === columnKey ? (
        sortOrder === 'desc' ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );

  if (vaults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-zinc-500 text-[14px]">
            No vault data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if any vaults have credit ratings
  const hasCreditRatings = vaults.some(v => v.creditRating);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <span className="text-[12px] text-zinc-500">{vaults.length} vaults</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="name" label="Vault" />
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="chain" label="Chain" />
                </th>
                {showProject && (
                  <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    Protocol
                  </th>
                )}
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="tvl" label="TVL" />
                </th>
                <th className="px-5 py-3 text-center text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="rating" label="Rating" />
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="apy" label="APY" />
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Buffer
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedVaults.map((vault, index) => {
                const hasRating = vault.creditRating;
                const canExpand = hasRating || vault.markets;

                // Calculate stress buffer for display
                const stressBuffer = vault.avgLltv !== undefined && vault.maxUtilization !== undefined
                  ? (1 - vault.avgLltv) + (1 - vault.maxUtilization)
                  : null;

                return (
                  <Fragment key={vault.id}>
                    <tr
                      onClick={() => canExpand && setExpandedVault(expandedVault === vault.id ? null : vault.id)}
                      className={cn(
                        'border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors',
                        canExpand && 'cursor-pointer',
                        expandedVault === vault.id && 'bg-zinc-800/20'
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {canExpand ? (
                            expandedVault === vault.id ? (
                              <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
                            )
                          ) : (
                            <span className="text-[11px] text-zinc-600 font-mono w-4">
                              {index + 1}
                            </span>
                          )}
                          <div>
                            <p className="text-[14px] text-white">{vault.symbol}</p>
                            {vault.poolMeta && (
                              <p className="text-[11px] text-zinc-600 mt-0.5">
                                {vault.poolMeta}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getChainColor(vault.chain) }}
                          />
                          <span className="text-[13px] text-zinc-300">{vault.chain}</span>
                        </div>
                      </td>
                      {showProject && (
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getProtocolColor(vault.project) }}
                            />
                            <span className="text-[13px] text-zinc-400">{vault.project}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono text-white text-[14px]">
                          {formatTvl(vault.tvl)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {hasRating ? (
                            <CompactRating rating={vault.creditRating!} />
                          ) : (
                            <span className="text-[11px] text-zinc-600">NR</span>
                          )}
                          {vault.hasBadDebt && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ApyWithQuality
                          apy={vault.apy}
                          apyBase={vault.apyBase || vault.apy}
                          apyReward={vault.apyReward || 0}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {stressBuffer !== null ? (
                          <div className="group relative inline-block">
                            <span className={cn(
                              'font-mono text-[13px]',
                              stressBuffer >= 0.30 ? 'text-emerald-400' :
                              stressBuffer >= 0.20 ? 'text-green-400' :
                              stressBuffer >= 0.12 ? 'text-amber-400' :
                              'text-red-400'
                            )}>
                              {(stressBuffer * 100).toFixed(0)}%
                            </span>
                            {/* Buffer tooltip */}
                            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                              <p className="text-zinc-300 font-medium mb-1">Stress Buffer</p>
                              <div className="space-y-1 text-zinc-500">
                                <p>LLTV Headroom: {((1 - (vault.avgLltv || 0)) * 100).toFixed(0)}%</p>
                                <p>Util Headroom: {((1 - (vault.maxUtilization || 0)) * 100).toFixed(0)}%</p>
                                <p className="border-t border-zinc-700 pt-1 text-zinc-400">
                                  Combined: {(stressBuffer * 100).toFixed(0)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                    {/* Expanded credit rating details */}
                    {expandedVault === vault.id && (
                      <tr className="bg-zinc-900/50">
                        <td colSpan={showProject ? 8 : 7} className="px-5 py-4">
                          <div className="pl-8 space-y-4">
                            {/* Credit Rating Breakdown */}
                            {hasRating && (
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider">
                                    Credit Rating Breakdown
                                  </p>
                                  <span className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full',
                                    vault.creditRating!.investmentGrade
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-amber-500/15 text-amber-400'
                                  )}>
                                    {vault.creditRating!.investmentGrade ? 'Investment Grade' : 'Speculative'}
                                  </span>
                                </div>

                                {/* Three Pillars Summary */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                  <PillarSummaryCard
                                    pillar="capital"
                                    rating={vault.creditRating!.capitalSafety}
                                  />
                                  <PillarSummaryCard
                                    pillar="liquidity"
                                    rating={vault.creditRating!.liquidityHealth}
                                  />
                                  <PillarSummaryCard
                                    pillar="curator"
                                    rating={vault.creditRating!.curatorQuality}
                                  />
                                </div>

                                {/* Key Insights */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  {vault.creditRating!.keyStrengths.length > 0 && (
                                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                      <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Key Strengths
                                      </p>
                                      <ul className="space-y-1">
                                        {vault.creditRating!.keyStrengths.slice(0, 2).map((s, i) => (
                                          <li key={i} className="text-[11px] text-emerald-400/80">{s}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {vault.creditRating!.keyRisks.length > 0 && (
                                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                      <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Key Risks
                                      </p>
                                      <ul className="space-y-1">
                                        {vault.creditRating!.keyRisks.slice(0, 2).map((r, i) => (
                                          <li key={i} className="text-[11px] text-amber-400/80">{r}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Rating Rationale */}
                                <p className="text-[12px] text-zinc-400 leading-relaxed">
                                  {vault.creditRating!.ratingRationale}
                                </p>
                              </div>
                            )}

                            {/* Market Allocations */}
                            {vault.markets && vault.markets.length > 0 && (
                              <div>
                                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                                  Market Allocations ({vault.markets.length})
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {vault.markets.slice(0, 6).map((market) => {
                                    // Calculate market stress buffer
                                    const marketBuffer = (1 - market.lltv) + (1 - market.utilization);

                                    return (
                                      <div
                                        key={market.uniqueKey}
                                        className={cn(
                                          'p-2 rounded border text-[12px]',
                                          market.hasRedWarning ? 'border-red-500/30 bg-red-500/5' :
                                          market.hasBadDebt ? 'border-amber-500/30 bg-amber-500/5' :
                                          'border-zinc-800 bg-zinc-800/30'
                                        )}
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-white font-medium">
                                            {market.loanAsset}/{market.collateralAsset}
                                          </span>
                                          <span className="text-zinc-500">
                                            {(market.allocationPct * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px]">
                                          <span className="text-zinc-500">
                                            LLTV: {(market.lltv * 100).toFixed(0)}%
                                          </span>
                                          <span className={cn(
                                            market.utilization > 0.95 ? 'text-red-400' :
                                            market.utilization > 0.90 ? 'text-amber-400' : 'text-zinc-500'
                                          )}>
                                            Util: {(market.utilization * 100).toFixed(0)}%
                                          </span>
                                          <span className={cn(
                                            marketBuffer >= 0.25 ? 'text-emerald-400' :
                                            marketBuffer >= 0.15 ? 'text-amber-400' : 'text-red-400'
                                          )}>
                                            Buffer: {(marketBuffer * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                        {(market.hasBadDebt || market.hasRedWarning) && (
                                          <div className="mt-1 flex gap-1">
                                            {market.hasBadDebt && (
                                              <span className="text-[10px] text-red-400 bg-red-500/10 px-1 py-0.5 rounded">
                                                Bad Debt
                                              </span>
                                            )}
                                            {market.hasRedWarning && (
                                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
                                                Warning
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="px-5 py-3 border-t border-zinc-800/40">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show all {sortedVaults.length} vaults
                </>
              )}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for pillar summary in expanded view
function PillarSummaryCard({
  pillar,
  rating,
}: {
  pillar: 'capital' | 'liquidity' | 'curator';
  rating: VaultCreditRating['capitalSafety'];
}) {
  const config = {
    capital: { icon: Shield, label: 'Capital Safety', desc: 'Risk of loss' },
    liquidity: { icon: Droplets, label: 'Liquidity', desc: 'Withdrawal ability' },
    curator: { icon: Users, label: 'Curator', desc: 'Management quality' },
  };

  const { icon: Icon, label, desc } = config[pillar];

  const ratingColors: Record<string, string> = {
    'AAA': 'text-emerald-400',
    'AA': 'text-emerald-400',
    'A': 'text-green-400',
    'BBB': 'text-yellow-400',
    'BB': 'text-amber-400',
    'B': 'text-orange-400',
    'CCC': 'text-red-400',
    'CC': 'text-red-400',
    'C': 'text-red-500',
    'NR': 'text-zinc-500',
  };

  return (
    <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-zinc-500" />
        <span className="text-[11px] text-zinc-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn('font-mono text-[18px] font-semibold', ratingColors[rating.rating])}>
          {rating.rating}
        </span>
        <span className="text-[10px] text-zinc-600">{desc}</span>
      </div>
      {/* Top factor */}
      {rating.factors.length > 0 && (
        <p className="text-[10px] text-zinc-500 mt-1 truncate">
          {rating.factors[0].name}: {rating.factors[0].assessment.toLowerCase()}
        </p>
      )}
    </div>
  );
}
