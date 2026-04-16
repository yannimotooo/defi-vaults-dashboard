'use client';

import { lazy, Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { DataFreshnessBadge } from '@/components/ui/data-freshness-badge';
import { LoadingChart } from '@/components/ui/loading-chart';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import {
  GlobalFilterBar,
  useGlobalFilters,
  applyFiltersToCurators,
} from '@/components/ui/global-filter-bar';

const CuratorsTab = lazy(() => import('@/components/tabs/CuratorsTab').then(m => ({ default: m.CuratorsTab })));
const ProtocolsTab = lazy(() => import('@/components/tabs/ProtocolsTab').then(m => ({ default: m.ProtocolsTab })));
const VaultsTab = lazy(() => import('@/components/tabs/VaultsTab').then(m => ({ default: m.VaultsTab })));
const LiquidationsTab = lazy(() => import('@/components/tabs/LiquidationsTab').then(m => ({ default: m.LiquidationsTab })));
const FlowsTab = lazy(() => import('@/components/tabs/FlowsTab').then(m => ({ default: m.FlowsTab })));
import type { MarketOverview, Curator, DataValidation, HistoricalCuratorData, VaultData, LiquidationData, Tab } from '@/types';
import { RefreshCw, LayoutDashboard, Users, Layers, Vault, Zap, TrendingUp } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
});

const VALID_TABS: ReadonlySet<Tab> = new Set<Tab>([
  'overview', 'curators', 'protocols', 'vaults', 'flows', 'liquidations',
]);

