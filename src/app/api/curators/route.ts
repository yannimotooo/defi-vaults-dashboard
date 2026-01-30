import { NextResponse } from 'next/server';
import { getAllProtocols, filterRiskCurators, extractChains, getYieldPools, filterCuratorVaultsFromPools, type VaultPool } from '@/lib/defillama';
import { getMorphoCuratorData, crossReferenceCuratorData } from '@/lib/dune';
import { getAllCuratorsFeeData, getMorphoCuratorsTvl } from '@/lib/morpho';
import { getEulerCuratorFeeData } from '@/lib/euler';
import { getRiskMetrics } from '@/lib/risk';
import { fetchKaminoVaultsDirectly, aggregateByKaminoCurator, bpsToPercent } from '@/lib/kamino-onchain';
import type { Curator } from '@/types';

// Kamino curator data interface
interface KaminoCuratorData {
  curatorName: string;
  vaultCount: number;
  avgPerformanceFeePct: number;
  avgManagementFeePct: number;
  estimatedTvlUsd: number;
}

// Simple in-memory cache for Kamino data (expensive Solana RPC call)
let kaminoCache: { data: KaminoCuratorData[]; timestamp: number } | null = null;
const KAMINO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Fetch Kamino curator data with TVL estimates (cached)
async function getKaminoCuratorData(): Promise<KaminoCuratorData[]> {
  // Return cached data if valid
  if (kaminoCache && Date.now() - kaminoCache.timestamp < KAMINO_CACHE_TTL) {
    console.log('[Kamino] Using cached data');
    return kaminoCache.data;
  }

  try {
    // Fetch on-chain vault data with timeout
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const result = await fetchKaminoVaultsDirectly(rpcUrl);
    clearTimeout(timeoutId);

    if (result.vaults.length === 0) {
      console.log('[Kamino] No vaults found');
      return [];
    }

    // Aggregate by curator
    const curatorMap = aggregateByKaminoCurator(result.vaults);

    // Get Kamino Lend TVL from DeFiLlama for proportional distribution
    // Kamino Lend has ~$2B TVL
    const KAMINO_TOTAL_TVL = 2_000_000_000; // $2B estimate

    // Calculate total vaults for proportional TVL
    const totalVaults = result.vaults.length;

    // Convert to array with TVL estimates
    const curators: KaminoCuratorData[] = [];
    for (const [, data] of curatorMap) {
      // Skip "Other" and "Kamino Core" for curator attribution
      if (data.curatorName === 'Other' || data.curatorName === 'Kamino Core') continue;

      // Estimate TVL proportionally based on vault count
      // This is approximate - real TVL would need on-chain reads
      const tvlShare = data.vaultCount / totalVaults;
      const estimatedTvl = KAMINO_TOTAL_TVL * tvlShare;

      curators.push({
        curatorName: data.curatorName,
        vaultCount: data.vaultCount,
        avgPerformanceFeePct: data.avgPerformanceFeePct,
        avgManagementFeePct: data.avgManagementFeePct,
        estimatedTvlUsd: estimatedTvl,
      });
    }

    console.log(`[Kamino] Processed ${curators.length} curators from ${result.vaults.length} vaults`);

    // Cache the result
    kaminoCache = { data: curators, timestamp: Date.now() };

    return curators;
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

export const dynamic = 'force-dynamic';

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

// Curator name variations for fee data lookup
// Maps DeFiLlama protocol slugs to possible Morpho/Euler curator names
const CURATOR_NAME_VARIANTS: Record<string, string[]> = {
  'steakhouse-financial': ['Steakhouse Financial', 'Steakhouse'],
  'gauntlet': ['Gauntlet'],
  'sentora': ['Sentora'],
  'mev-capital': ['MEV Capital', 'Mev Capital'],
  're7-labs': ['RE7 Labs', 'Re7 Labs', 'RE7'],
  'k3-capital': ['K3 Capital', 'K3'],
  'block-analitica': ['Block Analitica', 'BA Labs'],
  'euler-dao': ['Euler DAO', 'Euler'],
  'b-protocol': ['B.Protocol', 'B Protocol'],
  'b.protocol-curator': ['B.Protocol', 'B Protocol', 'B.Protocol Curator'],
  'summer-fi': ['Summer.fi', 'Summerfi'],
  'ultrayield-by-edge': ['UltraYield', 'Ultrayield', 'Edge'],
  'hyperithm': ['Hyperithm'],
  'vault-bridge': ['Vault Bridge', 'VaultBridge'],
  'clearstar': ['Clearstar'],
  'telos-consilium': ['Telos Consilium', 'Telos'],
  'tulipa-capital': ['Tulipa Capital', 'Tulipa'],
  'kpk': ['kpk', 'KPK'],
  'alphaping': ['AlphaPing', 'Alphaping'],
  '9summits': ['9Summits', '9summits'],
  // Name variations between DeFiLlama and Morpho API
  'yearn-curating': ['Yearn', 'Yearn Curating', 'yearn'],
  'hakutora': ['Hakutora'],
  'singularv': ['SingularV'],
  'avantgarde': ['Avantgarde'],
  'apostro': ['Apostro'],
};

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
    // Fetch data from all sources in parallel
    const [
      allProtocols,
      duneCuratorData,
      morphoFeeData,
      eulerFeeData,
      allYieldPools,
      morphoCuratorTvl,  // On-chain TVL (primary source)
      riskData,          // Risk metrics
      kaminoCuratorData, // Kamino Solana data
    ] = await Promise.all([
      getAllProtocols(),
      getMorphoCuratorData().catch(() => []),
      getAllCuratorsFeeData().catch(() => []),
      getEulerCuratorFeeData().catch(() => []),
      getYieldPools().catch(() => []),
      getMorphoCuratorsTvl().catch(() => []),  // Authoritative on-chain TVL
      getRiskMetrics().catch(() => null),       // Risk data
      getKaminoCuratorData().catch(() => []),   // Kamino Solana data
    ]);

    // Create Morpho TVL lookup map (normalized curator name -> data)
    const normalizeName = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '');
    const morphoTvlMap = new Map(
      morphoCuratorTvl.map(c => [normalizeName(c.curatorName), c])
    );

    // Create risk data lookup map
    const riskMap = new Map(
      riskData?.curators.map(c => [normalizeName(c.curatorName), c]) || []
    );

    // Create Kamino data lookup map (for Solana TVL and fee data)
    const kaminoMap = new Map(
      kaminoCuratorData.map(c => [normalizeName(c.curatorName), c])
    );
    console.log(`[Curators] Kamino data available for ${kaminoCuratorData.length} curators`);

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

    // Merge/add Euler fee data
    for (const ed of eulerFeeData) {
      const key = normalizeFeeKey(ed.curatorName);
      const existing = feeDataMap.get(key);

      if (existing) {
        // Merge - average the fees (weighted by TVL would be better but we don't have combined TVL here)
        feeDataMap.set(key, {
          avgPerformanceFee: (existing.avgPerformanceFee + ed.avgPerformanceFee) / 2,
          avgManagementFee: existing.avgManagementFee,
          estimatedAnnualFeeRevenue: existing.estimatedAnnualFeeRevenue,
          avgGrossApy: existing.avgGrossApy,
          avgNetApy: existing.avgNetApy,
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

        // Look up Kamino data (Solana vaults)
        const kaminoData = kaminoMap.get(normalizeName(p.name))
          || kaminoMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => kaminoMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // TVL: DeFiLlama is PRIMARY (aggregates all protocols)
        // Morpho data is used for VERIFICATION and enhancement (APY, risk)
        // Kamino data adds Solana TVL (not always in DeFiLlama)
        const defillamaTvl = p.tvl;
        const morphoTvl = morphoData?.totalTvl || 0;
        const kaminoTvl = kaminoData?.estimatedTvlUsd || 0;

        // Total TVL includes DeFiLlama + Kamino (if not already counted)
        // DeFiLlama should include Kamino, but we add it as a separate field for visibility
        const totalTvl = defillamaTvl;

        // Determine if Morpho data closely matches DeFiLlama (curator is primarily Morpho)
        // If within 20%, consider it "verified" by on-chain data
        const morphoMatchesDefillama = morphoTvl > 0 && defillamaTvl > 0
          && Math.abs(morphoTvl - defillamaTvl) / defillamaTvl < 0.20;

        // TVL source indicates where majority of TVL is tracked
        const tvlSource = morphoMatchesDefillama ? 'morpho' as const : 'defillama' as const;

        // Use real vault data when available, fallback to estimates
        // Include Kamino vault count if available
        const morphoVaultCount = morphoData?.vaultCount || 0;
        const kaminoVaultCount = kaminoData?.vaultCount || 0;
        const hasRealVaultCount = (morphoVaultCount + kaminoVaultCount) > 0 || (realMetrics?.vaultCount ?? 0) > 0;
        const vaultCount = (morphoVaultCount + kaminoVaultCount) || realMetrics?.vaultCount || estimateVaultCount(totalTvl);
        const vaultCountEstimated = !hasRealVaultCount;

        // APY Priority: 1) Fee data grossApy (from Morpho), 2) Morpho on-chain, 3) DefiLlama, 4) 0
        const avgApy = feeData?.avgGrossApy || feeData?.avgNetApy || morphoData?.avgApy || realMetrics?.avgApy || 0;

        // Build protocols list - include Kamino if curator has Solana vaults
        let protocols = realMetrics?.protocols?.length
          ? [...realMetrics.protocols]
          : [...metadata.protocols];
        if (kaminoData && !protocols.includes('Kamino')) {
          protocols.push('Kamino');
        }

        // Build chains list - include Solana if curator has Kamino vaults
        let chains = realMetrics?.chains?.length
          ? [...realMetrics.chains]
          : (defillamaChains.length > 0 ? [...defillamaChains] : ['Ethereum']);
        if (kaminoData && !chains.includes('Solana')) {
          chains.push('Solana');
        }

        // Data confidence based on data completeness:
        // - High: Has on-chain data (Morpho or Kamino) AND has APY data
        // - Medium: Has some data but incomplete
        // - Low: Missing critical data
        const hasOnChainData = morphoTvl > 0 || kaminoTvl > 0;
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
          // Calculate net flow from change percentages (use DeFiLlama changes as Morpho doesn't have this)
          netFlow7d: p.change_7d ? (totalTvl * p.change_7d) / 100 : 0,
          netFlow30d: p.change_1m ? (totalTvl * p.change_1m) / 100 : 0,
          // TVL source tracking (DeFiLlama is primary, Morpho is verification)
          tvlSource,
          morphoTvl: morphoTvl > 0 ? morphoTvl : undefined,
          defillamaTvl,
          // Kamino (Solana) data
          kaminoTvl: kaminoTvl > 0 ? kaminoTvl : undefined,
          kaminoVaultCount: kaminoVaultCount > 0 ? kaminoVaultCount : undefined,
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
    const kaminoCuratorCount = curators.filter(c => c.kaminoTvl).length;
    if (morphoTvlCount > 0) sources.push(`Morpho On-chain (${morphoTvlCount})`);
    if (kaminoCuratorCount > 0) sources.push(`Kamino Solana (${kaminoCuratorCount})`);
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
      // TVL source breakdown
      morphoTvlCount,
      defillamaTvlCount: curators.filter(c => c.tvlSource === 'defillama').length,
      // Data availability
      duneDataAvailable: duneCuratorData.length > 0,
      morphoFeeDataAvailable: morphoFeeData.length > 0,
      eulerFeeDataAvailable: eulerFeeData.length > 0,
      riskDataAvailable: riskData !== null,
      // Quality metrics
      crossReferencedCount: crossReferenced.filter(c => c.dataSource === 'both').length,
      highConfidenceCount: curators.filter(c => c.dataConfidence === 'high').length,
      curatorsWithFeeData: curators.filter(c => c.avgPerformanceFee !== undefined).length,
      curatorsWithRiskData: curators.filter(c => c.riskLevel !== undefined).length,
    };

    return NextResponse.json({ curators, validation });
  } catch (error) {
    console.error('Error fetching curators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curator data', curators: [], validation: { source: 'error' } },
      { status: 500 }
    );
  }
}

// Format curator names for display
function formatCuratorName(name: string): string {
  const nameMap: Record<string, string> = {
    'Steakhouse Financial': 'Steakhouse Financial',
    'MEV Capital': 'MEV Capital',
    'K3 Capital': 'K3 Capital',
    'Re7 Labs': 'RE7 Labs',
    'Block Analitica': 'Block Analitica',
    'Euler DAO': 'Euler DAO',
    'UltraYield by Edge': 'UltraYield',
    'Vault Bridge': 'Vault Bridge',
    'B.Protocol': 'B.Protocol',
    'Summer.fi': 'Summer.fi',
  };

  return nameMap[name] || name;
}

// Estimate vault count based on TVL (rough heuristic)
function estimateVaultCount(tvl: number): number {
  if (tvl > 1_000_000_000) return Math.floor(40 + (tvl / 100_000_000));
  if (tvl > 500_000_000) return Math.floor(25 + (tvl / 50_000_000));
  if (tvl > 100_000_000) return Math.floor(10 + (tvl / 20_000_000));
  return Math.floor(5 + (tvl / 10_000_000));
}
