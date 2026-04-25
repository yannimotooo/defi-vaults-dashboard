import { NextResponse } from 'next/server';
import { getCuratorFeeData, getAllCuratorsFeeData, type CuratorFeeData } from '@/lib/morpho';
import { getEulerCuratorFeeData, getEulerCuratorFeeDataByName, type EulerCuratorFeeData } from '@/lib/euler';
import {
  getKaminoCuratorFeeEstimate,
  type KaminoCuratorOnChainData,
} from '@/lib/kamino';
import { getVedaCuratorFeeData } from '@/lib/veda';
import { DataSourceTracker } from '@/lib/data-source-tracker';

export const revalidate = 300; // 5 minutes
export const dynamic = 'force-dynamic';

const DISCLAIMER = `Fee data sources:
• Morpho (V1 + V2): On-chain data via GraphQL API
• Euler V2: On-chain data via Goldsky subgraphs
• Kamino (Solana): On-chain data via direct RPC
• Veda (BoringVault): Data via DefiLlama, fee estimates

Curators may have off-chain fee arrangements, revenue sharing agreements, or other private deals not reflected here.`;

// Fetch Kamino on-chain data using direct RPC (no WASM dependencies)
async function fetchKaminoOnChainData(): Promise<KaminoCuratorOnChainData[] | null> {
  try {
    const {
      fetchKaminoVaultsDirectly,
      aggregateByKaminoCurator,
      bpsToPercent,
    } = await import('@/lib/kamino-onchain');

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const result = await fetchKaminoVaultsDirectly(rpcUrl);

    const curatorMap = aggregateByKaminoCurator(result.vaults);

    // Convert to the expected format
    const curators: KaminoCuratorOnChainData[] = [];
    for (const [, data] of curatorMap) {
      curators.push({
        curatorName: data.curatorName,
        vaults: data.vaults.map(v => ({
          address: v.address,
          name: v.name,
          tokenMint: v.tokenMint,
          performanceFeePct: bpsToPercent(v.performanceFeeBps),
          managementFeePct: bpsToPercent(v.managementFeeBps),
          curator: data.curatorName,
        })),
        avgPerformanceFeePct: data.avgPerformanceFeePct,
        avgManagementFeePct: data.avgManagementFeePct,
        vaultCount: data.vaultCount,
      });
    }

    return curators;
  } catch (error) {
    console.error('Error fetching Kamino on-chain data:', error);
    return null;
  }
}

// Normalize curator slug for matching
function normalizeCuratorName(name: string): string {
  return name.toLowerCase().replace(/[\s\-\.]/g, '');
}

// Convert Euler fee data to our standard format
function convertEulerToStandardFormat(euler: EulerCuratorFeeData): CuratorFeeData {
  return {
    curatorName: euler.curatorName,
    vaultCount: euler.vaultCount,
    totalTvl: euler.totalTvl,
    avgPerformanceFee: euler.avgPerformanceFee,
    avgManagementFee: 0, // Euler doesn't have separate management fees
    avgGrossApy: 0, // Would need additional data
    avgNetApy: 0,
    estimatedAnnualFeeRevenue: 0, // Can't calculate without APY
    vaultFees: euler.vaults.map(v => ({
      vaultName: v.vaultName,
      vaultSymbol: v.vaultSymbol,
      tvl: v.tvl,
      performanceFee: v.performanceFee,
      grossApy: 0,
      netApy: 0,
      estimatedFeeRevenue: 0,
    })),
  };
}

