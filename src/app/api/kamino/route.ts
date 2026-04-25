// Kamino Earn Vault Fee Data API
// Fetches actual on-chain fee data from Solana using direct RPC calls (no WASM dependencies)

import { NextResponse } from 'next/server';
import {
  fetchKaminoVaultsDirectly,
  aggregateByKaminoCurator,
  bpsToPercent,
} from '@/lib/kamino-onchain';

export const revalidate = 600; // 10 minutes
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export interface KaminoVaultFeeInfo {
  address: string;
  name: string;
  tokenMint: string;
  performanceFeePct: number;
  managementFeePct: number;
  curator: string | null;
}

export interface KaminoCuratorFeeData {
  curatorName: string;
  vaults: KaminoVaultFeeInfo[];
  avgPerformanceFeePct: number;
  avgManagementFeePct: number;
  vaultCount: number;
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Use custom RPC if provided, otherwise use public endpoint
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    console.log('[Kamino API] Starting direct RPC fetch...');
    const result = await fetchKaminoVaultsDirectly(rpcUrl);

    console.log(`[Kamino API] Fetched ${result.vaults.length} vaults in ${Date.now() - startTime}ms`);

    // Aggregate by curator
    const curatorMap = aggregateByKaminoCurator(result.vaults);

    // Convert to response format
    const curators: KaminoCuratorFeeData[] = [];
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

    // Sort by vault count
    curators.sort((a, b) => b.vaultCount - a.vaultCount);

    // Flatten all vaults for the allVaults response
    const allVaults: KaminoVaultFeeInfo[] = result.vaults.map(v => {
      const curator = curators.find(c => c.vaults.some(cv => cv.address === v.address));
      return {
        address: v.address,
        name: v.name,
        tokenMint: v.tokenMint,
        performanceFeePct: bpsToPercent(v.performanceFeeBps),
        managementFeePct: bpsToPercent(v.managementFeeBps),
        curator: curator?.curatorName || null,
      };
    });

    // Collect unique admin addresses for debugging
    const adminAddresses = new Map<string, { count: number; sampleVaults: string[] }>();
    for (const v of result.vaults) {
      if (!adminAddresses.has(v.admin)) {
        adminAddresses.set(v.admin, { count: 0, sampleVaults: [] });
      }
      const entry = adminAddresses.get(v.admin)!;
      entry.count++;
      if (entry.sampleVaults.length < 3) {
        entry.sampleVaults.push(v.address);
      }
    }

    // Convert to array for response
    const uniqueAdmins = Array.from(adminAddresses.entries()).map(([admin, data]) => ({
      admin,
      vaultCount: data.count,
      sampleVaults: data.sampleVaults,
    })).sort((a, b) => b.vaultCount - a.vaultCount);

    return NextResponse.json({
      curators,
      allVaults,
      stats: {
        totalVaults: result.totalFetched,
        successfulFetches: result.vaults.length,
        curatorCount: curators.length,
        uniqueAdminCount: uniqueAdmins.length,
        fetchTimeMs: Date.now() - startTime,
      },
      debug: {
        uniqueAdmins: uniqueAdmins.slice(0, 20), // Top 20 admins by vault count
        note: 'Add admin addresses to KNOWN_ADMIN_TO_CURATOR mapping in kamino-onchain.ts to identify curators',
      },
      source: 'Kamino on-chain data via direct RPC',
      chain: 'Solana',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Kamino API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch Kamino vault data',
        details: errorMessage,
        suggestion: 'Solana RPC may be rate limited. Consider using a premium RPC endpoint (set SOLANA_RPC_URL).',
        fallback: {
          note: 'Using estimated fee data instead',
          curators: [
            {
              curatorName: 'Steakhouse Financial',
              avgPerformanceFeePct: 10,
              avgManagementFeePct: 0,
              vaultCount: 0,
              vaults: [],
            },
            {
              curatorName: 'RE7 Labs',
              avgPerformanceFeePct: 10,
              avgManagementFeePct: 0,
              vaultCount: 0,
              vaults: [],
            },
            {
              curatorName: 'Gauntlet',
              avgPerformanceFeePct: 10,
              avgManagementFeePct: 0,
              vaultCount: 0,
              vaults: [],
            },
          ],
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