/**
 * Public default export — wraps the actual Dashboard component in a Suspense
 * boundary because `useSearchParams()` (used inside Dashboard for the URL-tab
 * sync and global filters) opts the route into client-side bailout, which
 * Next.js requires us to mark explicitly with Suspense.
 *
 * Without this wrapper the production build fails to prerender "/" with:
 *   useSearchParams() should be wrapped in a suspense boundary at page "/"
 *
 * Fallback shows the same LoadingChart as the in-component loading state
 * so users never see an empty flash on initial paint.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingChart progress={5} stage="Loading dashboard..." />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  // Tab state synced to URL ?tab=... so deep links and the back button work.
  // Use router.replace (not push) so tab switches don't pollute history.
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : 'overview';

  const setActiveTab = useCallback((next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [router, searchParams]);

  // WAI-ARIA tablist keyboard navigation: Left/Right cycles through tabs,
  // Home jumps to first, End to last. Activated tab also moves focus.
  // The tab array order MUST match the visual order rendered in the tablist.
  const TAB_ORDER: readonly Tab[] = useMemo(
    () => ['overview', 'curators', 'protocols', 'vaults', 'flows', 'liquidations'] as const,
    [],
  );
  const handleTablistKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIdx = TAB_ORDER.indexOf(activeTab);
      let nextIdx = currentIdx;
      if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % TAB_ORDER.length;
      else if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = TAB_ORDER.length - 1;
      else return; // not a navigation key — let the event bubble
      e.preventDefault();
      const nextTab = TAB_ORDER[nextIdx];
      setActiveTab(nextTab);
      // Move focus to the newly-active tab button so subsequent keys work
      // from there. requestAnimationFrame waits for the re-render.
      requestAnimationFrame(() => {
        document.getElementById(`tab-${nextTab}`)?.focus();
      });
    },
    [TAB_ORDER, activeTab, setActiveTab],
  );

  const swrOpts = { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false };

  // Core data — always fetched
  const { data: overviewData, error: overviewError, isLoading: overviewLoading, mutate: mutateOverview } = useSWR<MarketOverview>('/api/overview', fetcher, swrOpts);
  const { data: curatorResponse, mutate: mutateCurators } = useSWR<{ curators: Curator[]; validation: DataValidation }>('/api/curators', fetcher, swrOpts);

  // Secondary data — fetched lazily based on tab or always (historical needed for overview sparklines)
  const { data: historicalResponse } = useSWR<{ curators: HistoricalCuratorData[] }>('/api/curators/historical', fetcher, swrOpts);
  const { data: vaultsResponse } = useSWR<{ vaults: VaultData[] }>(
    activeTab === 'vaults' || activeTab === 'overview' || activeTab === 'flows' ? '/api/vaults?limit=100' : null,
    fetcher, swrOpts
  );
  const { data: riskResponse } = useSWR<{ multiProtocolLiquidations: LiquidationData }>(
    activeTab === 'liquidations' || activeTab === 'overview' ? '/api/risk' : null,
    fetcher, swrOpts
  );

  const allCurators = curatorResponse?.curators ?? [];
  const curatorValidation = curatorResponse?.validation ?? null;
  const historicalData = historicalResponse?.curators ?? [];
  const topVaults = vaultsResponse?.vaults ?? [];
  const liquidationData = riskResponse?.multiProtocolLiquidations ?? null;

  // Apply global filters (chains/protocols/minTvl from URL params).
  // Filtered set is what flows into the tab components — empty filter set
  // means pass-through, so this is a no-op until the user activates a filter.
  const filters = useGlobalFilters();
  const curators = useMemo(
    () => applyFiltersToCurators(allCurators, filters),
    [allCurators, filters],
  );
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
            <p className="text-red-600 mb-4">{error}</p>
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
    <div className="min-h-screen text-gray-900" style={{ background: 'var(--bg-primary)' }}>
      {/* Header with dotted grid */}
      <header className="border-b border-gray-200 sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
        <div className="dotted-grid">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left: Title + subtitle */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                    <Vault className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <h1 className="text-[15px] sm:text-base font-semibold text-gray-900 leading-tight">
                      DeFi Vault Dashboard
                    </h1>
                    <p className="text-[11px] text-gray-500 hidden sm:block">Cross-chain vault & curator analytics</p>
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
                  <span className="hidden lg:inline text-[10px] text-gray-500 px-2 py-1 bg-gray-100 rounded-md border border-gray-200">
                    {curatorValidation.highConfidenceCount} verified
                  </span>
                )}
                <button
                  onClick={refreshAll}
                  disabled={loading}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  title="Refresh data"
                  aria-label="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Pill Tabs - Desktop. WAI-ARIA tablist with arrow-key navigation. */}
            <div
              role="tablist"
              aria-label="Dashboard sections"
              onKeyDown={handleTablistKeyDown}
              className="hidden sm:flex gap-1 mt-3 -mb-px"
            >
              <TabButton tab="overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Overview" />
              <TabButton tab="curators" active={activeTab === 'curators'} onClick={() => setActiveTab('curators')} icon={<Users className="h-3.5 w-3.5" />} label="Curators" />
              <TabButton tab="protocols" active={activeTab === 'protocols'} onClick={() => setActiveTab('protocols')} icon={<Layers className="h-3.5 w-3.5" />} label="Protocols" />
              <TabButton tab="vaults" active={activeTab === 'vaults'} onClick={() => setActiveTab('vaults')} icon={<Vault className="h-3.5 w-3.5" />} label="Vaults" />
              <TabButton tab="flows" active={activeTab === 'flows'} onClick={() => setActiveTab('flows')} icon={<TrendingUp className="h-3.5 w-3.5" />} label="Flows" />
              <TabButton tab="liquidations" active={activeTab === 'liquidations'} onClick={() => setActiveTab('liquidations')} icon={<Zap className="h-3.5 w-3.5" />} label="Liquidations" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t border-gray-200 safe-area-pb"
        style={{ background: 'rgba(255, 255, 255, 0.96)' }}
        aria-label="Dashboard sections (mobile)"
      >
        <div className="flex justify-around items-center h-14" role="tablist" onKeyDown={handleTablistKeyDown}>
          <MobileTabButton tab="overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard className="h-5 w-5" />} label="Overview" />
          <MobileTabButton tab="curators" active={activeTab === 'curators'} onClick={() => setActiveTab('curators')} icon={<Users className="h-5 w-5" />} label="Curators" />
          <MobileTabButton tab="protocols" active={activeTab === 'protocols'} onClick={() => setActiveTab('protocols')} icon={<Layers className="h-5 w-5" />} label="Protocols" />
          <MobileTabButton tab="vaults" active={activeTab === 'vaults'} onClick={() => setActiveTab('vaults')} icon={<Vault className="h-5 w-5" />} label="Vaults" />
          <MobileTabButton tab="flows" active={activeTab === 'flows'} onClick={() => setActiveTab('flows')} icon={<TrendingUp className="h-5 w-5" />} label="Flows" />
          <MobileTabButton tab="liquidations" active={activeTab === 'liquidations'} onClick={() => setActiveTab('liquidations')} icon={<Zap className="h-5 w-5" />} label="Liquidations" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
        {/* Global filter bar — Phase 4.a. Persists to URL params; flows
            into the curators array via useGlobalFilters above. */}
        <GlobalFilterBar curators={allCurators} />

        <div
          className="tab-content-enter"
          key={activeTab}
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          // Both desktop and mobile tab buttons share the same controls/labelledby
          // ids (the buttons themselves are uniquely id'd as tab-X / mobile-tab-X).
          // Reference whichever is rendered at the current breakpoint.
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'overview' && (
            <OverviewTab overviewData={overviewData} curators={curators} historicalData={historicalData} vaults={topVaults} onNavigate={setActiveTab} />
          )}

          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'curators' && (
              <CuratorsTab curators={curators} historicalData={historicalData} />
            )}

            {activeTab === 'protocols' && (
              <ProtocolsTab overviewData={overviewData} curators={curators} />
            )}

            {activeTab === 'vaults' && (
              <VaultsTab vaults={topVaults} />
            )}

            {activeTab === 'flows' && (
              <FlowsTab curators={curators} vaults={topVaults} overview={overviewData} />
            )}

            {activeTab === 'liquidations' && (
              <LiquidationsTab liquidationData={liquidationData} />
            )}
          </Suspense>
        </div>

        {/* Footer */}
        <footer className="mt-12 sm:mt-16 pt-6 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-[12px] text-gray-400">
            <div className="flex items-center gap-4">
              <a href="https://defillama.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">
                DeFiLlama
              </a>
              <a href="https://dune.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">
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
          <div key={i} className="h-24 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[300px] rounded-xl bg-gray-100" />
        <div className="h-[300px] rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
  icon,
  label,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      id={`tab-${tab}`}
      role="tab"
      aria-selected={active}
      aria-controls={`tabpanel-${tab}`}
      // Roving tabindex pattern: only the active tab is in the focus order.
      // Arrow keys move between tabs; Tab key skips to the panel.
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
        active
          ? 'bg-gray-100 text-gray-900'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileTabButton({
  tab,
  active,
  onClick,
  icon,
  label,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      id={`mobile-tab-${tab}`}
      role="tab"
      aria-selected={active}
      aria-controls={`tabpanel-${tab}`}
      // Use the canonical full label for screen readers; the visible text may
      // be truncated (e.g. "Liquidations" → "Liqs").
      aria-label={label}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors focus:outline-none focus-visible:bg-indigo-50 ${
        active ? 'text-indigo-600' : 'text-gray-400'
      }`}
    >
      {icon}
      {/* Visible text — truncated for layout. aria-label above is authoritative. */}
      <span className="text-[10px] font-medium" aria-hidden="true">
        {label === 'Liquidations' ? 'Liqs' : label}
      </span>
    </button>
  );
}