// Merge fee data from multiple sources
function mergeCuratorFeeData(
  morphoData: CuratorFeeData | null,
  eulerData: EulerCuratorFeeData | null
): CuratorFeeData | null {
  if (!morphoData && !eulerData) return null;

  if (!eulerData) return morphoData;
  if (!morphoData) return convertEulerToStandardFormat(eulerData);

  // Merge both - combine vaults and recalculate averages
  const eulerConverted = convertEulerToStandardFormat(eulerData);

  const combinedVaults = [...morphoData.vaultFees, ...eulerConverted.vaultFees];
  const totalTvl = morphoData.totalTvl + eulerConverted.totalTvl;

  // TVL-weighted average performance fee
  const weightedFee = totalTvl > 0
    ? (morphoData.avgPerformanceFee * morphoData.totalTvl +
       eulerConverted.avgPerformanceFee * eulerConverted.totalTvl) / totalTvl
    : 0;

  return {
    curatorName: morphoData.curatorName,
    vaultCount: morphoData.vaultCount + eulerConverted.vaultCount,
    totalTvl,
    avgPerformanceFee: weightedFee,
    avgManagementFee: morphoData.avgManagementFee,
    avgGrossApy: morphoData.avgGrossApy, // Only Morpho has this
    avgNetApy: morphoData.avgNetApy,
    estimatedAnnualFeeRevenue: morphoData.estimatedAnnualFeeRevenue,
    vaultFees: combinedVaults.sort((a, b) => b.tvl - a.tvl),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const curatorSlug = searchParams.get('curator');

    // Use centralized slug-to-name mapping
    const { CURATOR_SLUG_TO_NAME: slugToName } = await import('@/lib/curator-names');

    if (curatorSlug) {
      // Get fee data for a specific curator from all sources
      const curatorName = slugToName[curatorSlug] || curatorSlug;

      const singleTracker = new DataSourceTracker();
      const [morphoFeeData, eulerFeeData, kaminoOnChainData] = await Promise.all([
        singleTracker.track('Morpho Fees', getCuratorFeeData(curatorSlug), null),
        singleTracker.track('Euler Fees', getEulerCuratorFeeDataByName(curatorName), null),
        singleTracker.track('Kamino On-Chain', fetchKaminoOnChainData(), null),
      ]);

      // Get Kamino estimate as fallback
      const kaminoEstimate = getKaminoCuratorFeeEstimate(curatorSlug);

      // Find Kamino on-chain data for this curator
      // First try exact match, then look for any non-Other data
      let kaminoCuratorData = kaminoOnChainData?.find(c => {
        const normalized = c.curatorName.toLowerCase().replace(/[\s\-]/g, '');
        const slug = curatorSlug.toLowerCase().replace(/[\s\-]/g, '');
        return normalized.includes(slug) || slug.includes(normalized);
      });

      // If no specific curator match, include aggregate Kamino data for known curators
      // (Steakhouse, Gauntlet, RE7 are known to have Kamino vaults)
      const knownKaminoCurators = ['steakhouse', 'gauntlet', 're7'];
      const slugNormalized = curatorSlug.toLowerCase().replace(/[\s\-]/g, '');
      const isKnownKaminoCurator = knownKaminoCurators.some(k => slugNormalized.includes(k));

      // If this is a known Kamino curator but we couldn't match by name,
      // return aggregate Kamino stats (names aren't being extracted properly yet)
      if (!kaminoCuratorData && isKnownKaminoCurator && kaminoOnChainData) {
        // Get the "Other" category which contains all vaults
        const otherData = kaminoOnChainData.find(c => c.curatorName === 'Other');
        if (otherData && otherData.vaultCount > 0) {
          kaminoCuratorData = {
            ...otherData,
            curatorName: `Kamino Vaults (aggregate - ${otherData.vaultCount} total)`,
          };
        }
      }

      const mergedData = mergeCuratorFeeData(morphoFeeData, eulerFeeData);

      // Determine which sources provided data
      const sources: string[] = [];
      if (morphoFeeData) sources.push('Morpho (V1 + V2)');
      if (eulerFeeData) sources.push('Euler V2');
      if (kaminoCuratorData && kaminoCuratorData.vaultCount > 0) {
        sources.push('Kamino (on-chain)');
      } else if (kaminoEstimate) {
        sources.push('Kamino (estimate)');
      }

      return NextResponse.json({
        feeData: mergedData,
        kaminoEstimate: kaminoEstimate,
        kaminoOnChain: kaminoCuratorData || null,
        source: sources.length > 0 ? sources.join(' + ') : 'No data available',
        morphoData: morphoFeeData ? true : false,
        eulerData: eulerFeeData ? true : false,
        kaminoData: kaminoEstimate ? true : false,
        kaminoOnChainData: kaminoCuratorData ? true : false,
        disclaimer: DISCLAIMER,
        timestamp: new Date().toISOString(),
      });
    }

    // Get fee data for all curators from all sources (tracked for visibility)
    const allTracker = new DataSourceTracker();
    const [morphoAllData, eulerAllData, kaminoOnChainData, vedaData] = await Promise.all([
      allTracker.track('Morpho All Fees', getAllCuratorsFeeData(), []),
      allTracker.track('Euler All Fees', getEulerCuratorFeeData(), []),
      allTracker.track('Kamino On-Chain', fetchKaminoOnChainData(), null),
      allTracker.track('Veda Fees', getVedaCuratorFeeData(), []),
    ]);

    // Create a map to merge data by curator name
    const curatorMap = new Map<string, CuratorFeeData>();

    // Add Morpho data first
    for (const data of morphoAllData) {
      const key = normalizeCuratorName(data.curatorName);
      curatorMap.set(key, data);
    }

    // Merge or add Euler data
    for (const eulerData of eulerAllData) {
      const key = normalizeCuratorName(eulerData.curatorName);
      const existing = curatorMap.get(key);

      if (existing) {
        // Merge with existing Morpho data
        curatorMap.set(key, mergeCuratorFeeData(existing, eulerData)!);
      } else {
        // Add new entry for Euler-only curator
        curatorMap.set(key, convertEulerToStandardFormat(eulerData));
      }
    }

    const allFeeData = Array.from(curatorMap.values())
      .sort((a, b) => b.totalTvl - a.totalTvl);

    // Count Kamino curators with actual vaults
    const kaminoCuratorsWithVaults = kaminoOnChainData?.filter(c => c.vaultCount > 0).length || 0;

    // Count Veda curators with vaults
    const vedaCuratorsWithVaults = vedaData?.filter(c => c.vaultCount > 0).length || 0;

    return NextResponse.json({
      curators: allFeeData,
      kaminoCurators: kaminoOnChainData || [],
      vedaCurators: vedaData || [],
      source: `Morpho (V1 + V2): ${morphoAllData.length} curators, Euler V2: ${eulerAllData.length} curators, Kamino: ${kaminoCuratorsWithVaults} curators, Veda: ${vedaCuratorsWithVaults} curators`,
      morphoCurators: morphoAllData.length,
      eulerCurators: eulerAllData.length,
      kaminoCuratorsCount: kaminoCuratorsWithVaults,
      vedaCuratorsCount: vedaCuratorsWithVaults,
      disclaimer: DISCLAIMER,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching curator fees:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch fee data',
        feeData: null,
        disclaimer: DISCLAIMER,
      },
      { status: 500 }
    );
  }
}
