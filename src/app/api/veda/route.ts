// Veda BoringVault API
// Fetches vault data from Veda and Veda-powered protocols

import { NextResponse } from 'next/server';
import {
  getAllVedaPoweredVaults,
  aggregateVedaByCurator,
  getVedaFeeEstimates,
} from '@/lib/veda';
import { getConcreteData } from '@/lib/concrete';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch Veda vaults and Concrete data in parallel (avoid redundant calls)
    const [vaults, concreteData] = await Promise.all([
      getAllVedaPoweredVaults(),
      getConcreteData(),
    ]);

    const curatorData = aggregateVedaByCurator(vaults);
    const feeEstimates = getVedaFeeEstimates();

    // Build curator fee data from aggregated vaults + Concrete
    const curatorFeeData = curatorData.map(curator => {
      const feeEstimate = feeEstimates.find(f => f.curatorName === curator.curatorName);
      return {
        curatorName: curator.curatorName,
        vaults: curator.vaults.map(v => ({
          name: v.name,
          symbol: v.symbol,
          chain: v.chain,
          tvl: v.tvlUsd,
          apy: v.apy,
        })),
        totalTvl: curator.totalTvl,
        avgApy: curator.avgApy,
        vaultCount: curator.vaultCount,
        performanceFeePct: feeEstimate?.performanceFeePct || 10,
        managementFeePct: feeEstimate?.managementFeePct || 0,
        feeNote: feeEstimate?.note || 'Fee estimates based on industry standards.',
      };
    });

    // Add Concrete if available
    if (concreteData) {
      curatorFeeData.push({
        curatorName: concreteData.curatorName,
        vaults: concreteData.vaults.map(v => ({
          name: v.name,
          symbol: v.symbol,
          chain: v.chain,
          tvl: v.tvl,
          apy: v.apy,
        })),
        totalTvl: concreteData.totalTvl,
        avgApy: concreteData.avgApy,
        vaultCount: concreteData.vaultCount,
        performanceFeePct: concreteData.performanceFeePct,
        managementFeePct: concreteData.managementFeePct,
        feeNote: concreteData.feeNote,
      });
    }

    // Sort by TVL
    curatorFeeData.sort((a, b) => b.totalTvl - a.totalTvl);

    // Calculate totals including Concrete
    const totalTvl = curatorFeeData.reduce((sum, c) => sum + c.totalTvl, 0);
    const totalVaults = curatorFeeData.reduce((sum, c) => sum + c.vaultCount, 0);
    const uniqueChains = [...new Set(curatorFeeData.flatMap(c => c.vaults.map(v => v.chain)))];

    return NextResponse.json({
      curators: curatorFeeData,
      allVaults: vaults,
      feeEstimates,
      stats: {
        totalVaults,
        totalTvl,
        curatorCount: curatorFeeData.length,
        chains: uniqueChains,
      },
      source: 'Veda + Concrete (via DefiLlama)',
      note: 'Veda is vault infrastructure. Concrete and ether.fi Liquid build on Veda BoringVault.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Veda API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch Veda vault data',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
