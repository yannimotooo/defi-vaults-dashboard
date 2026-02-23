import { NextResponse } from 'next/server';
import { getAllProtocols, filterRiskCurators, extractChains, getYieldPools, filterCuratorVaultsFromPools, getProtocol30dChange, type VaultPool } from '@/lib/defillama';
import { getMorphoCuratorData, crossReferenceCuratorData } from '@/lib/dune';
import { getAllCuratorsFeeData, getMorphoCuratorsTvl } from '@/lib/morpho';
import { getEulerCuratorFeeData, getEulerCuratorsTvl } from '@/lib/euler';
import { getRiskMetrics } from '@/lib/risk';
import { getKaminoCuratorsTvl, type KaminoCuratorTvlData } from '@/lib/kamino-onchain';
import { DataSourceTracker } from '@/lib/data-source-tracker';
import type { Curator } from '@/types';

// Simple in-memory cache for Kamino data (expensive Solana RPC call)
let kaminoCache: { data: KaminoCuratorTvlData[]; timestamp: number } | null = null;
let kaminoPendingRequest: Promise<KaminoCuratorTvlData[]> | null = null;
const KAMINO_CACHE_TTL = 20 * 60 * 1000; // 20 minutes (Solana RPC is expensive)

// Fetch Kamino curator data with actual on-chain TVL (cached + deduped)
async function getKaminoCuratorData(): Promise<KaminoCuratorTvlData[]> {
  // Return cached data if valid
  if (kaminoCache && Date.now() - kaminoCache.timestamp < KAMINO_CACHE_TTL) {
    console.log('[Kamino] Using cached data');
    return kaminoCache.data;
  }

  // Deduplicate concurrent requests — return existing in-flight promise
  if (kaminoPendingRequest) {
    console.log('[Kamino] Deduplicating concurrent request');
    return kaminoPendingRequest;
  }

  kaminoPendingRequest = (async () => {
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const curators = await getKaminoCuratorsTvl(rpcUrl);
      console.log(`[Kamino] Fetched ${curators.length} curators with on-chain TVL`);
      kaminoCache = { data: curators, timestamp: Date.now() };
      return curators;
    } finally {
      kaminoPendingRequest = null;
    }
  })();

  try {
    return await kaminoPendingRequest;
  } catch (error) {
    console.error('[Kamino] Error fetching curator data:', error);
    // Return stale cache if available
    if (kaminoCache) {
      console.log('[Kamino] Returning stale cache due to error');
      return kaminoCache.data;
    }
    return [];
  }
}

export const revalidate = 300; // 5 minutes

// Fallback curator metadata - only used when vault data is unavailable
const CURATOR_METADATA: Record<string, { protocols: string[] }> = {
  'steakhouse-financial': { protocols: ['Morpho', 'Kamino', 'Spark'] },
  'gauntlet': { protocols: ['Morpho', 'Kamino', 'Symbiotic', 'Drift'] },
  'sentora': { protocols: ['EtherFi', 'Morpho', 'Aave'] },
  'mev-capital': { protocols: ['Morpho', 'Euler'] },
  'k3-capital': { protocols: ['Morpho'] },
  're7-labs': { protocols: ['Morpho', 'Euler'] },
  'block-analitica': { protocols: ['Morpho', 'Spark'] },
  'euler-dao': { protocols: ['Euler'] },
  'yearn-curating': { protocols: ['Yearn'] },
  'vault-bridge': { protocols: ['Morpho'] },
  'ultrayield-by-edge': { protocols: ['Morpho'] },
  'hyperithm': { protocols: ['Morpho'] },
  'b-protocol': { protocols: ['Morpho'] },
  'summer-fi': { protocols: ['Morpho', 'Ajna'] },
  'clearstar': { protocols: ['Morpho'] },
  'telos-consilium': { protocols: ['Morpho'] },
  'tulipa-capital': { protocols: ['Morpho'] },
  'kpk': { protocols: ['Morpho'] },
  'alphaping': { protocols: ['Morpho'] },
  '9summits': { protocols: ['Morpho'] },
};

