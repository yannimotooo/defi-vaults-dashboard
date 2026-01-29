'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, cn } from '@/lib/utils';
import { getChainColor } from '@/lib/colors';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

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
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="apy" label="APY" />
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="apyBase" label="Base" />
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <SortButton columnKey="apyReward" label="Rewards" />
                </th>
                <th className="px-5 py-3 text-center text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedVaults.map((vault, index) => (
                <tr
                  key={vault.id}
                  className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-600 font-mono w-5">
                        {index + 1}
                      </span>
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
                  <td className="px-5 py-3 text-right">
                    <span className={cn(
                      'font-mono text-[14px]',
                      vault.apy > 10 ? 'text-emerald-400' : vault.apy > 5 ? 'text-emerald-500/80' : 'text-zinc-300'
                    )}>
                      {vault.apy.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-zinc-400 text-[13px]">
                      {vault.apyBase.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn(
                      'font-mono text-[13px]',
                      vault.apyReward > 0 ? 'text-purple-400' : 'text-zinc-600'
                    )}>
                      {vault.apyReward > 0 ? `+${vault.apyReward.toFixed(2)}%` : '-'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={cn(
                      'px-2 py-0.5 text-[11px] rounded',
                      vault.stablecoin
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-amber-500/20 text-amber-400'
                    )}>
                      {vault.stablecoin ? 'Stable' : 'Volatile'}
                    </span>
                  </td>
                </tr>
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
