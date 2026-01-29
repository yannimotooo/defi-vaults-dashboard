import { NextResponse } from 'next/server';
import { getAllProtocols, filterRiskCurators, extractChains, getYieldPools, filterCuratorVaultsFromPools, type VaultPool } from '@/lib/defillama';
import { getMorphoCuratorData, crossReferenceCuratorData } from '@/lib/dune';
import { getAllCuratorsFeeData } from '@/lib/morpho';
import { getEulerCuratorFeeData } from '@/lib/euler';
import type { Curator } from '@/types';

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
    // Fetch data from all sources in parallel (including yield pools ONCE to avoid N+1 queries)
    const [allProtocols, duneCuratorData, morphoFeeData, eulerFeeData, allYieldPools] = await Promise.all([
      getAllProtocols(),
      getMorphoCuratorData().catch(() => []), // Don't fail if Dune fails
      getAllCuratorsFeeData().catch(() => []), // Don't fail if Morpho fails
      getEulerCuratorFeeData().catch(() => []), // Don't fail if Euler fails
      getYieldPools().catch(() => []), // Fetch pools once for all curator metrics
    ]);

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

        // Use real vault data when available, fallback to estimates
        const vaultCount = realMetrics?.vaultCount || estimateVaultCount(p.tvl);

        // APY Priority: 1) Morpho/Euler grossApy (most accurate), 2) DefiLlama yields, 3) 0
        // Note: DefiLlama yields indexes by protocol (morpho-v1), not curator, so it often returns 0
        const avgApy = feeData?.avgGrossApy || feeData?.avgNetApy || realMetrics?.avgApy || 0;

        const protocols = realMetrics?.protocols?.length
          ? realMetrics.protocols
          : metadata.protocols;
        const chains = realMetrics?.chains?.length
          ? realMetrics.chains
          : (defillamaChains.length > 0 ? defillamaChains : ['Ethereum']);

        return {
          name: formatCuratorName(p.name),
          slug: p.slug,
          // Use DeFiLlama as primary TVL source
          totalTvl: p.tvl,
          vaultCount,
          chains,
          protocols,
          avgApy,
          // Calculate net flow from change percentages
          netFlow7d: p.change_7d ? (p.tvl * p.change_7d) / 100 : 0,
          netFlow30d: p.change_1m ? (p.tvl * p.change_1m) / 100 : 0,
          // Add cross-reference info
          dataConfidence: crossRef?.confidence,
          duneTvl: crossRef?.duneTvl,
          // Add fee economics from Morpho + Euler
          avgPerformanceFee: feeData?.avgPerformanceFee,
          avgManagementFee: feeData?.avgManagementFee,
          estimatedAnnualRevenue: feeData?.estimatedAnnualFeeRevenue,
          grossApy: feeData?.avgGrossApy,
          netApy: feeData?.avgNetApy,
        };
      })
      .sort((a, b) => b.totalTvl - a.totalTvl);

    // Add comprehensive validation info
    const sources = ['DeFiLlama'];
    if (duneCuratorData.length > 0) sources.push('Dune');
    if (morphoFeeData.length > 0) sources.push('Morpho (V1+V2)');
    if (eulerFeeData.length > 0) sources.push('Euler V2');

    const validation = {
      source: sources.join(' + '),
      timestamp: new Date().toISOString(),
      curatorCount: curators.length,
      totalTvl: curators.reduce((sum, c) => sum + c.totalTvl, 0),
      duneDataAvailable: duneCuratorData.length > 0,
      morphoFeeDataAvailable: morphoFeeData.length > 0,
      eulerFeeDataAvailable: eulerFeeData.length > 0,
      crossReferencedCount: crossReferenced.filter(c => c.dataSource === 'both').length,
      highConfidenceCount: crossReferenced.filter(c => c.confidence === 'high').length,
      curatorsWithFeeData: curators.filter(c => c.avgPerformanceFee !== undefined).length,
      // Note: Kamino (Solana) doesn't have public REST API for fees
      kaminoNote: 'Kamino fee data unavailable - no public API',
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
