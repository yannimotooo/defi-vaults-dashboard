'use client';

import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { DataFreshnessBadge } from '@/components/ui/data-freshness-badge';
import { LoadingChart } from '@/components/ui/loading-chart';
import { OverviewTab } from '@/components/tabs/OverviewTab';

const CuratorsTab = lazy(() => import('@/components/tabs/CuratorsTab').then(m => ({ default: m.CuratorsTab })));
const ProtocolsTab = lazy(() => import('@/components/tabs/ProtocolsTab').then(m => ({ default: m.ProtocolsTab })));
const VaultsTab = lazy(() => import('@/components/tabs/VaultsTab').then(m => ({ default: m.VaultsTab })));
const LiquidationsTab = lazy(() => import('@/components/tabs/LiquidationsTab').then(m => ({ default: m.LiquidationsTab })));
import type { MarketOverview, Curator, DataValidation, HistoricalCuratorData, VaultData, LiquidationData, Tab } from '@/types';
import { RefreshCw, LayoutDashboard, Users, Layers, Vault, Zap } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
});

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const swrOpts = { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false };

  // Core data — always fetched
  const { data: overviewData, error: overviewError, isLoading: overviewLoading, mutate: mutateOverview } = useSWR<MarketOverview>('/api/overview', fetcher, swrOpts);
  const { data: curatorResponse, mutate: mutateCurators } = useSWR<{ curators: Curator[]; validation: DataValidation }>('/api/curators', fetcher, swrOpts);

  // Secondary data — fetched lazily based on tab or always (historical needed for overview sparklines)
  const { data: historicalResponse } = useSWR<{ curators: HistoricalCuratorData[] }>('/api/curators/historical', fetcher, swrOpts);
  const { data: vaultsResponse } = useSWR<{ vaults: VaultData[] }>(
    activeTab === 'vaults' || activeTab === 'overview' ? '/api/vaults?limit=100' : null,
    fetcher, swrOpts
  );
  const { data: riskResponse } = useSWR<{ multiProtocolLiquidations: LiquidationData }>(
    activeTab === 'liquidations' || activeTab === 'overview' ? '/api/risk' : null,
    fetcher, swrOpts
  );

  const curators = curatorResponse?.curators ?? [];
  const curatorValidation = curatorResponse?.validation ?? null;
  const historicalData = historicalResponse?.curators ?? [];
  const topVaults = vaultsResponse?.vaults ?? [];
  const liquidationData = riskResponse?.multiProtocolLiquidations ?? null;
  const loading = overviewLoading;
  const error = overviewError?.message ?? null;

  const refreshAll = () => {
    mutateOverview();
    mutateCurators();
  };

  // Animated loading progress
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (overviewData) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 80);
    return () => clearInterval(id);
  }, [overviewData]);

  // Logarithmic fake progress (0→85% over ~10s) + real data checkpoints
  const loadingProgress = useMemo(() => {
    if (overviewData) return 100;
    let base = Math.min(85, 85 * (1 - Math.exp(-elapsed / 4)));
    // Bump when secondary data arrives before overview
    if (curatorResponse) base = Math.max(base, 50);
    if (historicalResponse) base = Math.max(base, 65);
    return base;
  }, [elapsed, overviewData, curatorResponse, historicalResponse]);

  const loadingStage = useMemo(() => {
    if (overviewData) return 'Ready';
    if (error) return 'Retrying...';
    if (loadingProgress > 70) return 'Aggregating curators...';
    if (loadingProgress > 45) return 'Loading vault data...';
    if (loadingProgress > 20) return 'Fetching protocol data...';
    return 'Connecting to data sources...';
  }, [loadingProgress, overviewData, error]);

  if (!overviewData) {
    if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={refreshAll}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return <LoadingChart progress={loadingProgress} stage={loadingStage} />;
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-primary)' }}>
      {/* Header with dotted grid */}
      <header className="border-b border-[#2d3548]/60 sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(13, 17, 23, 0.95)' }}>
        <div className="dotted-grid">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left: Title + subtitle */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <Vault className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-[15px] sm:text-base font-semibold text-white leading-tight">
                      DeFi Vault Dashboard
                    </h1>
                    <p className="text-[11px] text-slate-500 hidden sm:block">Cross-chain vault & curator analytics</p>
                  </div>
                </div>
              </div>

              {/* Right: Metadata + refresh */}
              <div className="flex items-center gap-2 sm:gap-3 ml-2">
                {curatorValidation?.timestamp && (
                  <DataFreshnessBadge
                    timestamp={curatorValidation.timestamp}
                    sources={curatorValidation.source}
                    className="hidden md:flex"
                  />
                )}
                {curatorValidation?.highConfidenceCount !== undefined && curatorValidation.highConfidenceCount > 0 && (
                  <span className="hidden lg:inline text-[10px] text-slate-500 px-2 py-1 bg-slate-800/60 rounded-md border border-slate-700/30">
                    {curatorValidation.highConfidenceCount} verified
                  </span>
                )}
                <button
                  onClick={refreshAll}
                  disabled={loading}
                  className="p-2 rounded-lg hover:bg-slate-800/60 transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Pill Tabs - Desktop */}
            <div className="hidden sm:flex gap-1 mt-3 -mb-px">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Overview" />
              <TabButton active={activeTab === 'curators'} onClick={() => setActiveTab('curators')} icon={<Users className="h-3.5 w-3.5" />} label="Curators" />
              <TabButton active={activeTab === 'protocols'} onClick={() => setActiveTab('protocols')} icon={<Layers className="h-3.5 w-3.5" />} label="Protocols" />
              <TabButton active={activeTab === 'vaults'} onClick={() => setActiveTab('vaults')} icon={<Vault className="h-3.5 w-3.5" />} label="Vaults" />
              <TabButton active={activeTab === 'liquidations'} onClick={() => setActiveTab('liquidations')} icon={<Zap className="h-3.5 w-3.5" />} label="Liquidations" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t border-[#2d3548]/60 safe-area-pb" style={{ background: 'rgba(13, 17, 23, 0.96)' }}>
        <div className="flex justify-around items-center h-14">
          <MobileTabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard className="h-5 w-5" />} label="Overview" />
          <MobileTabButton active={activeTab === 'curators'} onClick={() => setActiveTab('curators')} icon={<Users className="h-5 w-5" />} label="Curators" />
          <MobileTabButton active={activeTab === 'protocols'} onClick={() => setActiveTab('protocols')} icon={<Layers className="h-5 w-5" />} label="Protocols" />
          <MobileTabButton active={activeTab === 'vaults'} onClick={() => setActiveTab('vaults')} icon={<Vault className="h-5 w-5" />} label="Vaults" />
          <MobileTabButton active={activeTab === 'liquidations'} onClick={() => setActiveTab('liquidations')} icon={<Zap className="h-5 w-5" />} label="Liqs" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
        <div className="tab-content-enter" key={activeTab}>
          {activeTab === 'overview' && (
            <OverviewTab overviewData={overviewData} curators={curators} historicalData={historicalData} vaults={topVaults} onNavigate={setActiveTab} />
          )}

          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'curators' && (
              <CuratorsTab curators={curators} historicalData={historicalData} />
            )}

            {activeTab === 'protocols' && (
              <ProtocolsTab overviewData={overviewData} />
            )}

            {activeTab === 'vaults' && (
              <VaultsTab vaults={topVaults} />
            )}

            {activeTab === 'liquidations' && (
              <LiquidationsTab liquidationData={liquidationData} />
            )}
          </Suspense>
        </div>

        {/* Footer */}
        <footer className="mt-12 sm:mt-16 pt-6 border-t border-[#2d3548]/40">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-[12px] text-slate-600">
            <div className="flex items-center gap-4">
              <a href="https://defillama.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                DeFiLlama
              </a>
              <a href="https://dune.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                Dune
              </a>
            </div>
            <span className="text-center">Morpho &bull; Euler &bull; Kamino &bull; Yearn</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-[14px] bg-[#1a1f2e]" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[300px] rounded-[14px] bg-[#1a1f2e]" />
        <div className="h-[300px] rounded-[14px] bg-[#1a1f2e]" />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-150 ${
        active
          ? 'bg-[#2d3548]/60 text-white'
          : 'text-slate-500 hover:text-white hover:bg-[#2d3548]/30'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileTabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${
        active ? 'text-indigo-400' : 'text-slate-500'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
