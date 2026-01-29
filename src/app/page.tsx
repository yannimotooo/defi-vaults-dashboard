'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { TvlByChainChart } from '@/components/charts/tvl-by-chain';
import { TvlByProtocolChart } from '@/components/charts/tvl-by-protocol';
import { ProtocolTable } from '@/components/charts/protocol-table';
import { CuratorLeaderboard } from '@/components/charts/curator-leaderboard';
import { CuratorTvlChart } from '@/components/charts/curator-tvl-chart';
import { CuratorComparisonChart } from '@/components/charts/curator-comparison-chart';
import { VaultTable } from '@/components/charts/vault-table';
import { YieldQualityChart } from '@/components/charts/yield-quality-chart';
import { DataSourceBadge } from '@/components/ui/data-source-badge';
import { formatTvl } from '@/lib/utils';
import type { MarketOverview, Curator, DataValidation } from '@/types';
import { RefreshCw, LayoutDashboard, Users, Layers, Vault } from 'lucide-react';

type Tab = 'overview' | 'curators' | 'protocols' | 'vaults';

interface HistoricalCuratorData {
  name: string;
  slug: string;
  color: string;
  data: { date: number; tvl: number }[];
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

export default function Dashboard() {
  const [overviewData, setOverviewData] = useState<MarketOverview | null>(null);
  const [curators, setCurators] = useState<Curator[]>([]);
  const [curatorValidation, setCuratorValidation] = useState<DataValidation | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalCuratorData[]>([]);
  const [topVaults, setTopVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const fetchData = async () => {
    try {
      setLoading(true);

      const [overviewRes, curatorsRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/curators'),
      ]);

      if (!overviewRes.ok) throw new Error('Failed to fetch overview');

      const overview = await overviewRes.json();
      setOverviewData(overview);

      if (curatorsRes.ok) {
        const curatorData = await curatorsRes.json();
        setCurators(curatorData.curators || []);
        setCuratorValidation(curatorData.validation || null);
      }

      // Fetch historical data (non-blocking) with abort controller
      const historicalController = new AbortController();
      fetch('/api/curators/historical', { signal: historicalController.signal })
        .then(res => res.json())
        .then(data => {
          if (data.curators) {
            setHistoricalData(data.curators);
          }
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error(err);
        });

      // Fetch top vaults (non-blocking) with abort controller
      const vaultsController = new AbortController();
      fetch('/api/vaults?limit=100', { signal: vaultsController.signal })
        .then(res => res.json())
        .then(data => {
          if (data.vaults) {
            setTopVaults(data.vaults);
          }
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error(err);
        });

      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !overviewData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading DeFi Vault data...</p>
        </div>
      </div>
    );
  }

  if (error && !overviewData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!overviewData) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/60 sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">
                DeFi Vault Dashboard
              </h1>
              <p className="text-[13px] text-zinc-500">Cross-chain vault & curator analytics</p>
            </div>
            <div className="flex items-center gap-4">
              {curatorValidation && (
                <div className="hidden sm:flex items-center gap-2 text-[12px] text-zinc-500">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    curatorValidation.duneDataAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}></div>
                  <span>{curatorValidation.source}</span>
                  {curatorValidation.highConfidenceCount !== undefined && curatorValidation.highConfidenceCount > 0 && (
                    <span className="text-zinc-600">
                      ({curatorValidation.highConfidenceCount} verified)
                    </span>
                  )}
                </div>
              )}
              {lastUpdated && (
                <span className="text-[12px] text-zinc-600 hidden sm:inline font-mono">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-md hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 -mb-px">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon={<LayoutDashboard className="h-3.5 w-3.5" />}
              label="Overview"
            />
            <TabButton
              active={activeTab === 'curators'}
              onClick={() => setActiveTab('curators')}
              icon={<Users className="h-3.5 w-3.5" />}
              label="Curators"
            />
            <TabButton
              active={activeTab === 'protocols'}
              onClick={() => setActiveTab('protocols')}
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Protocols"
            />
            <TabButton
              active={activeTab === 'vaults'}
              onClick={() => setActiveTab('vaults')}
              icon={<Vault className="h-3.5 w-3.5" />}
              label="Vaults"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/60 rounded-lg overflow-hidden mb-8 border border-zinc-800/60">
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Total Vault TVL"
                  value={overviewData.totalTvl}
                  change={overviewData.totalTvlChange24h}
                  subtitle="24h"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="EVM Chains"
                  value={overviewData.evmTvl}
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Solana"
                  value={overviewData.solanaTvl}
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Active Curators"
                  value={curators.length || overviewData.totalCurators}
                  format="number"
                />
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <TvlByChainChart data={overviewData.tvlByChain} />
              <TvlByProtocolChart data={overviewData.tvlByProtocol} />
            </div>

            {/* Quick Curator Preview */}
            {curators.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[15px] font-semibold text-zinc-100">Top Curators</h2>
                  <button
                    onClick={() => setActiveTab('curators')}
                    className="text-[13px] text-zinc-400 hover:text-white transition-colors"
                  >
                    View all →
                  </button>
                </div>
                <CuratorTvlChart curators={curators} />
              </div>
            )}
          </>
        )}

        {activeTab === 'curators' && (
          <>
            {/* Curator Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/60 rounded-lg overflow-hidden mb-8 border border-zinc-800/60">
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Total Curator TVL"
                  value={curators.reduce((sum, c) => sum + c.totalTvl, 0)}
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Total Curators"
                  value={curators.length}
                  format="number"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Total Vaults"
                  value={curators.reduce((sum, c) => sum + c.vaultCount, 0)}
                  format="number"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Avg APY"
                  value={curators.length > 0
                    ? curators.reduce((sum, c) => sum + c.avgApy, 0) / curators.length
                    : 0}
                  format="percent"
                />
              </div>
            </div>

            {/* Historical TVL Comparison */}
            {historicalData.length > 0 && (
              <div className="mb-8">
                <CuratorComparisonChart
                  curators={historicalData}
                  title="Curator TVL Over Time"
                  height={380}
                />
              </div>
            )}

            {/* Current TVL Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <CuratorTvlChart curators={curators} />
              <div className="space-y-4">
                <h3 className="text-[15px] font-semibold text-zinc-100 px-1">Market Share</h3>
                <div className="space-y-3">
                  {curators.slice(0, 6).map((curator, index) => {
                    const totalTvl = curators.reduce((sum, c) => sum + c.totalTvl, 0);
                    const share = (curator.totalTvl / totalTvl) * 100;
                    return (
                      <div key={curator.slug} className="flex items-center gap-3">
                        <span className="text-[12px] text-zinc-500 w-4">{index + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] text-zinc-300">{curator.name}</span>
                            <span className="text-[13px] font-mono text-zinc-400">{share.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${share}%`,
                                backgroundColor: getCuratorColor(curator.name, index),
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Curator Leaderboard */}
            <CuratorLeaderboard curators={curators} />
          </>
        )}

        {activeTab === 'protocols' && (
          <>
            {/* Protocol Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/60 rounded-lg overflow-hidden mb-8 border border-zinc-800/60">
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Total Protocol TVL"
                  value={overviewData.totalTvl}
                  change={overviewData.totalTvlChange24h}
                  subtitle="24h"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Protocols Tracked"
                  value={overviewData.tvlByProtocol.length}
                  format="number"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Chains Covered"
                  value={overviewData.tvlByChain.length}
                  format="number"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="7d Change"
                  value={overviewData.totalTvlChange7d}
                  format="percent"
                />
              </div>
            </div>

            {/* Protocol Chart */}
            <div className="mb-8">
              <TvlByProtocolChart data={overviewData.tvlByProtocol} />
            </div>

            {/* Protocol Table */}
            <ProtocolTable data={overviewData.tvlByProtocol} />
          </>
        )}

        {activeTab === 'vaults' && (
          <>
            {/* Vault Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/60 rounded-lg overflow-hidden mb-8 border border-zinc-800/60">
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Total Vault TVL"
                  value={topVaults.reduce((sum, v) => sum + v.tvl, 0)}
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Vaults Tracked"
                  value={topVaults.length}
                  format="number"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Avg APY"
                  value={topVaults.length > 0
                    ? topVaults.reduce((sum, v) => sum + v.apy, 0) / topVaults.length
                    : 0}
                  format="percent"
                />
              </div>
              <div className="bg-[#0a0a0a]">
                <StatCard
                  title="Stablecoin Vaults"
                  value={topVaults.filter(v => v.stablecoin).length}
                  format="number"
                />
              </div>
            </div>

            {/* Yield Quality Analysis */}
            {topVaults.length > 0 && (
              <div className="mb-8">
                <YieldQualityChart
                  vaults={topVaults}
                  title="Market Yield Quality"
                />
              </div>
            )}

            {/* Top Vaults by APY */}
            <div className="mb-8">
              <h3 className="text-[15px] font-semibold text-zinc-100 mb-4">Top Vaults by APY</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...topVaults]
                  .sort((a, b) => b.apy - a.apy)
                  .slice(0, 6)
                  .map((vault) => (
                    <div
                      key={vault.id}
                      className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[14px] text-white font-medium">{vault.symbol}</span>
                        <div className="text-right">
                          <span className="text-[13px] text-emerald-400 font-mono">
                            {vault.apy.toFixed(2)}%
                          </span>
                          {vault.apyReward > 0 && (
                            <span className="text-[10px] text-purple-400 ml-1">
                              +{vault.apyReward.toFixed(1)}% rewards
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-zinc-500">{vault.chain}</span>
                        <span className="text-zinc-400 font-mono">{formatTvl(vault.tvl)}</span>
                      </div>
                      {vault.poolMeta && (
                        <p className="text-[11px] text-zinc-600 mt-1">{vault.poolMeta}</p>
                      )}
                      {/* Yield quality indicator */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500"
                            style={{
                              width: `${vault.apy > 0 ? ((vault.apyBase || 0) / vault.apy) * 100 : 0}%`
                            }}
                          />
                          <div
                            className="h-full bg-purple-500"
                            style={{
                              width: `${vault.apy > 0 ? ((vault.apyReward || 0) / vault.apy) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-600">
                          {vault.apy > 0 ? Math.round(((vault.apyBase || 0) / vault.apy) * 100) : 0}% organic
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Full Vault Table */}
            <VaultTable
              vaults={topVaults}
              title="All Curator Vaults"
              showProject={true}
              maxDisplay={25}
            />
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-zinc-800/60">
          <div className="flex items-center justify-between text-[12px] text-zinc-600">
            <div className="flex items-center gap-4">
              <a href="https://defillama.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
                DeFiLlama
              </a>
              <a href="https://dune.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
                Dune
              </a>
            </div>
            <span>Morpho • Euler • Kamino • Yearn</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
        active
          ? 'text-white border-white'
          : 'text-zinc-500 border-transparent hover:text-zinc-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Import from centralized colors
import { getCuratorColor } from '@/lib/colors';
