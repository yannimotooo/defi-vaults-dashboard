import { describe, it, expect } from 'vitest';
import { computeCuratorFlows, type CuratorHistory } from '@/lib/flow-attribution';

/**
 * Helper: build a CuratorHistory whose history points are spaced 1 day apart
 * ending now. tvls[0] is `daysBack` ago, tvls[N-1] is "today".
 */
function makeHistory(slug: string, name: string, tvls: number[]): CuratorHistory {
  const nowSec = Math.floor(Date.now() / 1000);
  const daySec = 24 * 3600;
  return {
    slug,
    name,
    history: tvls.map((tvl, i) => ({
      date: nowSec - (tvls.length - 1 - i) * daySec,
      tvl,
    })),
  };
}

describe('computeCuratorFlows', () => {
  it('handles empty input', () => {
    const result = computeCuratorFlows([], 30);
    expect(result.curators).toEqual([]);
    expect(result.correlatedPairs).toEqual([]);
    expect(result.windowDays).toBe(30);
  });

  it('returns null netFlow for curators with empty history', () => {
    const result = computeCuratorFlows(
      [{ slug: 'newco', name: 'New Co', history: [] }],
      30,
    );
    expect(result.curators).toHaveLength(1);
    expect(result.curators[0].netFlow).toBeNull();
    expect(result.curators[0].startTvl).toBeNull();
  });

  it('computes a positive net flow for a growing curator', () => {
    // 35 days of history, ramping from 1B → 1.5B
    const tvls = Array.from({ length: 35 }, (_, i) => 1_000_000_000 + i * 14_705_882);
    const result = computeCuratorFlows([makeHistory('grow', 'Grower', tvls)], 30);
    const c = result.curators[0];
    expect(c.netFlow).toBeGreaterThan(0);
    expect(c.flowPercent).toBeGreaterThan(0);
    expect(c.endTvl).toBeGreaterThan(c.startTvl!);
  });

  it('computes a negative net flow for a shrinking curator', () => {
    const tvls = Array.from({ length: 35 }, (_, i) => 1_000_000_000 - i * 10_000_000);
    const result = computeCuratorFlows([makeHistory('shrink', 'Shrinker', tvls)], 30);
    const c = result.curators[0];
    expect(c.netFlow).toBeLessThan(0);
    expect(c.flowPercent).toBeLessThan(0);
  });

  it('returns null startTvl when history is shorter than window', () => {
    // Only 5 days of history but asking for 30d window — startTvl should be
    // null (no point at-or-before windowStart).
    const tvls = [100, 110, 120, 130, 140];
    const result = computeCuratorFlows([makeHistory('young', 'Young', tvls)], 30);
    expect(result.curators[0].startTvl).toBeNull();
    expect(result.curators[0].netFlow).toBeNull();
  });

  it('sorts curators by absolute net flow descending', () => {
    // Window: 30 days. Histories are 35 days long, so:
    //   startTvl ≈ tvls[4]  (≈30 days ago)
    //   endTvl   = tvls[34] (today)
    // Magnitudes over the 30d window:
    //   Small:    +30M (delta over 30 daily steps of 1M)
    //   Huge:     +3B  (30 steps × 100M)
    //   Big Loss: -3.6B (30 steps × 120M)
    // Big Loss has the largest absolute change → ranks first.
    const result = computeCuratorFlows(
      [
        makeHistory('small', 'Small', Array(35).fill(0).map((_, i) => 100_000_000 + i * 1_000_000)),
        makeHistory('huge', 'Huge', Array(35).fill(0).map((_, i) => 1_000_000_000 + i * 100_000_000)),
        makeHistory('big-loss', 'Big Loss', Array(35).fill(0).map((_, i) => 5_000_000_000 - i * 120_000_000)),
      ],
      30,
    );
    expect(result.curators[0].curatorName).toBe('Big Loss');
    expect(result.curators[1].curatorName).toBe('Huge');
    expect(result.curators[2].curatorName).toBe('Small');
  });

  it('respects the window parameter (7 vs 90)', () => {
    // Linear growth: 90d window will see more growth than 7d window.
    const tvls = Array.from({ length: 100 }, (_, i) => 100_000_000 + i * 10_000_000);
    const r7 = computeCuratorFlows([makeHistory('lin', 'Linear', tvls)], 7);
    const r90 = computeCuratorFlows([makeHistory('lin', 'Linear', tvls)], 90);
    expect(Math.abs(r90.curators[0].netFlow!)).toBeGreaterThan(Math.abs(r7.curators[0].netFlow!));
  });

  it('historyInWindow only includes points within the window', () => {
    const tvls = Array.from({ length: 60 }, (_, i) => 100_000_000 + i * 1_000_000);
    const result = computeCuratorFlows([makeHistory('a', 'A', tvls)], 30);
    // 30 day window, 60 days of history → ~30 points in-window
    const inWindow = result.curators[0].historyInWindow.length;
    expect(inWindow).toBeGreaterThanOrEqual(28);
    expect(inWindow).toBeLessThanOrEqual(31);
  });
});

