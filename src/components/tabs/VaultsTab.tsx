'use client';

import { useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { VaultTable } from '@/components/charts/vault-table';
import { YieldQualityChart } from '@/components/charts/yield-quality-chart';
import { formatTvl } from '@/lib/utils';
import type { VaultData } from '@/types';

interface VaultsTabProps {
  vaults: VaultData[];
}

const RATING_COLORS: Record<string, string> = {
  'AAA': 'text-emerald-400 bg-emerald-500/10',
  'AA': 'text-emerald-400 bg-emerald-500/10',
  'A': 'text-green-400 bg-green-500/10',
  'BBB': 'text-yellow-400 bg-yellow-500/10',
  'BB': 'text-amber-400 bg-amber-500/10',
  'NR': 'text-slate-400 bg-slate-800/60',
};

export function VaultsTab({ vaults }: VaultsTabProps) {
  const stats = useMemo(() => {
    const vaultsWithRating = vaults.filter(v => v.creditRating);
    const investmentGrade = vaultsWithRating.filter(v => v.creditRating?.investmentGrade);
    const stablecoinVaults = vaults.filter(v => v.stablecoin);
    const stablecoinTotalTvl = stablecoinVaults.reduce((sum, v) => sum + v.tvl, 0);
    const stablecoinAvgApy = stablecoinTotalTvl > 0
      ? stablecoinVaults.reduce((sum, v) => sum + v.apy * v.tvl, 0) / stablecoinTotalTvl
      : 0;
    const vaultsWithBadDebt = vaults.filter(v => v.hasBadDebt);
    const ratedTvl = vaultsWithRating.reduce((sum, v) => sum + v.tvl, 0);
    const totalTvl = vaults.reduce((sum, v) => sum + v.tvl, 0);
    const ratedPct = totalTvl > 0 ? (ratedTvl / totalTvl) * 100 : 0;

    return {
      totalTvl,
      ratedPct,
      vaultsWithRating,
      investmentGrade,
      stablecoinVaults,
      stablecoinAvgApy,
      vaultsWithBadDebt,
    };
  }, [vaults]);

  const assetClasses = useMemo(() => {
    const stablecoins = vaults.filter(v => v.stablecoin);
    const ethVaults = vaults.filter(v =>
      !v.stablecoin && (
        v.symbol.toUpperCase().includes('ETH') ||
        v.symbol.toUpperCase().includes('STETH') ||
        v.symbol.toUpperCase().includes('WSTETH') ||
        v.symbol.toUpperCase().includes('WEETH') ||
        v.symbol.toUpperCase().includes('CBETH')
      )
    );
    const btcVaults = vaults.filter(v =>
      !v.stablecoin && (
        v.symbol.toUpperCase().includes('BTC') ||
        v.symbol.toUpperCase().includes('WBTC') ||
        v.symbol.toUpperCase().includes('CBBTC') ||
        v.symbol.toUpperCase().includes('LBTC')
      )
    );

    const calcStats = (items: VaultData[]) => {
      if (items.length === 0) return { count: 0, tvl: 0, avgApy: 0, medianApy: 0 };
      const tvl = items.reduce((sum, v) => sum + v.tvl, 0);
      const avgApy = items.reduce((sum, v) => sum + v.apy, 0) / items.length;
      const sortedApys = items.map(v => v.apy).sort((a, b) => a - b);
      const medianApy = sortedApys[Math.floor(sortedApys.length / 2)];
      return { count: items.length, tvl, avgApy, medianApy };
    };

    return [
      { name: 'Stablecoins', icon: '\u{1F4B5}', stats: calcStats(stablecoins) },
      { name: 'ETH & LSTs', icon: '\u27E0', stats: calcStats(ethVaults) },
      { name: 'BTC', icon: '\u20BF', stats: calcStats(btcVaults) },
    ];
  }, [vaults]);

  const featuredVaults = useMemo(() => {
    const largestByTvl = [...vaults].sort((a, b) => b.tvl - a.tvl).slice(0, 2);
    const highestIncentives = [...vaults]
      .filter(v => v.apyReward > 0)
      .sort((a, b) => b.apyReward - a.apyReward)
      .slice(0, 2);
    const highestApy = [...vaults]
      .filter(v => v.apy > 0 && v.tvl > 100000)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 2);

    return { largestByTvl, highestIncentives, highestApy };
  }, [vaults]);

  return (
    <>
      {/* Vault Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700/30 rounded-xl overflow-hidden mb-8 border border-slate-700/35">
        <div className="bg-[#111827]/80 accent-border-blue">
          <StatCard title="Total Vault TVL" value={stats.totalTvl} accent="blue" />
        </div>
        <div className="bg-[#111827]/80 accent-border-amber">
          <StatCard
            title="Rated Coverage"
            value={stats.ratedPct}
            format="percent"
            subtitle={`${stats.vaultsWithRating.length}/${vaults.length} vaults`}
            accent="amber"
          />
        </div>
        <div className="bg-[#111827]/80 accent-border-emerald">
          <StatCard
            title="Stablecoin APY"
            value={stats.stablecoinAvgApy}
            format="percent"
            subtitle={`TVL-weighted \u2022 ${stats.stablecoinVaults.length} vaults`}
            accent="emerald"
          />
        </div>
        <div className="bg-[#111827]/80 accent-border-cyan">
          <StatCard
            title="Investment Grade"
            value={stats.investmentGrade.length}
            format="number"
            subtitle={`BBB+ rated${stats.vaultsWithBadDebt.length > 0 ? ` \u2022 ${stats.vaultsWithBadDebt.length} bad debt` : ''}`}
            accent="cyan"
          />
        </div>
      </div>

      {/* Asset Class Breakdown */}
      {vaults.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-medium mb-4">APY by Asset Class</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assetClasses.map(cat => (
              <div key={cat.name} className="bg-[#111827]/60 border border-slate-700/35 rounded-xl p-4 transition-all hover:bg-[#1e293b]/40 hover:-translate-y-px">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[14px] text-white font-medium">{cat.name}</span>
                  <span className="text-[11px] text-slate-500 ml-auto">{cat.stats.count} vaults</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">TVL</span>
                    <span className="text-white" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{formatTvl(cat.stats.tvl)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Avg APY</span>
                    <span className={cat.stats.avgApy > 3 ? 'text-emerald-400' : 'text-slate-300'} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                      {cat.stats.avgApy.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Median APY</span>
                    <span className="text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{cat.stats.medianApy.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yield Quality Analysis */}
      {vaults.length > 0 && (
        <div className="mb-8">
          <YieldQualityChart vaults={vaults} title="Yield Quality Distribution" />
        </div>
      )}

      {/* Featured Vaults */}
      <div className="mb-8">
        <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-medium mb-4">Featured Vaults</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Largest by TVL */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px]">{'\u{1F3E6}'}</span>
                <CardTitle>Largest by TVL</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                {featuredVaults.largestByTvl.map(vault => (
                  <FeaturedVaultCard key={vault.id} vault={vault} highlightValue={formatTvl(vault.tvl)} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Highest Incentives */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px]">{'\u{1F381}'}</span>
                <CardTitle>Highest Incentives</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                {featuredVaults.highestIncentives.map(vault => (
                  <FeaturedVaultCard
                    key={vault.id}
                    vault={vault}
                    highlightValue={`+${vault.apyReward.toFixed(1)}%`}
                    highlightColor="text-amber-400"
                  />
                ))}
                {featuredVaults.highestIncentives.length === 0 && (
                  <p className="text-[12px] text-slate-500 py-4 text-center">No incentivized vaults</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Highest APY */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px]">{'\u{1F4C8}'}</span>
                <CardTitle>Highest APY</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                {featuredVaults.highestApy.map(vault => (
                  <FeaturedVaultCard
                    key={vault.id}
                    vault={vault}
                    highlightValue={`${vault.apy.toFixed(2)}%`}
                    highlightColor="text-emerald-400"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Vault Table */}
      <VaultTable vaults={vaults} title="All Curator Vaults" showProject={true} maxDisplay={25} />

      {/* Credit Rating Methodology */}
      <div id="methodology" className="mt-12 pt-8 border-t border-slate-700/30">
        <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-medium mb-4">Credit Rating Methodology</h3>
        <div className="bg-[#111827]/50 border border-slate-700/35 rounded-xl p-6">
          <p className="text-[13px] text-slate-400 mb-6">
            Our three-pillar credit rating system assesses vault risk across capital safety, liquidity health,
            and curator quality. Lower scores indicate higher quality.
          </p>

          {/* Rating Scale */}
          <div className="mb-8">
            <h4 className="text-[11px] uppercase tracking-widest text-slate-400 font-medium mb-3">Rating Scale</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {[
                { rating: 'AAA', score: '< 5', label: 'Exceptional', color: 'text-emerald-400 bg-emerald-500/10' },
                { rating: 'AA', score: '< 12', label: 'Excellent', color: 'text-emerald-400 bg-emerald-500/10' },
                { rating: 'A', score: '< 20', label: 'Good', color: 'text-green-400 bg-green-500/10' },
                { rating: 'BBB', score: '< 30', label: 'Adequate', color: 'text-yellow-400 bg-yellow-500/10' },
                { rating: 'BB', score: '< 45', label: 'Speculative', color: 'text-amber-400 bg-amber-500/10' },
              ].map(r => (
                <div key={r.rating} className={`px-3 py-2 rounded-lg ${r.color.split(' ')[1]} border border-slate-700/30`}>
                  <span className={`text-[13px] font-medium ${r.color.split(' ')[0]}`} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{r.rating}</span>
                  <span className="text-[11px] text-slate-500 ml-2">{r.score}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{r.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              Investment Grade: AAA, AA, A, BBB {'\u2022'} Speculative Grade: BB, B, CCC, CC, C
            </p>
          </div>

          {/* Three Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <MethodologyPillar
              icon={'\u{1F6E1}\uFE0F'}
              title="Capital Safety"
              weight="50%"
              question="What's the likelihood of losing my deposit?"
              factors={[
                { name: 'Bad Debt', weight: '35%', desc: 'Historical losses' },
                { name: 'Collateral', weight: '25%', desc: 'Blue-chip vs exotic' },
                { name: 'Oracle', weight: '20%', desc: 'Price feed reliability' },
                { name: 'LLTV', weight: '15%', desc: 'Liquidation buffer' },
                { name: 'Concentration', weight: '5%', desc: 'Diversification' },
              ]}
            />
            <MethodologyPillar
              icon={'\u{1F4A7}'}
              title="Liquidity Health"
              weight="30%"
              question="Can I withdraw when I need to?"
              factors={[
                { name: 'Available', weight: '40%', desc: 'Immediate withdrawability' },
                { name: 'Stress Buffer', weight: '35%', desc: '(1-LLTV) + (1-Utilization)' },
                { name: 'Depth', weight: '25%', desc: 'Underlying market liquidity' },
              ]}
            />
            <MethodologyPillar
              icon={'\u{1F464}'}
              title="Curator Quality"
              weight="20%"
              question="Is this vault well-managed?"
              factors={[
                { name: 'Track Record', weight: '40%', desc: 'History, incidents' },
                { name: 'Risk Mgmt', weight: '30%', desc: 'Asset selection' },
                { name: 'Diversification', weight: '20%', desc: 'Multi-chain, multi-vault' },
                { name: 'Fees', weight: '10%', desc: 'Performance fee levels' },
              ]}
            />
          </div>

          {/* Key Thresholds */}
          <div className="bg-slate-800/20 rounded-lg p-4">
            <h4 className="text-[11px] uppercase tracking-widest text-slate-400 font-medium mb-3">Key LLTV Thresholds</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
              <div><span className="text-emerald-400">{'\u2264'}77%</span><p className="text-slate-500">Strong buffer</p></div>
              <div><span className="text-green-400">{'\u2264'}85%</span><p className="text-slate-500">Adequate</p></div>
              <div><span className="text-yellow-400">{'\u2264'}90%</span><p className="text-slate-500">Elevated risk</p></div>
              <div><span className="text-amber-400">{'\u2264'}94.5%</span><p className="text-slate-500">Narrow margin</p></div>
              <div><span className="text-red-400">&gt;94.5%</span><p className="text-slate-500">Minimal buffer</p></div>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 mt-4">
            Note: Like S&P&apos;s AAA (held by only 2 US companies), our AAA is reserved for exceptional vaults with
            minimal risk. Most well-managed vaults receive A or AA ratings. Data sourced from Morpho Blue on-chain state.
          </p>
        </div>
      </div>
    </>
  );
}

function FeaturedVaultCard({
  vault,
  highlightValue,
  highlightColor = 'text-white',
}: {
  vault: VaultData;
  highlightValue: string;
  highlightColor?: string;
}) {
  const rating = vault.creditRating?.compositeRating || 'NR';
  const ratingColor = RATING_COLORS[rating] || RATING_COLORS['NR'];

  return (
    <div className="bg-[#0f172a]/60 border border-slate-700/30 rounded-lg p-4 transition-all hover:bg-[#1e293b]/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-white font-medium">{vault.symbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${ratingColor}`} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
            {rating}
          </span>
        </div>
        <span className={`text-[14px] ${highlightColor}`} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{highlightValue}</span>
      </div>
      <div className="flex items-center justify-between text-[12px] mb-2">
        <span className="text-slate-500">{vault.chain}</span>
        <span className="text-emerald-400" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{vault.apy.toFixed(2)}% APY</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>Base: <span className="text-emerald-400/80">{(vault.apyBase || vault.apy).toFixed(1)}%</span></span>
        <span>Rewards: <span className="text-amber-400/80">{(vault.apyReward || 0).toFixed(1)}%</span></span>
      </div>
      {vault.maxUtilization !== undefined && (
        <div className="mt-2 pt-2 border-t border-slate-700/30 flex items-center justify-between text-[10px]">
          <span className="text-slate-600">Util: {(vault.maxUtilization * 100).toFixed(0)}%</span>
          <span className="text-slate-600">LLTV: {((vault.avgLltv || 0) * 100).toFixed(0)}%</span>
          {vault.hasBadDebt && <span className="text-red-400">Bad Debt</span>}
        </div>
      )}
    </div>
  );
}

function MethodologyPillar({
  icon,
  title,
  weight,
  question,
  factors,
}: {
  icon: string;
  title: string;
  weight: string;
  question: string;
  factors: { name: string; weight: string; desc: string }[];
}) {
  return (
    <div className="bg-slate-800/25 rounded-xl p-4 border border-slate-700/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px]">{icon}</span>
        <h4 className="text-[13px] font-medium text-slate-200">{title}</h4>
        <span className="text-[10px] text-slate-500 ml-auto">{weight} weight</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">&quot;{question}&quot;</p>
      <ul className="text-[11px] text-slate-400 space-y-1.5">
        {factors.map(f => (
          <li key={f.name} className="flex items-start gap-2">
            <span className="text-slate-600">{'\u2022'}</span>
            <span><strong className="text-slate-300">{f.name}</strong> ({f.weight}): {f.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
