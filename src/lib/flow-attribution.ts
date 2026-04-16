/**
 * Per-curator flow attribution over time windows (7d / 30d / 90d).
 *
 * **Goal:** answer "which curators gained vs lost TVL over the last window,
 * and were any losses correlated with another curator's gains?" — the core
 * competitive-intel question for tracking displacement (e.g. Steakhouse →
 * Gauntlet on Morpho stables).
 *
 * **Data source:** DeFiLlama's `api.llama.fi/protocol/<slug>` endpoint via
 * the existing `getProtocolHistoricalTvl()` in `defillama.ts`. Returns daily
 * historical TVL per curator-as-protocol-slug.
 *
 * **Why not per-pool?** A previous iteration tried `yields.llama.fi/chart/<id>`
 * for finer per-pool/per-asset breakdown, but `yields.llama.fi` sits behind
 * Cloudflare bot protection that 403s our IP after batched requests. The
 * per-protocol slug endpoint is on a different host (`api.llama.fi`) without
 * the same protection. We get coarser granularity (no per-asset breakdown)
 * but reliable coverage.
 *
 * **Pairwise attribution caveat:** identifying "Curator A's $X went to
 * Curator B" with certainty requires on-chain transaction tracing across
 * vault contracts. Out of scope here. We surface correlated swap candidates
 * (similar magnitude, opposite direction, same time window) as
 * `confidence: 'low'` hints — useful for narrowing investigation, not proof.
 */

export type FlowWindow = 7 | 30 | 90;

/** A curator's daily TVL history as returned by getProtocolHistoricalTvl. */
export interface CuratorHistory {
  slug: string;
  name: string;
  /** Sorted ascending by `date` (unix seconds). */
  history: Array<{ date: number; tvl: number }>;
}

export interface CuratorFlowSummary {
  curatorSlug: string;
  curatorName: string;
  /** TVL at the start of the window (USD). null if history doesn't reach back that far. */
  startTvl: number | null;
  /** TVL at the end of the window (USD). null if no history at all. */
  endTvl: number | null;
  /** endTvl - startTvl. null if either bound is null. */
  netFlow: number | null;
  /** netFlow / startTvl as a percentage. null if startTvl is null/0. */
  flowPercent: number | null;
  /** History points covering the window — useful for the UI sparkline. */
  historyInWindow: Array<{ date: number; tvl: number }>;
}

export interface FlowAttributionResult {
  windowDays: FlowWindow;
  /** Unix seconds. */
  windowStartTimestamp: number;
  windowEndTimestamp: number;
  curators: CuratorFlowSummary[];
  /** Heuristic correlated displacement candidates. confidence is always 'low'. */
  correlatedPairs: Array<{
    fromCurator: string;
    toCurator: string;
    estimatedFlowUsd: number;
    confidence: 'low';
    rationale: string;
  }>;
}

/**
 * Find the TVL value at or just before a target unix timestamp.
 * Returns null if no history point is at or before the target (history
 * starts later than the target, e.g. a young curator vs a 90d window).
 *
 * History MUST be sorted ascending by `date`. Linear scan — chart sizes
 * are small (~360 daily points) so binary search isn't worth the complexity.
 */
function tvlAtOrBefore(
  history: Array<{ date: number; tvl: number }>,
  targetTimestamp: number,
): number | null {
  let result: number | null = null;
  for (const point of history) {
    if (point.date > targetTimestamp) break;
    result = point.tvl;
  }
  return result;
}

/**
 * Compute per-curator net flows over a time window.
 *
 * @param histories  list of per-curator daily-TVL histories
 * @param windowDays 7, 30, or 90 days back from now
 */
export function computeCuratorFlows(
  histories: CuratorHistory[],
  windowDays: FlowWindow,
): FlowAttributionResult {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStartSec = nowSec - windowDays * 24 * 3600;

  const curators: CuratorFlowSummary[] = histories.map(({ slug, name, history }) => {
    const sorted = [...history].sort((a, b) => a.date - b.date);
    const startTvl = tvlAtOrBefore(sorted, windowStartSec);
    const endTvl = sorted.length > 0 ? sorted[sorted.length - 1].tvl : null;
    const netFlow = startTvl != null && endTvl != null ? endTvl - startTvl : null;
    const flowPercent =
      startTvl != null && startTvl > 0 && netFlow != null ? (netFlow / startTvl) * 100 : null;

    return {
      curatorSlug: slug,
      curatorName: name,
      startTvl,
      endTvl,
      netFlow,
      flowPercent,
      historyInWindow: sorted.filter(p => p.date >= windowStartSec),
    };
  });

  // Sort by absolute net flow descending — biggest movers (gainers or losers) first.
  curators.sort((a, b) => Math.abs(b.netFlow ?? 0) - Math.abs(a.netFlow ?? 0));

  return {
    windowDays,
    windowStartTimestamp: windowStartSec,
    windowEndTimestamp: nowSec,
    curators,
    correlatedPairs: computeCorrelatedPairs(curators),
  };
}

/**
 * Find pairs of (loser, gainer) curators whose flow magnitudes match within
 * tolerance. Pure heuristic — confidence is always 'low'. Used to seed
 * human investigation of displacement events.
 *
 * Algorithm: for each significant loser ($5M+ outflow), greedily match the
 * largest unused gainer whose magnitude is within ±25% of the loss.
 */
function computeCorrelatedPairs(
  curators: CuratorFlowSummary[],
): FlowAttributionResult['correlatedPairs'] {
  const MIN_ABS_FLOW = 5_000_000; // $5M
  const MAGNITUDE_TOLERANCE = 0.25; // ±25%

  const losers = curators
    .filter(c => (c.netFlow ?? 0) < -MIN_ABS_FLOW)
    .sort((a, b) => (a.netFlow ?? 0) - (b.netFlow ?? 0)); // most negative first
  const gainers = curators
    .filter(c => (c.netFlow ?? 0) > MIN_ABS_FLOW)
    .sort((a, b) => (b.netFlow ?? 0) - (a.netFlow ?? 0)); // largest gain first

  const pairs: FlowAttributionResult['correlatedPairs'] = [];
  const usedGainers = new Set<string>();
  for (const loser of losers) {
    const lossMag = Math.abs(loser.netFlow!);
    const match = gainers.find(g => {
      if (usedGainers.has(g.curatorSlug)) return false;
      const gain = g.netFlow!;
      const ratio = gain / lossMag;
      return ratio >= 1 - MAGNITUDE_TOLERANCE && ratio <= 1 + MAGNITUDE_TOLERANCE;
    });
    if (match) {
      usedGainers.add(match.curatorSlug);
      pairs.push({
        fromCurator: loser.curatorName,
        toCurator: match.curatorName,
        estimatedFlowUsd: Math.min(lossMag, match.netFlow!),
        confidence: 'low',
        rationale:
          `${loser.curatorName} lost ~$${(lossMag / 1e6).toFixed(0)}M while ` +
          `${match.curatorName} gained ~$${(match.netFlow! / 1e6).toFixed(0)}M ` +
          `in the same window. Magnitude correlation only — verify with ` +
          `on-chain data before treating as a real displacement.`,
      });
    }
  }
  return pairs;
}