describe('computeCuratorFlows — correlated pair heuristic', () => {
  it('finds a matched loser/gainer pair within ±25% magnitude tolerance', () => {
    // Loser: drops by exactly $100M
    const loser = makeHistory(
      'loser',
      'Loser',
      Array(35).fill(0).map((_, i) => 500_000_000 - i * 3_000_000),
    );
    // Gainer: grows by exactly $100M
    const gainer = makeHistory(
      'gainer',
      'Gainer',
      Array(35).fill(0).map((_, i) => 100_000_000 + i * 3_000_000),
    );
    const result = computeCuratorFlows([loser, gainer], 30);
    expect(result.correlatedPairs).toHaveLength(1);
    expect(result.correlatedPairs[0].fromCurator).toBe('Loser');
    expect(result.correlatedPairs[0].toCurator).toBe('Gainer');
    expect(result.correlatedPairs[0].confidence).toBe('low');
  });

  it('does not pair when magnitudes diverge beyond tolerance', () => {
    // Loser: -$100M; gainer: +$10M (10x apart, way outside ±25%)
    const loser = makeHistory(
      'loser',
      'Loser',
      Array(35).fill(0).map((_, i) => 500_000_000 - i * 3_000_000),
    );
    const tinyGainer = makeHistory(
      'tiny',
      'Tiny',
      Array(35).fill(0).map((_, i) => 100_000_000 + i * 300_000),
    );
    const result = computeCuratorFlows([loser, tinyGainer], 30);
    expect(result.correlatedPairs).toHaveLength(0);
  });

  it('ignores flows below the $5M minimum threshold', () => {
    // Both move only $1M — well below the $5M MIN_ABS_FLOW
    const tinyLoser = makeHistory(
      'tl',
      'TinyLoser',
      Array(35).fill(0).map((_, i) => 50_000_000 - i * 30_000),
    );
    const tinyGainer = makeHistory(
      'tg',
      'TinyGainer',
      Array(35).fill(0).map((_, i) => 50_000_000 + i * 30_000),
    );
    const result = computeCuratorFlows([tinyLoser, tinyGainer], 30);
    expect(result.correlatedPairs).toHaveLength(0);
  });

  it('rationale string mentions both curator names and magnitudes', () => {
    const loser = makeHistory(
      'l',
      'Curator-A',
      Array(35).fill(0).map((_, i) => 500_000_000 - i * 3_000_000),
    );
    const gainer = makeHistory(
      'g',
      'Curator-B',
      Array(35).fill(0).map((_, i) => 100_000_000 + i * 3_000_000),
    );
    const result = computeCuratorFlows([loser, gainer], 30);
    const rationale = result.correlatedPairs[0].rationale;
    expect(rationale).toContain('Curator-A');
    expect(rationale).toContain('Curator-B');
    expect(rationale).toContain('Magnitude correlation only');
  });
});
