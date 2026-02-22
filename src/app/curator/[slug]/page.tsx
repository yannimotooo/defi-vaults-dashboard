'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatCard } from '@/components/ui/stat-card';
import { HistoricalTvlChart } from '@/components/charts/historical-tvl-chart';
import { VaultTable } from '@/components/charts/vault-table';
import { YieldQualityChart } from '@/components/charts/yield-quality-chart';
import { CuratorEconomics } from '@/components/charts/curator-economics';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, formatFlow, cn } from '@/lib/utils';
import { CURATOR_COLORS, getChainColor, getProtocolColor } from '@/lib/colors';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import type { Curator } from '@/types';

interface HistoricalDataPoint {
  date: number;
  tvl: number;
}

interface VaultData {
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

export default function CuratorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [curator, setCurator] = useState<Curator | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [allCurators, setAllCurators] = useState<Curator[]>([]);
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch current curator data
        const curatorsRes = await fetch('/api/curators');
        if (curatorsRes.ok) {
          const data = await curatorsRes.json();
          setAllCurators(data.curators || []);
          const foundCurator = data.curators?.find((c: Curator) => c.slug === slug);
          setCurator(foundCurator || null);
        }

        // Fetch historical data
        const historicalRes = await fetch(`/api/curators/historical?slug=${slug}`);
        if (historicalRes.ok) {
          const data = await historicalRes.json();
          setHistoricalData(data.data || []);
        }

