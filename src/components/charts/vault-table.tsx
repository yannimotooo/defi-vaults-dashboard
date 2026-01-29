'use client';

import { useState, Fragment } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RiskBadge, RiskScoreBar } from '@/components/ui/risk-badge';
import { formatTvl, cn } from '@/lib/utils';
import { getChainColor } from '@/lib/colors';
import { ArrowUpDown, ChevronDown, ChevronUp, ChevronRight, AlertTriangle } from 'lucide-react';

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
  // Risk metrics
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  maxUtilization?: number;
  avgLltv?: number;
  hasBadDebt?: boolean;
  redWarningCount?: number;
  criticalWarnings?: string[];
  markets?: MarketRisk[];
}

interface VaultTableProps {
  vaults: Vault[];
  title?: string;
  showProject?: boolean;
  maxDisplay?: number;
}

type SortKey = 'tvl' | 'apy' | 'apyBase' | 'apyReward' | 'chain' | 'name';
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
      setSortOrder('desc');
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
                  Risk
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="apy" label="APY" />
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Util%
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  LLTV
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedVaults.map((vault, index) => (
                <Fragment key={vault.id}>
                  <tr
                    onClick={() => vault.riskLevel && setExpandedVault(expandedVault === vault.id ? null : vault.id)}
                    className={cn(
                      'border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors',
                      vault.riskLevel && 'cursor-pointer',
                      expandedVault === vault.id && 'bg-zinc-800/20'
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {vault.riskLevel ? (
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
                        <span className="text-[13px] text-zinc-400">{vault.project}</span>
                      </td>
                    )}
                    <td className="px-5 py-3 text-right">
                      <span className="font-mono text-white text-[14px]">
                        {formatTvl(vault.tvl)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {vault.riskLevel ? (
                        <div className="flex items-center justify-center gap-2">
                          <RiskBadge
                            riskLevel={vault.riskLevel}
                            riskScore={vault.riskScore}
                            compact
                          />
                          {vault.hasBadDebt && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn(
                        'font-mono text-[14px]',
                        vault.apy > 10 ? 'text-emerald-400' : vault.apy > 5 ? 'text-emerald-500/80' : 'text-zinc-300'
                      )}>
                        {vault.apy.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {vault.maxUtilization !== undefined ? (
                        <span className={cn(
                          'font-mono text-[13px]',
                          vault.maxUtilization > 0.95 ? 'text-red-400' :
                          vault.maxUtilization > 0.90 ? 'text-amber-400' :
                          vault.maxUtilization > 0.80 ? 'text-yellow-400' : 'text-zinc-400'
                        )}>
                          {(vault.maxUtilization * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {vault.avgLltv !== undefined ? (
                        <span className={cn(
                          'font-mono text-[13px]',
                          vault.avgLltv > 0.90 ? 'text-amber-400' : 'text-zinc-400'
                        )}>
                          {(vault.avgLltv * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                  {/* Expanded risk details */}
                  {expandedVault === vault.id && vault.markets && (
                    <tr className="bg-zinc-900/50">
                      <td colSpan={showProject ? 9 : 8} className="px-5 py-4">
                        <div className="pl-8">
                          <div className="flex items-center gap-4 mb-3">
                            <div>
                              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Risk Score</p>
                              <div className="w-32 mt-1">
                                <RiskScoreBar score={vault.riskScore || 0} />
                              </div>
                            </div>
                            {vault.criticalWarnings && vault.criticalWarnings.length > 0 && (
                              <div>
                                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Warnings</p>
                                <div className="flex gap-1 mt-1">
                                  {vault.criticalWarnings.map(w => (
                                    <span key={w} className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">
                                      {w.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                            Market Allocations ({vault.markets.length})
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {vault.markets.slice(0, 6).map((market) => (
                              <div
                                key={market.uniqueKey}
                                className={cn(
                                  'p-2 rounded border text-[12px]',
                                  market.hasRedWarning ? 'border-red-500/30 bg-red-500/5' :
                                  market.utilization > 0.95 ? 'border-amber-500/30 bg-amber-500/5' :
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
                                  <span className={cn(
                                    market.utilization > 0.95 ? 'text-red-400' :
                                    market.utilization > 0.90 ? 'text-amber-400' : 'text-zinc-500'
                                  )}>
                                    Util: {(market.utilization * 100).toFixed(0)}%
                                  </span>
                                  <span className="text-zinc-500">
                                    LLTV: {(market.lltv * 100).toFixed(0)}%
                                  </span>
                                  {market.hasBadDebt && (
                                    <span className="text-red-400">Bad Debt</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
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
