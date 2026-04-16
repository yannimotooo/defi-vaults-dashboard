/**
 * Pure threshold evaluation for the curator alerts cron job.
 *
 * Given a curator's recent TVL history + a set of threshold rules, returns
 * the list of alerts that should fire. No I/O, no side effects — easy to
 * unit-test against fixture data.
 *
 * Cron entry point lives at `src/app/api/cron/threshold-alerts/route.ts`
 * and the threshold config lives at `src/lib/alert-config.ts`.
 */

export type AlertSeverity = 'info' | 'warn' | 'critical';
export type AlertKind =
  | 'tvl-drop-24h'
  | 'tvl-gain-24h'
  | 'tvl-drop-7d'
  | 'no-history';

export interface AlertThresholds {
  /** Fire `tvl-drop-24h` (severity warn) when 24h drop exceeds this %. e.g. 10 → -10%. */
  tvlDrop24hPct: number;
  /** Fire `tvl-drop-24h` as critical when drop exceeds this %. e.g. 25 → -25%. */
  tvlDrop24hCriticalPct: number;
  /** Fire `tvl-gain-24h` (info) when 24h gain exceeds this %. e.g. 20 → +20%. */
  tvlGain24hPct: number;
  /** Fire `tvl-drop-7d` (warn) when 7d drop exceeds this %. e.g. 25 → -25%. */
  tvlDrop7dPct: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  tvlDrop24hPct: 10,
  tvlDrop24hCriticalPct: 25,
  tvlGain24hPct: 20,
  tvlDrop7dPct: 25,
};

export interface CuratorAlert {
  curatorSlug: string;
  curatorName: string;
  kind: AlertKind;
  severity: AlertSeverity;
  /** Short human message — used as the headline in the Slack notification. */
  message: string;
  /** Numeric details for downstream formatting (Slack blocks, dashboards). */
  current?: number;
  previous?: number;
  changePct?: number;
}

/** History points must be sorted ascending by `date` (unix seconds). */
export interface CuratorHistoryPoint {
  date: number;
  tvl: number;
}

/**
 * Find the TVL value at-or-just-before a target unix timestamp.
 * Returns null if no point at-or-before the target exists.
 *
 * Linear scan — chart sizes are small (~360 daily points). Same helper
 * pattern as src/lib/flow-attribution.ts for consistency.
 */
function tvlAtOrBefore(history: CuratorHistoryPoint[], targetTs: number): number | null {
  let result: number | null = null;
  for (const p of history) {
    if (p.date > targetTs) break;
    result = p.tvl;
  }
  return result;
}

/**
 * Evaluate threshold rules against a single curator's history.
 *
 * @param slug — curator slug (used in alert payload + de-dup key)
 * @param name — display name
 * @param history — DeFiLlama daily TVL points, sorted ascending by date
 * @param thresholds — threshold config (defaults to DEFAULT_THRESHOLDS)
 * @param now — unix-second timestamp to evaluate against; defaults to Date.now()
 *              (parameterized so tests can pin a deterministic "current time")
 *
 * Multiple alerts can fire for one curator (e.g. both 24h-drop AND 7d-drop).
 * Critical 24h drop subsumes the warn-level — only one fires per (kind) at the
 * highest matching severity.
 */
export function evaluateCuratorAlerts(
  slug: string,
  name: string,
  history: CuratorHistoryPoint[],
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
  now: number = Math.floor(Date.now() / 1000),
): CuratorAlert[] {
  const alerts: CuratorAlert[] = [];

  if (history.length === 0) {
    alerts.push({
      curatorSlug: slug,
      curatorName: name,
      kind: 'no-history',
      severity: 'info',
      message: `No DeFiLlama history available for ${name} — can't evaluate thresholds.`,
    });
    return alerts;
  }

  const sorted = [...history].sort((a, b) => a.date - b.date);
  const dayInSec = 24 * 3600;
  const current = sorted[sorted.length - 1].tvl;
  const t24 = tvlAtOrBefore(sorted, now - dayInSec);
  const t7 = tvlAtOrBefore(sorted, now - 7 * dayInSec);

  // 24h delta — only meaningful if we have a 24h-ago point AND it's nonzero
  if (t24 != null && t24 > 0) {
    const change24Pct = ((current - t24) / t24) * 100;
    if (change24Pct <= -thresholds.tvlDrop24hCriticalPct) {
      alerts.push({
        curatorSlug: slug,
        curatorName: name,
        kind: 'tvl-drop-24h',
        severity: 'critical',
        message: `${name} TVL crashed ${change24Pct.toFixed(1)}% in 24h ($${(t24 / 1e6).toFixed(1)}M → $${(current / 1e6).toFixed(1)}M)`,
        current,
        previous: t24,
        changePct: change24Pct,
      });
    } else if (change24Pct <= -thresholds.tvlDrop24hPct) {
      alerts.push({
        curatorSlug: slug,
        curatorName: name,
        kind: 'tvl-drop-24h',
        severity: 'warn',
        message: `${name} TVL down ${change24Pct.toFixed(1)}% in 24h ($${(t24 / 1e6).toFixed(1)}M → $${(current / 1e6).toFixed(1)}M)`,
        current,
        previous: t24,
        changePct: change24Pct,
      });
    } else if (change24Pct >= thresholds.tvlGain24hPct) {
      alerts.push({
        curatorSlug: slug,
        curatorName: name,
        kind: 'tvl-gain-24h',
        severity: 'info',
        message: `${name} TVL surged +${change24Pct.toFixed(1)}% in 24h ($${(t24 / 1e6).toFixed(1)}M → $${(current / 1e6).toFixed(1)}M)`,
        current,
        previous: t24,
        changePct: change24Pct,
      });
    }
  }

  // 7d delta — independent of 24h, so a curator can trip both
  if (t7 != null && t7 > 0) {
    const change7Pct = ((current - t7) / t7) * 100;
    if (change7Pct <= -thresholds.tvlDrop7dPct) {
      alerts.push({
        curatorSlug: slug,
        curatorName: name,
        kind: 'tvl-drop-7d',
        severity: 'warn',
        message: `${name} TVL down ${change7Pct.toFixed(1)}% over 7d ($${(t7 / 1e6).toFixed(1)}M → $${(current / 1e6).toFixed(1)}M)`,
        current,
        previous: t7,
        changePct: change7Pct,
      });
    }
  }

  return alerts;
}
