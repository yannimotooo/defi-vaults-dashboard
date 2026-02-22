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
  Coins,
  TrendingUp,
  Lock,
  Activity,
  Layers,
  ExternalLink,
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
  curator?: string | null; // Curator from Morpho on-chain data
  isRawMarket?: boolean; // True if this is a raw lending market (no curator)
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
      className="flex items-center gap-1 hover:text-slate-300 transition-colors"
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
          <div className="text-center py-8 text-slate-500 text-[14px]">
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
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1">Portfolio</p>
            <CardTitle>{title}</CardTitle>
          </div>
          <span className="text-[12px] text-slate-600 font-mono">{vaults.length} vaults</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[28%] sm:w-[22%]" /> {/* Vault */}
              <col className="hidden sm:table-column w-[10%]" /> {/* Chain */}
              {showProject && <col className="hidden lg:table-column w-[9%]" />} {/* Protocol */}
              {showProject && <col className="hidden xl:table-column w-[12%]" />} {/* Curator */}
              <col className="w-[16%] sm:w-[11%]" /> {/* TVL */}
              <col className="w-[14%] sm:w-[10%]" /> {/* Rating */}
              <col className="w-[16%] sm:w-[12%]" /> {/* APY */}
              <col className="hidden md:table-column w-[9%]" /> {/* Buffer */}
            </colgroup>
            <thead>
              <tr className="border-b border-slate-700/35 bg-[#141922]/60">
                <th className="px-3 sm:px-5 py-3 text-left text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <SortButton columnKey="name" label="Vault" />
                </th>
                <th className="hidden sm:table-cell px-3 sm:px-5 py-3 text-left text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <SortButton columnKey="chain" label="Chain" />
                </th>
                {showProject && (
                  <th className="hidden lg:table-cell px-3 sm:px-5 py-3 text-left text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Protocol
                  </th>
                )}
                {showProject && (
                  <th className="hidden xl:table-cell px-3 sm:px-5 py-3 text-left text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Curator
                  </th>
                )}
                <th className="px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <div className="flex justify-end">
                    <SortButton columnKey="tvl" label="TVL" />
                  </div>
                </th>
                <th className="px-3 sm:px-5 py-3 text-center text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <SortButton columnKey="rating" label="Rating" />
                </th>
                <th className="px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <div className="flex justify-end">
                    <SortButton columnKey="apy" label="APY" />
                  </div>
                </th>
                <th className="hidden md:table-cell px-3 sm:px-5 py-3 text-right text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Buffer
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedVaults.map((vault, index) => {
                const hasRating = vault.creditRating;
                const hasRiskData = vault.markets || vault.maxUtilization !== undefined;
                const canExpand = true; // Always allow expansion to show basic info

                // Calculate stress buffer for display
                const stressBuffer = vault.avgLltv !== undefined && vault.maxUtilization !== undefined
                  ? (1 - vault.avgLltv) + (1 - vault.maxUtilization)
                  : null;

                return (
                  <Fragment key={vault.id}>
                    <tr
                      onClick={() => canExpand && setExpandedVault(expandedVault === vault.id ? null : vault.id)}
                      className={cn(
                        'border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors',
                        canExpand && 'cursor-pointer',
                        expandedVault === vault.id && 'bg-slate-700/20'
                      )}
                    >
                      <td className="px-3 sm:px-5 py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {canExpand ? (
                            expandedVault === vault.id ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                            )
                          ) : (
                            <span className="text-[11px] text-slate-600 font-mono w-4 flex-shrink-0">
                              {index + 1}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] sm:text-[14px] text-white truncate">{vault.symbol}</p>
                            {vault.poolMeta && (
                              <p className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 truncate">
                                {vault.poolMeta}
                              </p>
                            )}
                            {/* Show chain on mobile since column is hidden */}
                            <p className="sm:hidden text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ backgroundColor: getChainColor(vault.chain) }}
                              />
                              {vault.chain}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getChainColor(vault.chain) }}
                          />
                          <span className="text-[13px] text-slate-300">{vault.chain}</span>
                        </div>
                      </td>
                      {showProject && (
                        <td className="hidden lg:table-cell px-3 sm:px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getProtocolColor(vault.project) }}
                            />
                            <span className="text-[13px] text-slate-400 truncate">{vault.project}</span>
                          </div>
                        </td>
                      )}
                      {showProject && (
                        <td className="hidden xl:table-cell px-3 sm:px-5 py-3">
                          {vault.isRawMarket ? (
                            <span className="text-[11px] text-slate-500 bg-slate-700/35 px-1.5 py-0.5 rounded">
                              Market
                            </span>
                          ) : (
                            <span className="text-[13px] text-slate-400 truncate block max-w-[140px]">
                              {vault.curator || vault.poolMeta || '—'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 sm:px-5 py-3 text-right">
                        <span className="font-mono text-white text-[12px] sm:text-[14px]">
                          {formatTvl(vault.tvl)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-5 py-3">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          {hasRating ? (
                            <CompactRating rating={vault.creditRating!} />
                          ) : (
                            <div className="group relative">
                              <span className="text-[10px] sm:text-[11px] text-slate-500 bg-slate-700/35 px-1 sm:px-1.5 py-0.5 rounded cursor-help">
                                No Data
                              </span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-[#1a1f2e]/95 border border-slate-700/40 rounded-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="text-slate-300">Insufficient on-chain data</p>
                                <p className="text-slate-500">Raw market or non-Morpho vault</p>
                              </div>
                            </div>
                          )}
                          {vault.hasBadDebt && (
                            <AlertTriangle className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-red-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-5 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <ApyWithQuality
                            apy={vault.apy}
                            apyBase={vault.apyBase || vault.apy}
                            apyReward={vault.apyReward || 0}
                          />
                          {/* APY Breakdown inline - hidden on small screens */}
                          {vault.apy > 0 && (
                            <div className="hidden sm:flex items-center gap-2 mt-0.5 text-[10px]">
                              <span className="text-emerald-400/70">{(vault.apyBase || vault.apy).toFixed(1)}%</span>
                              <span className="text-slate-600">+</span>
                              <span className="text-amber-400/70">{(vault.apyReward || 0).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-5 py-3 text-right">
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
                            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-[#1a1f2e]/95 border border-slate-700/40 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                              <p className="text-slate-300 font-medium mb-1">Stress Buffer</p>
                              <div className="space-y-1 text-slate-500">
                                <p>LLTV Headroom: {((1 - (vault.avgLltv || 0)) * 100).toFixed(0)}%</p>
                                <p>Util Headroom: {((1 - (vault.maxUtilization || 0)) * 100).toFixed(0)}%</p>
                                <p className="border-t border-slate-700/40 pt-1 text-slate-400">
                                  Combined: {(stressBuffer * 100).toFixed(0)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                    {/* Expanded vault details */}
                    {expandedVault === vault.id && (
                      <tr className="bg-[#141922]/60">
                        <td colSpan={100} className="px-3 sm:px-5 py-4 sm:py-5">
                          <div className="sm:pl-8 space-y-4 sm:space-y-5">
                            {/* Quick Overview Section */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-slate-800/30 border border-slate-700/25">
                              {/* Chain */}
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <Layers className="h-3 w-3" /> Chain
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: getChainColor(vault.chain) }}
                                  />
                                  <span className="text-[13px] text-white">{vault.chain}</span>
                                </div>
                              </div>

                              {/* Protocol */}
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <Activity className="h-3 w-3" /> Protocol
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: getProtocolColor(vault.project) }}
                                  />
                                  <span className="text-[13px] text-white capitalize">{vault.project}</span>
                                </div>
                              </div>

                              {/* Curator */}
                              {vault.poolMeta && (
                                <div>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Curator
                                  </p>
                                  <span className="text-[13px] text-white">{vault.poolMeta}</span>
                                </div>
                              )}

                              {/* Strategy Type */}
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" /> Strategy
                                </p>
                                <span className={cn(
                                  'text-[13px]',
                                  vault.stablecoin ? 'text-blue-400' : 'text-purple-400'
                                )}>
                                  {vault.stablecoin ? 'Stablecoin Lending' : vault.exposure === 'single' ? 'Single Asset' : 'Multi-Asset'}
                                </span>
                              </div>

                              {/* TVL */}
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <Coins className="h-3 w-3" /> TVL
                                </p>
                                <span className="text-[13px] text-white font-mono">{formatTvl(vault.tvl)}</span>
                              </div>

                              {/* APY */}
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" /> APY
                                </p>
                                <span className="text-[13px] text-emerald-400 font-mono">{vault.apy.toFixed(2)}%</span>
                              </div>
                            </div>

                            {/* Risk Metrics Row */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              {/* Credit Rating */}
                              {hasRating && (
                                <div className="p-3 rounded-lg bg-slate-700/25 border border-slate-700/40">
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Credit Rating</p>
                                  <div className="flex items-center gap-2">
                                    <CompactRating rating={vault.creditRating!} />
                                    <span className={cn(
                                      'text-[10px] px-1.5 py-0.5 rounded',
                                      vault.creditRating!.investmentGrade
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-amber-500/15 text-amber-400'
                                    )}>
                                      {vault.creditRating!.investmentGrade ? 'IG' : 'Spec'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Utilization */}
                              {vault.maxUtilization !== undefined && (
                                <div className="p-3 rounded-lg bg-slate-700/25 border border-slate-700/40">
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Activity className="h-3 w-3" /> Utilization
                                  </p>
                                  <span className={cn(
                                    'text-[16px] font-mono',
                                    vault.maxUtilization > 0.95 ? 'text-red-400' :
                                    vault.maxUtilization > 0.85 ? 'text-amber-400' :
                                    vault.maxUtilization > 0.70 ? 'text-yellow-400' : 'text-emerald-400'
                                  )}>
                                    {(vault.maxUtilization * 100).toFixed(0)}%
                                  </span>
                                </div>
                              )}

                              {/* LLTV */}
                              {vault.avgLltv !== undefined && (
                                <div className="p-3 rounded-lg bg-slate-700/25 border border-slate-700/40">
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Lock className="h-3 w-3" /> Avg LLTV
                                  </p>
                                  <span className={cn(
                                    'text-[16px] font-mono',
                                    vault.avgLltv > 0.90 ? 'text-red-400' :
                                    vault.avgLltv > 0.80 ? 'text-amber-400' : 'text-slate-300'
                                  )}>
                                    {(vault.avgLltv * 100).toFixed(0)}%
                                  </span>
                                </div>
                              )}

                              {/* Stress Buffer */}
                              {stressBuffer !== null && (
                                <div className="p-3 rounded-lg bg-slate-700/25 border border-slate-700/40">
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Shield className="h-3 w-3" /> Stress Buffer
                                  </p>
                                  <span className={cn(
                                    'text-[16px] font-mono',
                                    stressBuffer >= 0.30 ? 'text-emerald-400' :
                                    stressBuffer >= 0.20 ? 'text-green-400' :
                                    stressBuffer >= 0.12 ? 'text-amber-400' : 'text-red-400'
                                  )}>
                                    {(stressBuffer * 100).toFixed(0)}%
                                  </span>
                                </div>
                              )}

                              {/* Warnings */}
                              {(vault.hasBadDebt || (vault.redWarningCount ?? 0) > 0) && (
                                <div className={cn(
                                  'p-3 rounded-lg border',
                                  vault.hasBadDebt ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
                                )}>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Warnings
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {vault.hasBadDebt && (
                                      <span className="text-[11px] text-red-400">Bad Debt</span>
                                    )}
                                    {(vault.redWarningCount ?? 0) > 0 && (
                                      <span className="text-[11px] text-amber-400">{vault.redWarningCount} Critical</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Collateral / Market Allocations */}
                            {vault.markets && vault.markets.length > 0 && (
                              <div>
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                                  <Coins className="h-3.5 w-3.5" /> Collateral Markets ({vault.markets.length})
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {vault.markets.slice(0, 6).map((market) => {
                                    const marketBuffer = (1 - market.lltv) + (1 - market.utilization);
                                    return (
                                      <div
                                        key={market.uniqueKey}
                                        className={cn(
                                          'p-3 rounded-lg border text-[12px]',
                                          market.hasRedWarning ? 'border-red-500/30 bg-red-500/5' :
                                          market.hasBadDebt ? 'border-amber-500/30 bg-amber-500/5' :
                                          'border-slate-700/40 bg-slate-700/25'
                                        )}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-white font-medium">
                                            {market.loanAsset} / {market.collateralAsset}
                                          </span>
                                          <span className="text-slate-400 font-mono text-[11px]">
                                            {formatTvl(market.allocationUsd)}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                                          <div>
                                            <span className="text-slate-500">LLTV</span>
                                            <p className="text-slate-300 font-mono">{(market.lltv * 100).toFixed(0)}%</p>
                                          </div>
                                          <div>
                                            <span className="text-slate-500">Util</span>
                                            <p className={cn(
                                              'font-mono',
                                              market.utilization > 0.95 ? 'text-red-400' :
                                              market.utilization > 0.90 ? 'text-amber-400' : 'text-slate-300'
                                            )}>
                                              {(market.utilization * 100).toFixed(0)}%
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-slate-500">Buffer</span>
                                            <p className={cn(
                                              'font-mono',
                                              marketBuffer >= 0.25 ? 'text-emerald-400' :
                                              marketBuffer >= 0.15 ? 'text-amber-400' : 'text-red-400'
                                            )}>
                                              {(marketBuffer * 100).toFixed(0)}%
                                            </p>
                                          </div>
                                        </div>
                                        {(market.hasBadDebt || market.hasRedWarning) && (
                                          <div className="mt-2 pt-2 border-t border-slate-700/30 flex gap-1">
                                            {market.hasBadDebt && (
                                              <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Bad Debt</span>
                                            )}
                                            {market.hasRedWarning && (
                                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Warning</span>
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
          <div className="px-5 py-3 border-t border-slate-700/30">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[13px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
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
    'NR': 'text-slate-500',
  };

  return (
    <div className="p-3 rounded-lg bg-slate-700/25 border border-slate-700/40">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-slate-500" />
        <span className="text-[11px] text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn('font-mono text-[18px] font-semibold', ratingColors[rating.rating])}>
          {rating.rating}
        </span>
        <span className="text-[10px] text-slate-600">{desc}</span>
      </div>
      {/* Top factor */}
      {rating.factors.length > 0 && (
        <p className="text-[10px] text-slate-500 mt-1 truncate">
          {rating.factors[0].name}: {rating.factors[0].assessment.toLowerCase()}
        </p>
      )}
    </div>
  );
}