// Calculate real metrics from vault data (using pre-fetched pools to avoid N+1 queries)
function getCuratorRealMetrics(slug: string, allPools: VaultPool[]): {
  vaultCount: number;
  avgApy: number;
  protocols: string[];
  chains: string[];
  vaultTvl: number;
} | null {
  try {
    const vaults = filterCuratorVaultsFromPools(slug, allPools);
    if (vaults.length === 0) return null;

    const totalTvl = vaults.reduce((sum, v) => sum + v.tvlUsd, 0);

    // Calculate TVL-weighted average APY
    let weightedApy = 0;
    vaults.forEach(v => {
      const weight = totalTvl > 0 ? v.tvlUsd / totalTvl : 0;
      weightedApy += (v.apy || 0) * weight;
    });

    // Extract unique protocols and chains
    const protocols = [...new Set(vaults.map(v => formatProtocolName(v.project)))];
    const chains = [...new Set(vaults.map(v => v.chain))];

    return {
      vaultCount: vaults.length,
      avgApy: weightedApy,
      protocols,
      chains,
      vaultTvl: totalTvl,
    };
  } catch {
    return null;
  }
}

function formatProtocolName(project: string): string {
  const nameMap: Record<string, string> = {
    'morpho': 'Morpho',
    'morpho-blue': 'Morpho',
    'morpho-steakhouse': 'Morpho',
    'morpho-gauntlet': 'Morpho',
    'morpho-mev-capital': 'Morpho',
    'morpho-re7': 'Morpho',
    'morpho-k3': 'Morpho',
    'morpho-block-analitica': 'Morpho',
    'morpho-sentora': 'Morpho',
    'euler': 'Euler',
    'euler-v2': 'Euler',
    'kamino': 'Kamino',
    'kamino-lend': 'Kamino',
    'yearn-finance': 'Yearn',
    'aave-v3': 'Aave',
    'spark': 'Spark',
    'compound-v3': 'Compound',
    'gearbox': 'Gearbox',
    'sommelier': 'Sommelier',
    'mellow-protocol': 'Mellow',
    'symbiotic': 'Symbiotic',
    'drift-protocol': 'Drift',
    'meteora': 'Meteora',
  };

  const lower = project.toLowerCase();
  return nameMap[lower] || project.charAt(0).toUpperCase() + project.slice(1);
}

import { CURATOR_NAME_VARIANTS, formatCuratorName } from '@/lib/curator-names';

// Look up fee data using multiple name matching strategies
function lookupFeeData(
  protocolName: string,
  protocolSlug: string,
  feeDataMap: Map<string, { avgPerformanceFee: number; avgManagementFee: number; estimatedAnnualFeeRevenue: number; avgGrossApy: number; avgNetApy: number }>
) {
  // Normalize function for consistent key generation
  const normalize = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '');

  // Strategy 1: Try slug directly
  let feeData = feeDataMap.get(normalize(protocolSlug));
  if (feeData) return feeData;

  // Strategy 2: Try formatted protocol name
  feeData = feeDataMap.get(normalize(formatCuratorName(protocolName)));
  if (feeData) return feeData;

  // Strategy 3: Try protocol name as-is
  feeData = feeDataMap.get(normalize(protocolName));
  if (feeData) return feeData;

  // Strategy 4: Try known name variants for this slug
  const variants = CURATOR_NAME_VARIANTS[protocolSlug];
  if (variants) {
    for (const variant of variants) {
      feeData = feeDataMap.get(normalize(variant));
      if (feeData) return feeData;
    }
  }

  return undefined;
}

