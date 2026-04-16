/**
 * /api/curators/flows
 *
 * Returns per-curator TVL flow over a 7d / 30d / 90d window plus heuristic
 * correlated-pair candidates. Backed by DeFiLlama's per-protocol-slug
 * historical TVL endpoint via `getProtocolHistoricalTvl()`.
 *
 * Query params:
 *   window: 7 | 30 | 90 (default 30)
 *
 * Response shape: see FlowAttributionResult in src/lib/flow-attribution.ts
 *
 * **Cache:** revalidate every hour. DeFiLlama updates daily, so 1h is fresh
 * enough and avoids re-fetching ~50 protocol histories per request.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getProtocolHistoricalTvl } from '@/lib/defillama';
import {
  computeCuratorFlows,
  type CuratorHistory,
  type FlowWindow,
} from '@/lib/flow-attribution';
import { CURATOR_SLUG_TO_NAME, CURATOR_NAME_VARIANTS } from '@/lib/curator-names';

export const revalidate = 3600;

const VALID_WINDOWS: ReadonlySet<FlowWindow> = new Set<FlowWindow>([7, 30, 90]);

// Every curator slug we know about — both Risk Curators and Onchain Capital
// Allocator entries. Drives the fan-out fetch.
const ALL_CURATOR_SLUGS = Object.keys(CURATOR_NAME_VARIANTS);

export async function GET(request: NextRequest) {
  try {
    const windowParam = parseInt(request.nextUrl.searchParams.get('window') || '30', 10);
    const windowDays: FlowWindow = (VALID_WINDOWS.has(windowParam as FlowWindow)
      ? windowParam
      : 30) as FlowWindow;

    // Fetch each curator's historical TVL in parallel. getProtocolHistoricalTvl
    // already caches via Next.js fetch cache and logs failures; an empty
    // history just becomes a curator with no flow data (filtered out below).
    const histories: CuratorHistory[] = await Promise.all(
      ALL_CURATOR_SLUGS.map(async (slug) => {
        const data = await getProtocolHistoricalTvl(slug);
        return {
          slug,
          name: CURATOR_SLUG_TO_NAME[slug] || slug,
          history: data.map(p => ({ date: p.date, tvl: p.tvl })),
        };
      }),
    );

    // Drop curators with no history at all — they add no signal and clutter the UI.
    const withCoverage = histories.filter(h => h.history.length > 0);

    const result = computeCuratorFlows(withCoverage, windowDays);

    // Drop curators where we couldn't compute a netFlow (window too long for
    // their history). UI shouldn't see no-data rows in the leaderboard.
    return NextResponse.json({
      ...result,
      curators: result.curators.filter(c => c.netFlow != null),
    });
  } catch (error) {
    console.error('[/api/curators/flows] error:', error);
    return NextResponse.json(
      { error: 'Failed to compute curator flows', curators: [], correlatedPairs: [] },
      { status: 500 },
    );
  }
}