        // Fetch vault data for this curator
        const vaultsRes = await fetch(`/api/vaults?curator=${slug}`);
        if (vaultsRes.ok) {
          const data = await vaultsRes.json();
          setVaults(data.vaults || []);
        }
      } catch (error) {
        console.error('Error fetching curator data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchData();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center">
        <div className="text-slate-500">Loading curator data...</div>
      </div>
    );
  }

  if (!curator) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Curator not found</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const curatorColor = CURATOR_COLORS[curator.name] || '#6366F1';
  const rank = allCurators.findIndex(c => c.slug === curator.slug) + 1;
  const totalMarketTvl = allCurators.reduce((sum, c) => sum + c.totalTvl, 0);
  const marketShare = (curator.totalTvl / totalMarketTvl) * 100;

  // Calculate real chain allocation from vault data
  const chainAllocation = vaults.reduce((acc, vault) => {
    acc[vault.chain] = (acc[vault.chain] || 0) + vault.tvl;
    return acc;
  }, {} as Record<string, number>);

  const totalVaultTvl = Object.values(chainAllocation).reduce((sum, tvl) => sum + tvl, 0);
  const chainAllocationSorted = Object.entries(chainAllocation)
    .map(([chain, tvl]) => ({
      chain,
      tvl,
      percent: totalVaultTvl > 0 ? (tvl / totalVaultTvl) * 100 : 0,
    }))
    .sort((a, b) => b.tvl - a.tvl);

  // Calculate real protocol allocation from vault data
  const protocolAllocation = vaults.reduce((acc, vault) => {
    acc[vault.project] = (acc[vault.project] || 0) + vault.tvl;
    return acc;
  }, {} as Record<string, number>);

  const protocolAllocationSorted = Object.entries(protocolAllocation)
    .map(([protocol, tvl]) => ({
      protocol,
      tvl,
      percent: totalVaultTvl > 0 ? (tvl / totalVaultTvl) * 100 : 0,
    }))
    .sort((a, b) => b.tvl - a.tvl);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white">
      {/* Header */}
      <header className="border-b border-slate-700/35 sticky top-0 z-50 bg-[#0b0f19]/95 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-md hover:bg-slate-700/40 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: curatorColor }}
              >
                {curator.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">{curator.name}</h1>
                <p className="text-[13px] text-slate-500">
                  Rank #{rank} • {curator.protocols.join(', ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Key Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-slate-700/40 rounded-lg overflow-hidden mb-8 border border-slate-700/35">
          <div className="bg-[#111827]/80">
            <StatCard title="Total TVL" value={curator.totalTvl} />
          </div>
          <div className="bg-[#111827]/80">
            <StatCard title="Market Share" value={marketShare} format="percent" />
          </div>
          <div className="bg-[#111827]/80">
            <StatCard title="Vaults" value={curator.vaultCount} format="number" />
          </div>
          <div className="bg-[#111827]/80">
            <StatCard title="Avg APY" value={curator.avgApy} format="percent" />
          </div>
          <div className="bg-[#111827]/80">
            <div className="p-5">
              <p className="text-[13px] text-slate-500 font-medium">7d Flow</p>
              <p className={cn(
                'mt-2 text-[28px] font-semibold tracking-tight font-mono',
                curator.netFlow7d > 0 ? 'text-emerald-400' : curator.netFlow7d < 0 ? 'text-red-400' : 'text-white'
              )}>
                {formatFlow(curator.netFlow7d)}
              </p>
            </div>
          </div>
        </div>

        {/* Historical Chart */}
        <div className="mb-8">
          <HistoricalTvlChart
            data={historicalData}
            title="TVL History"
            color={curatorColor}
            height={350}
          />
        </div>

        {/* Vault Table */}
        {vaults.length > 0 && (
          <div className="mb-8">
            <VaultTable
              vaults={vaults}
              title={`${curator.name} Vaults`}
              maxDisplay={15}
            />
          </div>
        )}

        {/* Yield Quality Analysis */}
        {vaults.length > 0 && (
          <div className="mb-8">
            <YieldQualityChart
              vaults={vaults}
              title="Yield Quality Analysis"
              curatorName={curator.name}
            />
          </div>
        )}

        {/* Curator Economics / Fee Analysis */}
        <div className="mb-8">
          <CuratorEconomics
            curatorSlug={slug}
            curatorName={curator.name}
            curatorColor={curatorColor}
          />
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Chain Allocation - calculated from actual vault TVL */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Chain Allocation</CardTitle>
                {vaults.length === 0 && (
                  <span className="text-[11px] text-slate-600">No vault data</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {chainAllocationSorted.length > 0 ? (
                <div className="space-y-4">
                  {chainAllocationSorted.map((item) => (
                    <div key={item.chain} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getChainColor(item.chain) }}
                          />
                          <span className="text-[14px] text-slate-300">{item.chain}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[14px] font-mono text-white">
                            {item.percent.toFixed(1)}%
                          </span>
                          <span className="text-[12px] font-mono text-slate-600 ml-2">
                            {formatTvl(item.tvl)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: getChainColor(item.chain),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-[13px]">
                  {curator.chains.length > 0 ? (
                    <div className="space-y-2">
                      <p>Chains: {curator.chains.join(', ')}</p>
                      <p className="text-[11px] text-slate-600">TVL breakdown unavailable</p>
                    </div>
                  ) : (
                    'No chain data available'
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Protocol Allocation - calculated from actual vault TVL */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Protocol Allocation</CardTitle>
                {vaults.length === 0 && (
                  <span className="text-[11px] text-slate-600">No vault data</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {protocolAllocationSorted.length > 0 ? (
                <div className="space-y-4">
                  {protocolAllocationSorted.map((item) => (
                    <div key={item.protocol} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getProtocolColor(item.protocol) }}
                          />
                          <span className="text-[14px] text-slate-300">{item.protocol}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[14px] font-mono text-white">
                            {item.percent.toFixed(1)}%
                          </span>
                          <span className="text-[12px] font-mono text-slate-600 ml-2">
                            {formatTvl(item.tvl)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: getProtocolColor(item.protocol),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-[13px]">
                  {curator.protocols.length > 0 ? (
                    <div className="space-y-2">
                      <p>Protocols: {curator.protocols.join(', ')}</p>
                      <p className="text-[11px] text-slate-600">TVL breakdown unavailable</p>
                    </div>
                  ) : (
                    'No protocol data available'
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Flow Analysis */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Flow Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[12px] text-slate-500 uppercase tracking-wider mb-1">7 Day</p>
                <div className="flex items-center gap-2">
                  {curator.netFlow7d > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : curator.netFlow7d < 0 ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : null}
                  <span className={cn(
                    'text-[18px] font-mono font-semibold',
                    curator.netFlow7d > 0 ? 'text-emerald-400' : curator.netFlow7d < 0 ? 'text-red-400' : 'text-slate-400'
                  )}>
                    {formatFlow(curator.netFlow7d)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[12px] text-slate-500 uppercase tracking-wider mb-1">30 Day</p>
                <div className="flex items-center gap-2">
                  {curator.netFlow30d > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : curator.netFlow30d < 0 ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : null}
                  <span className={cn(
                    'text-[18px] font-mono font-semibold',
                    curator.netFlow30d > 0 ? 'text-emerald-400' : curator.netFlow30d < 0 ? 'text-red-400' : 'text-slate-400'
                  )}>
                    {formatFlow(curator.netFlow30d)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[12px] text-slate-500 uppercase tracking-wider mb-1">7d Change %</p>
                <span className={cn(
                  'text-[18px] font-mono font-semibold',
                  curator.netFlow7d > 0 ? 'text-emerald-400' : curator.netFlow7d < 0 ? 'text-red-400' : 'text-slate-400'
                )}>
                  {curator.totalTvl > 0
                    ? `${curator.netFlow7d >= 0 ? '+' : ''}${((curator.netFlow7d / curator.totalTvl) * 100).toFixed(2)}%`
                    : '0%'}
                </span>
              </div>
              <div>
                <p className="text-[12px] text-slate-500 uppercase tracking-wider mb-1">30d Change %</p>
                <span className={cn(
                  'text-[18px] font-mono font-semibold',
                  curator.netFlow30d > 0 ? 'text-emerald-400' : curator.netFlow30d < 0 ? 'text-red-400' : 'text-slate-400'
                )}>
                  {curator.totalTvl > 0
                    ? `${curator.netFlow30d >= 0 ? '+' : ''}${((curator.netFlow30d / curator.totalTvl) * 100).toFixed(2)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Peers Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Peer Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/35">
                  <th className="px-5 py-3 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">Curator</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider">TVL</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider">APY</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider">7d Flow</th>
                </tr>
              </thead>
              <tbody>
                {allCurators.slice(0, 8).map((c, index) => (
                  <tr
                    key={c.slug}
                    className={cn(
                      'border-b border-slate-700/30 transition-colors',
                      c.slug === curator.slug ? 'bg-slate-700/25' : 'hover:bg-slate-700/20'
                    )}
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-slate-500 text-[13px]">{index + 1}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/curator/${c.slug}`}
                        className={cn(
                          'text-[14px] hover:text-blue-400 transition-colors',
                          c.slug === curator.slug ? 'text-white font-medium' : 'text-slate-300'
                        )}
                      >
                        {c.name}
                        {c.slug === curator.slug && ' ←'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-mono text-white text-[14px]">{formatTvl(c.totalTvl)}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-mono text-emerald-400 text-[14px]">{c.avgApy.toFixed(1)}%</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn(
                        'font-mono text-[14px]',
                        c.netFlow7d > 0 ? 'text-emerald-400' : c.netFlow7d < 0 ? 'text-red-400' : 'text-slate-500'
                      )}>
                        {formatFlow(c.netFlow7d)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-slate-700/35">
          <div className="flex items-center justify-between text-[12px] text-slate-600">
            <Link href="/" className="hover:text-slate-400 transition-colors">
              ← Back to Dashboard
            </Link>
            <span>Data from DeFiLlama</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

// Colors imported from @/lib/colors