export async function GET() {
  try {
    // Fetch data from all sources in parallel (tracked for visibility)
    const tracker = new DataSourceTracker();
    const [
      allProtocols,
      duneCuratorData,
      morphoFeeData,
      eulerFeeData,
      allYieldPools,
      morphoCuratorTvl,  // On-chain TVL (primary source for Morpho)
      eulerCuratorTvl,   // On-chain TVL (primary source for Euler)
      riskData,          // Risk metrics
      kaminoCuratorData, // Kamino Solana data with on-chain TVL
    ] = await Promise.all([
      tracker.track('DeFiLlama Protocols', getAllProtocols(), []),
      tracker.track('Dune Curator Data', getMorphoCuratorData(), []),
      tracker.track('Morpho Fees', getAllCuratorsFeeData(), []),
      tracker.track('Euler Fees', getEulerCuratorFeeData(), []),
      tracker.track('DeFiLlama Yield Pools', getYieldPools(), []),
      tracker.track('Morpho On-Chain TVL', getMorphoCuratorsTvl(), []),
      tracker.track('Euler On-Chain TVL', getEulerCuratorsTvl(), []),
      tracker.track('Risk Metrics', getRiskMetrics(), null),
      tracker.track('Kamino On-Chain TVL', getKaminoCuratorData(), []),
    ]);

    // Create Morpho TVL lookup map (normalized curator name -> data)
    const normalizeName = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '');
    const morphoTvlMap = new Map(
      morphoCuratorTvl.map(c => [normalizeName(c.curatorName), c])
    );

    // Create Euler TVL lookup map (authoritative for Euler curators)
    const eulerTvlMap = new Map(
      eulerCuratorTvl.map(c => [normalizeName(c.curatorName), c])
    );
    console.log(`[Curators] Euler TVL data available for ${eulerCuratorTvl.length} curators`);

    // Create risk data lookup map
    const riskMap = new Map(
      riskData?.curators.map(c => [normalizeName(c.curatorName), c]) || []
    );

    // Create Kamino data lookup map (for Solana TVL - now with ACTUAL on-chain TVL)
    const kaminoMap = new Map(
      kaminoCuratorData.map(c => [normalizeName(c.curatorName), c])
    );
    console.log(`[Curators] Kamino data available for ${kaminoCuratorData.length} curators (on-chain TVL)`);

    // Create a map of fee data by curator name (normalized)
    // Combine Morpho and Euler data
    const feeDataMap = new Map<string, {
      avgPerformanceFee: number;
      avgManagementFee: number;
      estimatedAnnualFeeRevenue: number;
      avgGrossApy: number;
      avgNetApy: number;
    }>();

    // Consistent normalization for fee data keys
    const normalizeFeeKey = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '');

    // Add Morpho fee data
    for (const fd of morphoFeeData) {
      const key = normalizeFeeKey(fd.curatorName);
      feeDataMap.set(key, {
        avgPerformanceFee: fd.avgPerformanceFee,
        avgManagementFee: fd.avgManagementFee,
        estimatedAnnualFeeRevenue: fd.estimatedAnnualFeeRevenue,
        avgGrossApy: fd.avgGrossApy,
        avgNetApy: fd.avgNetApy,
      });
    }

    // Merge/add Euler fee data (preserve both Morpho and Euler contributions)
    for (const ed of eulerFeeData) {
      const key = normalizeFeeKey(ed.curatorName);
      const existing = feeDataMap.get(key);

      if (existing) {
        // Merge: take the higher performance fee (curators typically set same fee across protocols)
        // and sum fee revenue from both protocols
        feeDataMap.set(key, {
          avgPerformanceFee: Math.max(existing.avgPerformanceFee, ed.avgPerformanceFee),
          avgManagementFee: existing.avgManagementFee, // Euler doesn't have management fees
          estimatedAnnualFeeRevenue: existing.estimatedAnnualFeeRevenue, // Morpho revenue is more reliable
          avgGrossApy: existing.avgGrossApy || 0,
          avgNetApy: existing.avgNetApy || 0,
        });
      } else {
        feeDataMap.set(key, {
          avgPerformanceFee: ed.avgPerformanceFee,
          avgManagementFee: 0,
          estimatedAnnualFeeRevenue: 0,
          avgGrossApy: 0,
          avgNetApy: 0,
        });
      }
    }

    // Filter for risk curators from DeFiLlama
    const curatorProtocols = filterRiskCurators(allProtocols);

    // Prepare DeFiLlama data for cross-referencing
    const defillamaData = curatorProtocols
      .filter(p => p.tvl > 0)
      .map(p => ({ name: p.name, slug: p.slug, tvl: p.tvl }));

    // Cross-reference with Dune data
    const crossReferenced = crossReferenceCuratorData(defillamaData, duneCuratorData);

    // Create a map of cross-referenced data for lookup
    const crossRefMap = new Map(crossReferenced.map(c => [c.slug, c]));

    // Calculate real vault metrics for each curator (using pre-fetched pools - no more N+1 queries)
    const curatorSlugs = curatorProtocols.filter(p => p.tvl > 0).map(p => p.slug);
    const realMetricsMap = new Map(
      curatorSlugs.map(slug => [slug, getCuratorRealMetrics(slug, allYieldPools)])
    );

    // Fetch real 30d changes from historical TVL data
    // (change_1m is often missing from DeFiLlama's /protocols list endpoint)
    const change30dResults = await Promise.all(
      curatorSlugs.map(async (slug) => {
        try {
          const change = await getProtocol30dChange(slug);
          return { slug, change30d: change };
        } catch {
          return { slug, change30d: undefined };
        }
      })
    );
    const change30dMap = new Map(change30dResults.map(r => [r.slug, r.change30d]));

    // Transform to our Curator type with real metrics when available
    const curators: Curator[] = curatorProtocols
      .filter(p => p.tvl > 0)
      .map(p => {
        const metadata = CURATOR_METADATA[p.slug] || { protocols: ['Morpho'] };
        const defillamaChains = extractChains(p);
        const crossRef = crossRefMap.get(p.slug);
        const realMetrics = realMetricsMap.get(p.slug);

        // Look up fee data using multiple strategies (name matching is tricky)
        const feeData = lookupFeeData(p.name, p.slug, feeDataMap);

        // Look up Morpho on-chain TVL (try multiple name formats)
        const morphoData = morphoTvlMap.get(normalizeName(p.name))
          || morphoTvlMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => morphoTvlMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // Look up risk data (try multiple name formats)
        const risk = riskMap.get(normalizeName(p.name))
          || riskMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => riskMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // Look up Kamino data (Solana vaults - NOW with actual on-chain TVL)
        const kaminoData = kaminoMap.get(normalizeName(p.name))
          || kaminoMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => kaminoMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // Look up Euler data (for Euler curators)
        const eulerData = eulerTvlMap.get(normalizeName(p.name))
          || eulerTvlMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => eulerTvlMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // TVL Source Hierarchy (use authoritative on-chain data when available):
        // 1. Morpho API TVL (authoritative for Morpho vaults)
        // 2. Kamino on-chain TVL (authoritative for Solana/Kamino vaults)
        // 3. Euler subgraph TVL (authoritative for Euler vaults)
        // 4. DeFiLlama (fallback aggregator)
        const defillamaTvl = p.tvl;
        const morphoTvl = morphoData?.totalTvl || 0;
        const kaminoTvl = kaminoData?.totalTvlUsd || 0;  // Now using actual on-chain TVL!
        const eulerTvl = eulerData?.totalTvlUsd || 0;

        // Determine TVL source and value based on hierarchy
        let totalTvl = defillamaTvl;
        let tvlSource: 'morpho' | 'kamino' | 'euler' | 'defillama' = 'defillama';

        // Priority 1: Morpho on-chain TVL (if significant)
        if (morphoTvl > 10000) {
          // Use Morpho TVL if it's the primary source (within 50% of DeFiLlama)
          const morphoIsPrimary = defillamaTvl > 0 && morphoTvl / defillamaTvl > 0.5;
          if (morphoIsPrimary) {
            totalTvl = morphoTvl;
            tvlSource = 'morpho';
          }
        }

        // Priority 2: Kamino on-chain TVL (for Solana curators)
        if (kaminoTvl > 10000 && tvlSource === 'defillama') {
          // Kamino TVL is authoritative for Solana vaults
          // Add to total if significant and not already counted
          if (kaminoTvl > defillamaTvl * 0.1) { // Kamino is >10% of total
            totalTvl = Math.max(defillamaTvl, kaminoTvl);
            tvlSource = 'kamino';
          }
        }

        // Priority 3: Euler subgraph TVL (for Euler curators)
        if (eulerTvl > 10000 && tvlSource === 'defillama') {
          const eulerIsPrimary = defillamaTvl > 0 && eulerTvl / defillamaTvl > 0.5;
          if (eulerIsPrimary) {
            totalTvl = eulerTvl;
            tvlSource = 'euler';
          }
        }

        // If we have multiple authoritative sources, combine them
        // This handles curators who operate across multiple protocols
        const authoritativeTvl = morphoTvl + kaminoTvl + eulerTvl;
        if (authoritativeTvl > totalTvl * 1.1) {
          // Authoritative sources sum to more than current total - use the higher value
          totalTvl = Math.max(totalTvl, authoritativeTvl);
        }

        // Use real vault data when available, fallback to estimates
        // Include Kamino and Euler vault counts if available
        const morphoVaultCount = morphoData?.vaultCount || 0;
        const kaminoVaultCount = kaminoData?.vaultCount || 0;
        const eulerVaultCount = eulerData?.vaultCount || 0;
        const hasRealVaultCount = (morphoVaultCount + kaminoVaultCount + eulerVaultCount) > 0 || (realMetrics?.vaultCount ?? 0) > 0;
        const vaultCount = (morphoVaultCount + kaminoVaultCount + eulerVaultCount) || realMetrics?.vaultCount || estimateVaultCount(totalTvl);
        const vaultCountEstimated = !hasRealVaultCount;

        // APY Priority: 1) Fee data grossApy (from Morpho), 2) Morpho on-chain, 3) DefiLlama, 4) 0
        const avgApy = feeData?.avgGrossApy || feeData?.avgNetApy || morphoData?.avgApy || realMetrics?.avgApy || 0;

        // Build protocols list - include Kamino/Euler if curator has those vaults
        let protocols = realMetrics?.protocols?.length
          ? [...realMetrics.protocols]
          : [...metadata.protocols];
        if (kaminoData && !protocols.includes('Kamino')) {
          protocols.push('Kamino');
        }
        if (eulerData && !protocols.includes('Euler')) {
          protocols.push('Euler');
        }

        // Build chains list - include Solana if curator has Kamino vaults, add Euler chains
        let chains = realMetrics?.chains?.length
          ? [...realMetrics.chains]
          : (defillamaChains.length > 0 ? [...defillamaChains] : ['Ethereum']);
        if (kaminoData && !chains.includes('Solana')) {
          chains.push('Solana');
        }
        if (eulerData?.chains) {
          for (const chain of eulerData.chains) {
            if (!chains.includes(chain)) {
              chains.push(chain);
            }
          }
        }

        // Data confidence based on data completeness:
        // - High: Has on-chain data (Morpho, Kamino, or Euler) AND has APY data
        // - Medium: Has some data but incomplete
        // - Low: Missing critical data
        const hasOnChainData = morphoTvl > 0 || kaminoTvl > 0 || eulerTvl > 0;
        const hasApyData = avgApy > 0;
        const hasFeeData = feeData !== undefined;

        let dataConfidence: 'high' | 'medium' | 'low';
        if (hasOnChainData && hasApyData) {
          dataConfidence = 'high';
        } else if (hasOnChainData || hasApyData || hasFeeData) {
          dataConfidence = 'medium';
        } else {
          dataConfidence = 'low';
        }

        return {
          name: formatCuratorName(p.name),
          slug: p.slug,
          totalTvl,
          vaultCount,
          vaultCountEstimated,
          chains,
          protocols,
          avgApy,
          // Calculate net flow from change percentages
          netFlow7d: p.change_7d ? (totalTvl * p.change_7d) / 100 : 0,
          // Use DeFiLlama change_1m if available, otherwise fall back to computed 30d change from historical TVL
          netFlow30d: p.change_1m
            ? (totalTvl * p.change_1m) / 100
            : change30dMap.get(p.slug) != null
              ? (totalTvl * change30dMap.get(p.slug)!) / 100
              : 0,
          // TVL source tracking (use authoritative sources when available)
          tvlSource,
          morphoTvl: morphoTvl > 0 ? morphoTvl : undefined,
          defillamaTvl,
          // Kamino (Solana) data - now with actual on-chain TVL
          kaminoTvl: kaminoTvl > 0 ? kaminoTvl : undefined,
          kaminoVaultCount: kaminoVaultCount > 0 ? kaminoVaultCount : undefined,
          // Euler data
          eulerTvl: eulerTvl > 0 ? eulerTvl : undefined,
          eulerVaultCount: eulerVaultCount > 0 ? eulerVaultCount : undefined,
          // Data confidence
          dataConfidence,
          duneTvl: crossRef?.duneTvl,
          // Fee economics from Morpho + Euler
          avgPerformanceFee: feeData?.avgPerformanceFee,
          avgManagementFee: feeData?.avgManagementFee,
          estimatedAnnualRevenue: feeData?.estimatedAnnualFeeRevenue,
          grossApy: feeData?.avgGrossApy,
          netApy: feeData?.avgNetApy,
          // Risk metrics
          riskScore: risk?.riskScore,
          riskLevel: risk?.riskLevel,
          liquidationVolume24h: risk?.totalLiquidationVolume24h,
          liquidationVolume7d: risk?.totalLiquidationVolume7d,
          hasBadDebt: risk?.hasBadDebt,
          redWarningCount: risk?.redWarningCount,
          yellowWarningCount: risk?.yellowWarningCount,
          criticalWarnings: risk?.criticalWarnings,
          avgUtilization: risk?.avgUtilization,
        };
      })
      .sort((a, b) => b.totalTvl - a.totalTvl);

    // Add comprehensive validation info
    const sources = [];
    const morphoTvlCount = curators.filter(c => c.tvlSource === 'morpho').length;
    const kaminoTvlCount = curators.filter(c => c.tvlSource === 'kamino').length;
    const eulerTvlCount = curators.filter(c => c.tvlSource === 'euler').length;
    const kaminoCuratorCount = curators.filter(c => c.kaminoTvl).length;
    const eulerCuratorCount = curators.filter(c => c.eulerTvl).length;

    if (morphoTvlCount > 0) sources.push(`Morpho On-chain (${morphoTvlCount})`);
    if (kaminoTvlCount > 0) sources.push(`Kamino On-chain (${kaminoTvlCount})`);
    if (eulerTvlCount > 0) sources.push(`Euler On-chain (${eulerTvlCount})`);
    sources.push('DeFiLlama');
    if (duneCuratorData.length > 0) sources.push('Dune');
    if (morphoFeeData.length > 0) sources.push('Morpho Fees');
    if (eulerFeeData.length > 0) sources.push('Euler V2');
    if (riskData) sources.push('Risk API');

    const validation = {
      source: sources.join(' + '),
      timestamp: new Date().toISOString(),
      curatorCount: curators.length,
      totalTvl: curators.reduce((sum, c) => sum + c.totalTvl, 0),
      // TVL source breakdown (authoritative sources)
      morphoTvlCount,
      kaminoTvlCount,
      eulerTvlCount,
      defillamaTvlCount: curators.filter(c => c.tvlSource === 'defillama').length,
      // Data availability
      duneDataAvailable: duneCuratorData.length > 0,
      morphoFeeDataAvailable: morphoFeeData.length > 0,
      eulerFeeDataAvailable: eulerFeeData.length > 0,
      kaminoDataAvailable: kaminoCuratorData.length > 0,
      eulerTvlDataAvailable: eulerCuratorTvl.length > 0,
      riskDataAvailable: riskData !== null,
      // Quality metrics
      crossReferencedCount: crossReferenced.filter(c => c.dataSource === 'both').length,
      highConfidenceCount: curators.filter(c => c.dataConfidence === 'high').length,
      curatorsWithFeeData: curators.filter(c => c.avgPerformanceFee !== undefined).length,
      curatorsWithRiskData: curators.filter(c => c.riskLevel !== undefined).length,
      curatorsWithKaminoData: kaminoCuratorCount,
      curatorsWithEulerData: eulerCuratorCount,
    };

    return NextResponse.json({ curators, validation, _meta: { dataSources: tracker.getSummary() } });
  } catch (error) {
    console.error('Error fetching curators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curator data', curators: [], validation: { source: 'error' } },
      { status: 500 }
    );
  }
}

// formatCuratorName imported from @/lib/curator-names

// Estimate vault count based on TVL (rough heuristic)
function estimateVaultCount(tvl: number): number {
  if (tvl > 1_000_000_000) return Math.floor(40 + (tvl / 100_000_000));
  if (tvl > 500_000_000) return Math.floor(25 + (tvl / 50_000_000));
  if (tvl > 100_000_000) return Math.floor(10 + (tvl / 20_000_000));
  return Math.floor(5 + (tvl / 10_000_000));
}
