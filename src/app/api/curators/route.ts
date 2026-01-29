import { NextResponse } from 'next/server';
import { getAllProtocols, filterRiskCurators, extractChains, getCuratorVaults } from '@/lib/defillama';
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

// Calculate real metrics from vault data
async function getCuratorRealMetrics(slug: string): Promise<{
  vaultCount: number;
  avgApy: number;
  protocols: string[];
  chains: string[];
  vaultTvl: number;
} | null> {
  try {
    const vaults = await getCuratorVaults(slug);
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

export async function GET() {
  try {
    // Fetch data from all sources in parallel
    const [allProtocols, duneCuratorData, morphoFeeData, eulerFeeData] = await Promise.all([
      getAllProtocols(),
      getMorphoCuratorData().catch(() => []), // Don't fail if Dune fails
      getAllCuratorsFeeData().catch(() => []), // Don't fail if Morpho fails
      getEulerCuratorFeeData().catch(() => []), // Don't fail if Euler fails
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

    // Add Morpho fee data
    for (const fd of morphoFeeData) {
      const key = fd.curatorName.toLowerCase().replace(/\s+/g, '');
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
      const key = ed.curatorName.toLowerCase().replace(/\s+/g, '');
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

    // Fetch real vault metrics for each curator (in parallel, with limit)
    const curatorSlugs = curatorProtocols.filter(p => p.tvl > 0).map(p => p.slug);
    const realMetricsPromises = curatorSlugs.map(slug => getCuratorRealMetrics(slug));
    const realMetricsResults = await Promise.all(realMetricsPromises);
    const realMetricsMap = new Map(
      curatorSlugs.map((slug, i) => [slug, realMetricsResults[i]])
    );

    // Transform to our Curator type with real metrics when available
    const curators: Curator[] = curatorProtocols
      .filter(p => p.tvl > 0)
      .map(p => {
        const metadata = CURATOR_METADATA[p.slug] || { protocols: ['Morpho'] };
        const defillamaChains = extractChains(p);
        const crossRef = crossRefMap.get(p.slug);
        const realMetrics = realMetricsMap.get(p.slug);

        // Use real vault data when available, fallback to estimates
        const vaultCount = realMetrics?.vaultCount || estimateVaultCount(p.tvl);
        const avgApy = realMetrics?.avgApy || 0; // Default to 0 if no real data
        const protocols = realMetrics?.protocols?.length
          ? realMetrics.protocols
          : metadata.protocols;
        const chains = realMetrics?.chains?.length
          ? realMetrics.chains
          : (defillamaChains.length > 0 ? defillamaChains : ['Ethereum']);

        // Look up fee data from Morpho + Euler combined map
        const curatorNameNormalized = formatCuratorName(p.name).toLowerCase().replace(/\s+/g, '');
        const feeData = feeDataMap.get(curatorNameNormalized);

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
