// Veda BoringVault API
// Fetches vault data from Veda and Veda-powered protocols

import { NextResponse } from 'next/server';
import {
  getAllVedaPoweredVaults,
  aggregateVedaByCurator,
  getVedaFeeEstimates,
  getVedaCuratorFeeData,
} from '@/lib/veda';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [vaults, curatorFeeData] = await Promise.all([
      getAllVedaPoweredVaults(),
      getVedaCuratorFeeData(), // Includes Concrete
    ]);

    const curatorData = aggregateVedaByCurator(vaults);
    const feeEstimates = getVedaFeeEstimates();

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
