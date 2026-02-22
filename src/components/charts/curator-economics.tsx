'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, cn } from '@/lib/utils';
import { AlertTriangle, Info, DollarSign, Percent, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface VaultFee {
  vaultName: string;
  vaultSymbol: string;
  tvl: number;
  performanceFee: number;
  grossApy: number;
  netApy: number;
  estimatedFeeRevenue: number;
}

interface CuratorFeeData {
  curatorName: string;
  vaultCount: number;
  totalTvl: number;
  avgPerformanceFee: number;
  avgManagementFee: number;
  avgGrossApy: number;
  avgNetApy: number;
  estimatedAnnualFeeRevenue: number;
  vaultFees: VaultFee[];
}

interface CuratorEconomicsProps {
  curatorSlug: string;
  curatorName: string;
  curatorColor?: string;
}

interface KaminoEstimate {
  curatorName: string;
  protocol: string;
  chain: string;
  estimatedPerformanceFee: number;
  estimatedManagementFee: number;
  dataSource: string;
  disclaimer: string;
}

interface KaminoVaultOnChain {
  address: string;
  name: string;
  tokenMint: string;
  performanceFeePct: number;
  managementFeePct: number;
  curator: string | null;
}

interface KaminoOnChainData {
  curatorName: string;
  vaults: KaminoVaultOnChain[];
  avgPerformanceFeePct: number;
  avgManagementFeePct: number;
  vaultCount: number;
}

export function CuratorEconomics({ curatorSlug, curatorName, curatorColor = '#6366F1' }: CuratorEconomicsProps) {
  const [feeData, setFeeData] = useState<CuratorFeeData | null>(null);
  const [kaminoEstimate, setKaminoEstimate] = useState<KaminoEstimate | null>(null);
  const [kaminoOnChain, setKaminoOnChain] = useState<KaminoOnChainData | null>(null);
  const [dataSource, setDataSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVaultDetails, setShowVaultDetails] = useState(false);

  useEffect(() => {
    async function fetchFeeData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/curators/fees?curator=${curatorSlug}`);
        if (!response.ok) {
          throw new Error('Failed to fetch fee data');
        }
        const data = await response.json();
        setFeeData(data.feeData);
        setKaminoEstimate(data.kaminoEstimate || null);
        setKaminoOnChain(data.kaminoOnChain || null);
        setDataSource(data.source || 'Unknown');
      } catch (err) {
        console.error('Error fetching fee data:', err);
        setError('Unable to load fee data');
      } finally {
        setLoading(false);
      }
    }

    if (curatorSlug) {
      fetchFeeData();
    }
  }, [curatorSlug]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curator Economics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500 text-[14px]">Loading fee data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !feeData) {
    // Show Kamino on-chain data if available
    if (kaminoOnChain && kaminoOnChain.vaultCount > 0) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" style={{ color: curatorColor }} />
                Curator Economics
              </CardTitle>
              <span className="text-[11px] text-purple-400 font-mono px-2 py-0.5 bg-purple-500/10 rounded">
                Kamino On-Chain
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-4 w-4 text-slate-500" />
                  <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                    Avg Performance Fee
                  </span>
                </div>
                <p className="text-[24px] font-mono font-semibold text-white">
                  {kaminoOnChain.avgPerformanceFeePct.toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Kamino on Solana
                </p>
              </div>
              <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-4 w-4 text-slate-500" />
                  <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                    Avg Management Fee
                  </span>
                </div>
                <p className="text-[24px] font-mono font-semibold text-white">
                  {kaminoOnChain.avgManagementFeePct.toFixed(2)}%
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  annual
                </p>
              </div>
              <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-slate-500" />
                  <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                    Kamino Vaults
                  </span>
                </div>
                <p className="text-[24px] font-mono font-semibold text-white">
                  {kaminoOnChain.vaultCount}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  on-chain vaults
                </p>
              </div>
            </div>

            {/* Kamino Vault Details */}
            {kaminoOnChain.vaults.length > 0 && (
              <div className="border-t border-slate-700/35 pt-4">
                <button
                  onClick={() => setShowVaultDetails(!showVaultDetails)}
                  className="flex items-center justify-between w-full text-left hover:bg-slate-700/25 rounded-md p-2 -m-2 transition-colors"
                >
                  <span className="text-[13px] text-slate-400">
                    Kamino vault fee breakdown
                  </span>
                  {showVaultDetails ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>

                {showVaultDetails && (
                  <div className="mt-4 space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700/30">
                            <th className="text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                              Vault
                            </th>
                            <th className="text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                              Perf Fee
                            </th>
                            <th className="text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                              Mgmt Fee
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {kaminoOnChain.vaults.slice(0, 10).map((vault, index) => (
                            <tr
                              key={index}
                              className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors"
                            >
                              <td className="py-2">
                                <div>
                                  <p className="text-[13px] text-white">{vault.name}</p>
                                  <p className="text-[11px] text-slate-600 truncate max-w-[200px] font-mono">
                                    {vault.address.slice(0, 8)}...{vault.address.slice(-8)}
                                  </p>
                                </div>
                              </td>
                              <td className="text-right py-2">
                                <span className={cn(
                                  'font-mono text-[13px]',
                                  vault.performanceFeePct > 15 ? 'text-amber-400' :
                                  vault.performanceFeePct > 10 ? 'text-slate-300' : 'text-emerald-400'
                                )}>
                                  {vault.performanceFeePct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-right py-2">
                                <span className="font-mono text-[13px] text-slate-400">
                                  {vault.managementFeePct.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {kaminoOnChain.vaults.length > 10 && (
                      <p className="text-[11px] text-slate-600 text-center pt-2">
                        +{kaminoOnChain.vaults.length - 10} more vaults
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 text-[11px] text-purple-400/80 bg-purple-500/5 rounded-lg p-3 mt-4">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <p>Fee data fetched directly from Solana blockchain via Kamino SDK. This is actual on-chain data.</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Show Kamino estimate if available even when no Morpho/Euler data
    if (kaminoEstimate) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" style={{ color: curatorColor }} />
                Curator Economics
              </CardTitle>
              <span className="text-[11px] text-amber-500 font-mono px-2 py-0.5 bg-amber-500/10 rounded">
                Estimate Only
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-4 w-4 text-slate-500" />
                  <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                    Est. Performance Fee
                  </span>
                </div>
                <p className="text-[24px] font-mono font-semibold text-white">
                  ~{kaminoEstimate.estimatedPerformanceFee}%
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {kaminoEstimate.protocol} on {kaminoEstimate.chain}
                </p>
              </div>
              <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-slate-500" />
                  <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                    Data Source
                  </span>
                </div>
                <p className="text-[14px] text-slate-300 mt-2">
                  {kaminoEstimate.dataSource}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-amber-500/80 bg-amber-500/5 rounded-lg p-3">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <p>{kaminoEstimate.disclaimer}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Curator Economics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-slate-500 text-[14px]">
              {error || 'Fee data not available for this curator'}
            </p>
            <p className="text-slate-600 text-[12px] mt-2">
              On-chain fee data from Morpho, Euler, and Kamino.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const feeImpact = feeData.avgGrossApy > 0
    ? ((feeData.avgGrossApy - feeData.avgNetApy) / feeData.avgGrossApy) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" style={{ color: curatorColor }} />
            Curator Economics
          </CardTitle>
          <span className="text-[11px] text-slate-500 font-mono">
            {feeData.vaultCount} vaults
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-slate-500" />
              <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                Avg Performance Fee
              </span>
            </div>
            <p className="text-[24px] font-mono font-semibold text-white">
              {feeData.avgPerformanceFee.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              of yield earned
            </p>
          </div>

          <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                Gross APY
              </span>
            </div>
            <p className="text-[24px] font-mono font-semibold text-emerald-400">
              {feeData.avgGrossApy.toFixed(2)}%
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              before fees
            </p>
          </div>

          <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                Net APY
              </span>
            </div>
            <p className="text-[24px] font-mono font-semibold text-emerald-500">
              {feeData.avgNetApy.toFixed(2)}%
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              after fees
            </p>
          </div>

          <div className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/35">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-slate-500" />
              <span className="text-[12px] text-slate-500 uppercase tracking-wider">
                Est. Annual Revenue
              </span>
            </div>
            <p className="text-[24px] font-mono font-semibold text-white">
              {formatTvl(feeData.estimatedAnnualFeeRevenue)}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              at current TVL & APY
            </p>
          </div>
        </div>

        {/* Fee Impact Visualization */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-slate-400">Yield Retained by Depositors</span>
            <span className="text-[13px] font-mono text-slate-300">
              {(100 - feeImpact).toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-slate-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${100 - feeImpact}%`,
                backgroundColor: curatorColor,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-slate-600">
              Depositors keep {(100 - feeImpact).toFixed(1)}% of yield
            </span>
            <span className="text-[11px] text-slate-600">
              Curator takes {feeImpact.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Vault Fee Details Toggle */}
        {feeData.vaultFees.length > 0 && (
          <div className="border-t border-slate-700/35 pt-4">
            <button
              onClick={() => setShowVaultDetails(!showVaultDetails)}
              className="flex items-center justify-between w-full text-left hover:bg-slate-700/25 rounded-md p-2 -m-2 transition-colors"
            >
              <span className="text-[13px] text-slate-400">
                Fee breakdown by vault
              </span>
              {showVaultDetails ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {showVaultDetails && (
              <div className="mt-4 space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/30">
                        <th className="text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                          Vault
                        </th>
                        <th className="text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                          TVL
                        </th>
                        <th className="text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                          Perf Fee
                        </th>
                        <th className="text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                          Gross
                        </th>
                        <th className="text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                          Net
                        </th>
                        <th className="text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider py-2">
                          Est. Rev
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeData.vaultFees.slice(0, 10).map((vault, index) => (
                        <tr
                          key={index}
                          className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors"
                        >
                          <td className="py-2">
                            <div>
                              <p className="text-[13px] text-white">{vault.vaultSymbol}</p>
                              <p className="text-[11px] text-slate-600 truncate max-w-[150px]">
                                {vault.vaultName}
                              </p>
                            </div>
                          </td>
                          <td className="text-right py-2">
                            <span className="font-mono text-[13px] text-slate-300">
                              {formatTvl(vault.tvl)}
                            </span>
                          </td>
                          <td className="text-right py-2">
                            <span className={cn(
                              'font-mono text-[13px]',
                              vault.performanceFee > 15 ? 'text-amber-400' :
                              vault.performanceFee > 10 ? 'text-slate-300' : 'text-emerald-400'
                            )}>
                              {vault.performanceFee.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-right py-2">
                            <span className="font-mono text-[13px] text-slate-400">
                              {vault.grossApy.toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right py-2">
                            <span className="font-mono text-[13px] text-emerald-400">
                              {vault.netApy.toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right py-2">
                            <span className="font-mono text-[13px] text-slate-400">
                              {formatTvl(vault.estimatedFeeRevenue)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {feeData.vaultFees.length > 10 && (
                  <p className="text-[11px] text-slate-600 text-center pt-2">
                    +{feeData.vaultFees.length - 10} more vaults
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Kamino On-Chain Section (if available) */}
        {kaminoOnChain && kaminoOnChain.vaultCount > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-700/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] text-purple-400 uppercase tracking-wider">
                Kamino (Solana) On-Chain Data
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {kaminoOnChain.vaultCount} vaults
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-500/5 rounded-lg p-3 border border-purple-500/20">
                <span className="text-[11px] text-slate-500">Avg Performance Fee</span>
                <p className="text-[18px] font-mono font-semibold text-purple-400">
                  {kaminoOnChain.avgPerformanceFeePct.toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-500/5 rounded-lg p-3 border border-purple-500/20">
                <span className="text-[11px] text-slate-500">Avg Management Fee</span>
                <p className="text-[18px] font-mono font-semibold text-purple-400">
                  {kaminoOnChain.avgManagementFeePct.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Source & Disclaimer */}
        <div className="mt-6 pt-4 border-t border-slate-700/30 space-y-3">
          {dataSource && (
            <div className="flex items-center gap-2 text-[11px]">
              <Info className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-500">Data source: <span className="text-slate-400">{dataSource}</span></span>
            </div>
          )}
          <div className="flex items-start gap-2 text-[11px] text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500/70" />
            <p>
              <strong>Disclaimer:</strong> Fee data shown is on-chain from Morpho (V1 + V2), Euler V2, and Kamino (Solana via SDK).
              Curators may have off-chain fee arrangements, revenue sharing agreements, or other
              private deals not reflected here. Estimated revenue assumes current TVL and APY
              remain constant.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Summary component for leaderboard/overview
interface FeesSummaryProps {
  avgPerformanceFee: number;
  estimatedRevenue: number;
}

export function CuratorFeesSummary({ avgPerformanceFee, estimatedRevenue }: FeesSummaryProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-[11px] text-slate-500 uppercase">Perf Fee</p>
        <p className={cn(
          'font-mono text-[13px]',
          avgPerformanceFee > 15 ? 'text-amber-400' :
          avgPerformanceFee > 10 ? 'text-slate-300' : 'text-emerald-400'
        )}>
          {avgPerformanceFee.toFixed(1)}%
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-slate-500 uppercase">Est. Rev/yr</p>
        <p className="font-mono text-[13px] text-slate-300">
          {formatTvl(estimatedRevenue)}
        </p>
      </div>
    </div>
  );
}
