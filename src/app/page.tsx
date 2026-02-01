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
import { DataFreshnessBadge } from '@/components/ui/data-freshness-badge';
import { RiskSummaryCard } from '@/components/charts/risk-summary-card';
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
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-white truncate">
                DeFi Vault Dashboard
              </h1>
              <p className="text-[12px] sm:text-[13px] text-zinc-500 hidden sm:block">Cross-chain vault & curator analytics</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 ml-2">
              {curatorValidation?.timestamp && (
                <DataFreshnessBadge
                  timestamp={curatorValidation.timestamp}
                  sources={curatorValidation.source}
                  className="hidden md:flex"
                />
              )}
              {curatorValidation?.highConfidenceCount !== undefined && curatorValidation.highConfidenceCount > 0 && (
                <span className="hidden lg:inline text-[11px] text-zinc-600 px-2 py-1 bg-zinc-800/50 rounded">
                  {curatorValidation.highConfidenceCount} verified
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-md hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs - Desktop */}
          <div className="hidden sm:flex gap-1 mt-4 -mb-px">
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

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-zinc-800/60 safe-area-pb">
        <div className="flex justify-around items-center h-14">
          <MobileTabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Overview"
          />
          <MobileTabButton
            active={activeTab === 'curators'}
            onClick={() => setActiveTab('curators')}
            icon={<Users className="h-5 w-5" />}
            label="Curators"
          />
          <MobileTabButton
            active={activeTab === 'protocols'}
            onClick={() => setActiveTab('protocols')}
            icon={<Layers className="h-5 w-5" />}
            label="Protocols"
          />
          <MobileTabButton
            active={activeTab === 'vaults'}
            onClick={() => setActiveTab('vaults')}
            icon={<Vault className="h-5 w-5" />}
            label="Vaults"
          />
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
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

            {/* Risk Summary */}
            {curators.length > 0 && (
              <div className="mb-8">
                <RiskSummaryCard curators={curators} />
              </div>
            )}

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
                  value={(() => {
                    const totalTvl = curators.reduce((sum, c) => sum + c.totalTvl, 0);
                    return totalTvl > 0
                      ? curators.reduce((sum, c) => sum + c.avgApy * c.totalTvl, 0) / totalTvl
                      : 0;
                  })()}
                  format="percent"
                  subtitle="TVL-weighted"
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
            {/* Vault Stats - Redesigned for fund analysts */}
            {(() => {
              // Calculate meaningful metrics
              const vaultsWithRating = topVaults.filter((v: any) => v.creditRating);
              const investmentGrade = vaultsWithRating.filter((v: any) =>
                v.creditRating?.investmentGrade
              );
              const stablecoinVaults = topVaults.filter(v => v.stablecoin);
              const stablecoinTotalTvl = stablecoinVaults.reduce((sum, v) => sum + v.tvl, 0);
              const stablecoinAvgApy = stablecoinTotalTvl > 0
                ? stablecoinVaults.reduce((sum, v) => sum + v.apy * v.tvl, 0) / stablecoinTotalTvl
                : 0;
              const vaultsWithBadDebt = topVaults.filter((v: any) => v.hasBadDebt);
              const ratedTvl = vaultsWithRating.reduce((sum: number, v: any) => sum + v.tvl, 0);
              const totalTvl = topVaults.reduce((sum, v) => sum + v.tvl, 0);
              const ratedPct = totalTvl > 0 ? (ratedTvl / totalTvl) * 100 : 0;

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/60 rounded-lg overflow-hidden mb-8 border border-zinc-800/60">
                  <div className="bg-[#0a0a0a]">
                    <StatCard
                      title="Total Vault TVL"
                      value={totalTvl}
                    />
                  </div>
                  <div className="bg-[#0a0a0a]">
                    <StatCard
                      title="Rated Coverage"
                      value={ratedPct}
                      format="percent"
                      subtitle={`${vaultsWithRating.length}/${topVaults.length} vaults`}
                    />
                  </div>
                  <div className="bg-[#0a0a0a]">
                    <StatCard
                      title="Stablecoin APY"
                      value={stablecoinAvgApy}
                      format="percent"
                      subtitle={`TVL-weighted • ${stablecoinVaults.length} vaults`}
                    />
                  </div>
                  <div className="bg-[#0a0a0a]">
                    <StatCard
                      title="Investment Grade"
                      value={investmentGrade.length}
                      format="number"
                      subtitle={`BBB+ rated${vaultsWithBadDebt.length > 0 ? ` • ${vaultsWithBadDebt.length} bad debt` : ''}`}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Asset Class Breakdown - Critical for fund analysts */}
            {topVaults.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[15px] font-semibold text-zinc-100 mb-4">APY by Asset Class</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    // Categorize vaults
                    const stablecoins = topVaults.filter(v => v.stablecoin);
                    const ethVaults = topVaults.filter(v =>
                      !v.stablecoin && (
                        v.symbol.toUpperCase().includes('ETH') ||
                        v.symbol.toUpperCase().includes('STETH') ||
                        v.symbol.toUpperCase().includes('WSTETH') ||
                        v.symbol.toUpperCase().includes('WEETH') ||
                        v.symbol.toUpperCase().includes('CBETH')
                      )
                    );
                    const btcVaults = topVaults.filter(v =>
                      !v.stablecoin && (
                        v.symbol.toUpperCase().includes('BTC') ||
                        v.symbol.toUpperCase().includes('WBTC') ||
                        v.symbol.toUpperCase().includes('CBBTC') ||
                        v.symbol.toUpperCase().includes('LBTC')
                      )
                    );

                    const calcStats = (vaults: typeof topVaults) => {
                      if (vaults.length === 0) return { count: 0, tvl: 0, avgApy: 0, medianApy: 0 };
                      const tvl = vaults.reduce((sum, v) => sum + v.tvl, 0);
                      const avgApy = vaults.reduce((sum, v) => sum + v.apy, 0) / vaults.length;
                      const sortedApys = vaults.map(v => v.apy).sort((a, b) => a - b);
                      const medianApy = sortedApys[Math.floor(sortedApys.length / 2)];
                      return { count: vaults.length, tvl, avgApy, medianApy };
                    };

                    const categories = [
                      { name: 'Stablecoins', icon: '💵', color: 'emerald', stats: calcStats(stablecoins) },
                      { name: 'ETH & LSTs', icon: '⟠', color: 'blue', stats: calcStats(ethVaults) },
                      { name: 'BTC', icon: '₿', color: 'amber', stats: calcStats(btcVaults) },
                    ];

                    return categories.map(cat => (
                      <div key={cat.name} className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{cat.icon}</span>
                          <span className="text-[14px] text-white font-medium">{cat.name}</span>
                          <span className="text-[11px] text-zinc-500 ml-auto">{cat.stats.count} vaults</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[12px]">
                            <span className="text-zinc-500">TVL</span>
                            <span className="text-white font-mono">{formatTvl(cat.stats.tvl)}</span>
                          </div>
                          <div className="flex justify-between text-[12px]">
                            <span className="text-zinc-500">Avg APY</span>
                            <span className={`font-mono ${cat.stats.avgApy > 3 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                              {cat.stats.avgApy.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between text-[12px]">
                            <span className="text-zinc-500">Median APY</span>
                            <span className="text-zinc-400 font-mono">{cat.stats.medianApy.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Yield Quality Analysis */}
            {topVaults.length > 0 && (
              <div className="mb-8">
                <YieldQualityChart
                  vaults={topVaults}
                  title="Yield Quality Distribution"
                />
              </div>
            )}

            {/* Top Vaults by Category */}
            <div className="mb-8">
              <h3 className="text-[15px] font-semibold text-zinc-100 mb-4">Featured Vaults</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Largest Vaults */}
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px]">🏦</span>
                    <h4 className="text-[13px] font-medium text-zinc-200">Largest by TVL</h4>
                  </div>
                  <div className="space-y-2">
                    {[...topVaults]
                      .sort((a, b) => b.tvl - a.tvl)
                      .slice(0, 4)
                      .map((vault: any, idx) => (
                        <div key={vault.id} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-zinc-600 w-3">{idx + 1}</span>
                            <span className="text-[12px] text-white truncate">{vault.symbol}</span>
                            {vault.creditRating?.compositeRating && (
                              <span className="text-[9px] text-zinc-500 font-mono">{vault.creditRating.compositeRating}</span>
                            )}
                          </div>
                          <span className="text-[12px] text-zinc-300 font-mono ml-2">{formatTvl(vault.tvl)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Highest Incentives */}
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px]">🎁</span>
                    <h4 className="text-[13px] font-medium text-zinc-200">Highest Incentives</h4>
                  </div>
                  <div className="space-y-2">
                    {[...topVaults]
                      .filter(v => v.apyReward > 0)
                      .sort((a, b) => b.apyReward - a.apyReward)
                      .slice(0, 4)
                      .map((vault: any, idx) => (
                        <div key={vault.id} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-zinc-600 w-3">{idx + 1}</span>
                            <span className="text-[12px] text-white truncate">{vault.symbol}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-[11px] text-zinc-500">{formatTvl(vault.tvl)}</span>
                            <span className="text-[12px] text-amber-400 font-mono">+{vault.apyReward.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    {topVaults.filter(v => v.apyReward > 0).length === 0 && (
                      <p className="text-[11px] text-zinc-500 py-2">No incentivized vaults</p>
                    )}
                  </div>
                </div>

                {/* Highest APY */}
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px]">📈</span>
                    <h4 className="text-[13px] font-medium text-zinc-200">Highest APY</h4>
                  </div>
                  <div className="space-y-2">
                    {[...topVaults]
                      .filter(v => v.apy > 0 && v.tvl > 100000) // Min $100k TVL to filter noise
                      .sort((a, b) => b.apy - a.apy)
                      .slice(0, 4)
                      .map((vault: any, idx) => (
                        <div key={vault.id} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-zinc-600 w-3">{idx + 1}</span>
                            <span className="text-[12px] text-white truncate">{vault.symbol}</span>
                            {vault.creditRating?.compositeRating && (
                              <span className="text-[9px] text-zinc-500 font-mono">{vault.creditRating.compositeRating}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-[11px] text-zinc-500">{formatTvl(vault.tvl)}</span>
                            <span className="text-[12px] text-emerald-400 font-mono">{vault.apy.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Full Vault Table */}
            <VaultTable
              vaults={topVaults}
              title="All Curator Vaults"
              showProject={true}
              maxDisplay={25}
            />

            {/* Credit Rating Methodology Explainer */}
            <div id="methodology" className="mt-12 pt-8 border-t border-zinc-800/60">
              <h3 className="text-[15px] font-semibold text-zinc-100 mb-4">Credit Rating Methodology</h3>
              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-6">
                <p className="text-[13px] text-zinc-400 mb-6">
                  Our three-pillar credit rating system assesses vault risk across capital safety, liquidity health,
                  and curator quality. Lower scores indicate higher quality.
                </p>

                {/* Rating Scale */}
                <div className="mb-8">
                  <h4 className="text-[13px] font-medium text-zinc-300 mb-3">Rating Scale</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {[
                      { rating: 'AAA', score: '< 5', label: 'Exceptional', color: 'text-emerald-400 bg-emerald-500/10' },
                      { rating: 'AA', score: '< 12', label: 'Excellent', color: 'text-emerald-400 bg-emerald-500/10' },
                      { rating: 'A', score: '< 20', label: 'Good', color: 'text-green-400 bg-green-500/10' },
                      { rating: 'BBB', score: '< 30', label: 'Adequate', color: 'text-yellow-400 bg-yellow-500/10' },
                      { rating: 'BB', score: '< 45', label: 'Speculative', color: 'text-amber-400 bg-amber-500/10' },
                    ].map(r => (
                      <div key={r.rating} className={`px-3 py-2 rounded ${r.color.split(' ')[1]} border border-zinc-800/60`}>
                        <span className={`text-[13px] font-mono font-medium ${r.color.split(' ')[0]}`}>{r.rating}</span>
                        <span className="text-[11px] text-zinc-500 ml-2">{r.score}</span>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{r.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-2">
                    Investment Grade: AAA, AA, A, BBB • Speculative Grade: BB, B, CCC, CC, C
                  </p>
                </div>

                {/* Three Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Pillar 1: Capital Safety */}
                  <div className="bg-zinc-800/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[13px]">🛡️</span>
                      <h4 className="text-[13px] font-medium text-zinc-200">Capital Safety</h4>
                      <span className="text-[10px] text-zinc-500 ml-auto">50% weight</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-3">"What's the likelihood of losing my deposit?"</p>
                    <ul className="text-[11px] text-zinc-400 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Bad Debt</strong> (35%): Historical losses</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Collateral</strong> (25%): Blue-chip vs exotic</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Oracle</strong> (20%): Price feed reliability</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">LLTV</strong> (15%): Liquidation buffer</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Concentration</strong> (5%): Diversification</span>
                      </li>
                    </ul>
                  </div>

                  {/* Pillar 2: Liquidity Health */}
                  <div className="bg-zinc-800/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[13px]">💧</span>
                      <h4 className="text-[13px] font-medium text-zinc-200">Liquidity Health</h4>
                      <span className="text-[10px] text-zinc-500 ml-auto">30% weight</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-3">"Can I withdraw when I need to?"</p>
                    <ul className="text-[11px] text-zinc-400 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Available</strong> (40%): Immediate withdrawability</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Stress Buffer</strong> (35%): (1-LLTV) + (1-Utilization)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Depth</strong> (25%): Underlying market liquidity</span>
                      </li>
                    </ul>
                  </div>

                  {/* Pillar 3: Curator Quality */}
                  <div className="bg-zinc-800/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[13px]">👤</span>
                      <h4 className="text-[13px] font-medium text-zinc-200">Curator Quality</h4>
                      <span className="text-[10px] text-zinc-500 ml-auto">20% weight</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-3">"Is this vault well-managed?"</p>
                    <ul className="text-[11px] text-zinc-400 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Track Record</strong> (40%): History, incidents</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Risk Mgmt</strong> (30%): Asset selection</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Diversification</strong> (20%): Multi-chain, multi-vault</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span><strong className="text-zinc-300">Fees</strong> (10%): Performance fee levels</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Key Thresholds */}
                <div className="bg-zinc-800/20 rounded-lg p-4">
                  <h4 className="text-[12px] font-medium text-zinc-300 mb-3">Key LLTV Thresholds</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
                    <div>
                      <span className="text-emerald-400">≤77%</span>
                      <p className="text-zinc-500">Strong buffer</p>
                    </div>
                    <div>
                      <span className="text-green-400">≤85%</span>
                      <p className="text-zinc-500">Adequate</p>
                    </div>
                    <div>
                      <span className="text-yellow-400">≤90%</span>
                      <p className="text-zinc-500">Elevated risk</p>
                    </div>
                    <div>
                      <span className="text-amber-400">≤94.5%</span>
                      <p className="text-zinc-500">Narrow margin</p>
                    </div>
                    <div>
                      <span className="text-red-400">&gt;94.5%</span>
                      <p className="text-zinc-500">Minimal buffer</p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-600 mt-4">
                  Note: Like S&P's AAA (held by only 2 US companies), our AAA is reserved for exceptional vaults with
                  minimal risk. Most well-managed vaults receive A or AA ratings. Data sourced from Morpho Blue on-chain state.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="mt-12 sm:mt-16 pt-6 border-t border-zinc-800/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-[12px] text-zinc-600">
            <div className="flex items-center gap-4">
              <a href="https://defillama.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
                DeFiLlama
              </a>
              <a href="https://dune.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
                Dune
              </a>
            </div>
            <span className="text-center">Morpho • Euler • Kamino • Yearn</span>
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

function MobileTabButton({
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
      className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${
        active
          ? 'text-white'
          : 'text-zinc-500'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// Import from centralized colors
import { getCuratorColor } from '@/lib/colors';
