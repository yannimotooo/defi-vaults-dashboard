import { describe, it, expect } from 'vitest';
import {
  evaluateCuratorAlerts,
  DEFAULT_THRESHOLDS,
  type CuratorHistoryPoint,
} from '@/lib/alert-evaluator';

/**
 * Pin "now" to a fixed timestamp so the day-bucket math is deterministic.
 * 2026-04-15 00:00 UTC.
 */
const NOW = 1776470400;
const DAY = 86400;

/**
 * Build a daily history ending at `now`. tvls[0] is `tvls.length - 1` days
 * ago; tvls[N-1] is "today". Mirrors the helper in flow-attribution tests.
 */
function makeHistory(tvls: number[]): CuratorHistoryPoint[] {
  return tvls.map((tvl, i) => ({ date: NOW - (tvls.length - 1 - i) * DAY, tvl }));
}

describe('evaluateCuratorAlerts', () => {
  it('returns no-history when input is empty', () => {
    const alerts = evaluateCuratorAlerts('test', 'Test', [], DEFAULT_THRESHOLDS, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('no-history');
    expect(alerts[0].severity).toBe('info');
  });

  it('fires nothing for stable curator (within all thresholds)', () => {
    // Flat-ish line: tiny noise day-to-day, never crosses any threshold
    const tvls = [1000, 1010, 1005, 1008, 1012, 1009, 1015, 1011];
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    expect(alerts).toEqual([]);
  });

  it('fires warn-level tvl-drop-24h when 24h drop is between 10% and 25%', () => {
    // Yesterday $1000, today $850 = -15% (warn but not critical)
    const tvls = [...Array(8).fill(1000), 850];
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    const drop = alerts.find(a => a.kind === 'tvl-drop-24h');
    expect(drop?.severity).toBe('warn');
    expect(drop?.changePct).toBeCloseTo(-15, 1);
    expect(drop?.message).toContain('15.0%');
  });

  it('fires critical when 24h drop exceeds 25%', () => {
    // Yesterday $1000, today $700 = -30% (critical)
    const tvls = [...Array(8).fill(1000), 700];
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    const drop = alerts.find(a => a.kind === 'tvl-drop-24h');
    expect(drop?.severity).toBe('critical');
    expect(drop?.changePct).toBeCloseTo(-30, 1);
    expect(drop?.message).toContain('crashed');
  });

  it('fires only one tvl-drop-24h alert (not both warn and critical)', () => {
    const tvls = [...Array(8).fill(1000), 700];
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    const drops = alerts.filter(a => a.kind === 'tvl-drop-24h');
    expect(drops).toHaveLength(1);
  });

  it('fires info-level tvl-gain-24h when 24h gain exceeds 20%', () => {
    // Yesterday $1000, today $1300 = +30%
    const tvls = [...Array(8).fill(1000), 1300];
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    const gain = alerts.find(a => a.kind === 'tvl-gain-24h');
    expect(gain?.severity).toBe('info');
    expect(gain?.changePct).toBeCloseTo(30, 1);
    expect(gain?.message).toContain('surged');
  });

  it('does not fire tvl-gain-24h when gain is below threshold', () => {
    // Yesterday $1000, today $1100 = +10% (below the 20% gain threshold)
    const tvls = [...Array(8).fill(1000), 1100];
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    expect(alerts.filter(a => a.kind === 'tvl-gain-24h')).toEqual([]);
  });

  it('fires tvl-drop-7d when 7d drop exceeds 25%', () => {
    // 7 days ago: $1000, today: $700 = -30% over 7d (intermediate days don't matter)
    const tvls = [1000, 950, 900, 870, 830, 800, 770, 700];
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    const sevenDay = alerts.find(a => a.kind === 'tvl-drop-7d');
    expect(sevenDay?.severity).toBe('warn');
    expect(sevenDay?.changePct).toBeCloseTo(-30, 1);
  });

  it('can fire BOTH tvl-drop-24h AND tvl-drop-7d for one curator', () => {
    // Long slow decline that ALSO has a sharp final-day drop
    const tvls = [1000, 980, 960, 940, 920, 900, 880, 720]; // 7d: -28%, 24h: -18.2%
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    const kinds = alerts.map(a => a.kind).sort();
    expect(kinds).toEqual(['tvl-drop-24h', 'tvl-drop-7d']);
  });

  it('skips 24h evaluation when no 24h-ago point exists', () => {
    // Only 1 data point (today) — no 24h-ago to compare against
    const alerts = evaluateCuratorAlerts(
      'a',
      'A',
      [{ date: NOW, tvl: 1000 }],
      DEFAULT_THRESHOLDS,
      NOW,
    );
    expect(alerts.filter(a => a.kind === 'tvl-drop-24h')).toEqual([]);
    expect(alerts.filter(a => a.kind === 'tvl-gain-24h')).toEqual([]);
  });

  it('skips 7d evaluation when 7d-ago point is missing', () => {
    // Only 3 days of history — 7d window not covered
    const tvls = [1000, 800, 600]; // -40% over 2 days but no 7d baseline
    const alerts = evaluateCuratorAlerts('a', 'A', makeHistory(tvls), DEFAULT_THRESHOLDS, NOW);
    expect(alerts.filter(a => a.kind === 'tvl-drop-7d')).toEqual([]);
  });

  it('handles unsorted input by sorting internally', () => {
    // Same data as the warn-drop test but with shuffled order
    const sorted = makeHistory([...Array(8).fill(1000), 850]);
    const shuffled = [sorted[5], sorted[0], sorted[8], sorted[3], sorted[7], sorted[1], sorted[2], sorted[6], sorted[4]];
    const alerts = evaluateCuratorAlerts('a', 'A', shuffled, DEFAULT_THRESHOLDS, NOW);
    const drop = alerts.find(a => a.kind === 'tvl-drop-24h');
    expect(drop?.severity).toBe('warn');
    expect(drop?.changePct).toBeCloseTo(-15, 1);
  });

  it('respects custom thresholds', () => {
    // Same -15% as the warn case but with the threshold relaxed to 20% — should NOT fire
    const tvls = [...Array(8).fill(1000), 850];
    const alerts = evaluateCuratorAlerts(
      'a',
      'A',
      makeHistory(tvls),
      { ...DEFAULT_THRESHOLDS, tvlDrop24hPct: 20 },
      NOW,
    );
    expect(alerts.filter(a => a.kind === 'tvl-drop-24h')).toEqual([]);
  });

  it('ignores 24h baseline of 0 (avoids divide-by-zero)', () => {
    const history: CuratorHistoryPoint[] = [
      { date: NOW - DAY, tvl: 0 },
      { date: NOW, tvl: 1000 },
    ];
    const alerts = evaluateCuratorAlerts('a', 'A', history, DEFAULT_THRESHOLDS, NOW);
    // Should not produce any percentage-based alert from a 0 baseline
    expect(alerts.filter(a => a.kind === 'tvl-gain-24h')).toEqual([]);
    expect(alerts.filter(a => a.kind === 'tvl-drop-24h')).toEqual([]);
  });
});
