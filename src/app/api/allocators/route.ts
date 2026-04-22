/**
 * /api/allocators
 *
 * Returns Onchain Capital Allocator entities from DeFiLlama — vault
 * platforms that deploy capital across protocols. These are SEPARATE from
 * curators (risk managers) and shown in their own tab.
 *
 * Examples: Grove ($3.3B, Sky/MakerDAO), Spark Liquidity Layer ($2.3B),
 * Concrete ($1.1B), ether.fi-liquid ($452M), Upshift ($306M).
 *
 * Response includes chain distribution and 7d/30d flow for each allocator.
 */

import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/http';

export const revalidate = 300; // 5 minutes

const DEFILLAMA_API = 'https://api.llama.fi';
const MIN_TVL = 10_000_000; // $10M floor

interface AllocatorEntry {
  slug: string;
  name: string;
  tvl: number;
  chains: string[];
  change7d: number | null;
  change30d: number | null;
  chainTvls: Record<string, number>;
}

export async function GET() {
  try {
    const response = await fetchWithTimeout(`${DEFILLAMA_API}/protocols`, {
      next: { revalidate: 300 },
      timeoutMs: 12_000,
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'DeFiLlama unavailable', allocators: [] }, { status: 503 });
    }

    const protocols = await response.json();

    const allocators: AllocatorEntry[] = protocols
      .filter((p: Record<string, unknown>) =>
        p.category === 'Onchain Capital Allocator' &&
        (p.tvl as number ?? 0) >= MIN_TVL
      )
      .map((p: Record<string, unknown>): AllocatorEntry => {
        // Filter chainTvls to exclude non-chain entries (staking, pool2, borrowed, etc.)
        const rawChainTvls = (p.chainTvls as Record<string, number>) || {};
        const chainTvls: Record<string, number> = {};
        const excluded = new Set(['staking', 'pool2', 'borrowed', 'treasury', 'vesting']);
        for (const [chain, tvl] of Object.entries(rawChainTvls)) {
          if (!chain.includes('-') && !excluded.has(chain)) {
            chainTvls[chain] = tvl;
          }
        }

        return {
          slug: p.slug as string,
          name: p.name as string,
          tvl: p.tvl as number,
          chains: (p.chains as string[]) || [],
          change7d: (p.change_7d as number) ?? null,
          change30d: (p.change_1m as number) ?? null,
          chainTvls,
        };
      })
      .sort((a: AllocatorEntry, b: AllocatorEntry) => b.tvl - a.tvl);

    return NextResponse.json({
      allocators,
      count: allocators.length,
      totalTvl: allocators.reduce((s: number, a: AllocatorEntry) => s + a.tvl, 0),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[/api/allocators] error:', error);
    return NextResponse.json({ error: 'Failed to fetch allocators', allocators: [] }, { status: 500 });
  }
}
