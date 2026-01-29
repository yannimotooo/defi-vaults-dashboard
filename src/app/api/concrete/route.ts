// Concrete Protocol API
// Fetches real vault data from Concrete's public API

import { NextResponse } from 'next/server';
import { fetchConcreteVaults, getConcreteData, aggregateByChain } from '@/lib/concrete';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [vaults, feeData] = await Promise.all([
      fetchConcreteVaults(),
      getConcreteData(),
    ]);

    const chainStats = aggregateByChain(vaults);

    return NextResponse.json({
      curator: feeData,
      vaults,
      chainStats: Array.from(chainStats.values()),
      stats: {
        totalVaults: vaults.length,
        totalTvl: feeData?.totalTvl || 0,
        avgApy: feeData?.avgApy || 0,
        chains: [...new Set(vaults.map(v => v.chain))],
      },
      source: 'Concrete API (apy.api.concrete.xyz)',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Concrete API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch Concrete vault data',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
