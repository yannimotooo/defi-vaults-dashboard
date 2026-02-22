'use client';

import { useEffect, useRef, useState } from 'react';
import { DataFreshnessBadge } from '@/components/ui/data-freshness-badge';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { CuratorsTab } from '@/components/tabs/CuratorsTab';
import { ProtocolsTab } from '@/components/tabs/ProtocolsTab';
import { VaultsTab } from '@/components/tabs/VaultsTab';
import { LiquidationsTab } from '@/components/tabs/LiquidationsTab';
import type { MarketOverview, Curator, DataValidation, HistoricalCuratorData, VaultData, LiquidationData, Tab } from '@/types';
import { RefreshCw, LayoutDashboard, Users, Layers, Vault, Zap } from 'lucide-react';

export default function Dashboard() {
  const [overviewData, setOverviewData] = useState<MarketOverview | null>(null);
  const [curators, setCurators] = useState<Curator[]>([]);
  const [curatorValidation, setCuratorValidation] = useState<DataValidation | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalCuratorData[]>([]);
  const [topVaults, setTopVaults] = useState<VaultData[]>([]);
  const [liquidationData, setLiquidationData] = useState<LiquidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const abortControllersRef = useRef<AbortController[]>([]);

  const fetchData = async () => {
    // Abort any in-flight secondary requests from previous fetch
    abortControllersRef.current.forEach(c => c.abort());
    abortControllersRef.current = [];

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

      // Non-blocking secondary fetches with tracked abort controllers
      const historicalController = new AbortController();
      const vaultsController = new AbortController();
      const riskController = new AbortController();
      abortControllersRef.current = [historicalController, vaultsController, riskController];

      fetch('/api/curators/historical', { signal: historicalController.signal })
        .then(res => res.json())
        .then(data => {
          if (data.curators) setHistoricalData(data.curators);
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error('[Historical]', err);
        });

      fetch('/api/vaults?limit=100', { signal: vaultsController.signal })
        .then(res => res.json())
        .then(data => {
          if (data.vaults) setTopVaults(data.vaults);
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error('[Vaults]', err);
        });

      fetch('/api/risk', { signal: riskController.signal })
        .then(res => res.json())
        .then(data => {
          if (data.multiProtocolLiquidations) setLiquidationData(data.multiProtocolLiquidations);
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error('[Risk]', err);
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
    return () => {
      clearInterval(interval);
      abortControllersRef.current.forEach(c => c.abort());
    };
  }, []);

  if (loading && !overviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading DeFi Vault data...</p>
        </div>
      </div>
    );
  }

  if (error && !overviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!overviewData) return null;

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-primary)' }}>
      {/* Header with dotted grid */}
      <header className="border-b border-slate-700/40 sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(11, 15, 25, 0.92)' }}>
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
                  onClick={fetchData}
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t border-slate-700/40 safe-area-pb" style={{ background: 'rgba(11, 15, 25, 0.95)' }}>
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
            <OverviewTab overviewData={overviewData} curators={curators} onNavigate={setActiveTab} />
          )}

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
        </div>

        {/* Footer */}
        <footer className="mt-12 sm:mt-16 pt-6 border-t border-slate-700/30">
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

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-150 ${
        active
          ? 'bg-slate-700/60 text-white shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
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
