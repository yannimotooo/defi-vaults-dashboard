/**
 * Configuration for the threshold-alerts cron.
 *
 * **What gets monitored:** the curators in MONITORED_CURATORS below.
 * Independent from the per-browser localStorage watchlist (which only the
 * client knows about) — this is the server-side equivalent that drives
 * the daily Slack notifications.
 *
 * **To add/remove a monitored curator:** edit MONITORED_CURATORS. Slugs
 * must match those in src/lib/curator-names.ts (CURATOR_NAME_VARIANTS keys)
 * so the cron's DeFiLlama lookup succeeds.
 *
 * **To change thresholds:** edit src/lib/alert-evaluator.ts DEFAULT_THRESHOLDS.
 */

import type { CuratorAlert } from './alert-evaluator';

/**
 * Curators we care about for daily threshold monitoring. Seeded with the
 * top tracked-by-Bitwise list. Edit freely.
 */
export const MONITORED_CURATORS: ReadonlyArray<string> = [
  'veda',
  'mellow-core',
  'steakhouse-financial',
  'gauntlet',
  'sentora',
  'mev-capital',
  're7-labs',
  'grove-finance',
  'spark-liquidity-layer',
  'concrete',
];

/**
 * Format a list of triggered alerts into a Slack `chat.postMessage` body.
 * Uses Slack Block Kit so each alert renders as its own visually distinct
 * block — easier to scan than a wall of text.
 *
 * Returns null when there are no alerts (caller should skip the post —
 * "no alerts" is the silent default; we don't spam a daily "all clear").
 */
export function buildSlackPayload(alerts: CuratorAlert[], dashboardUrl: string): object | null {
  if (alerts.length === 0) return null;

  const severityEmoji: Record<CuratorAlert['severity'], string> = {
    critical: ':rotating_light:',
    warn: ':warning:',
    info: ':bell:',
  };

  // Sort by severity (critical first), then by absolute change magnitude
  const sorted = [...alerts].sort((a, b) => {
    const sev = { critical: 0, warn: 1, info: 2 };
    if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
    return Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0);
  });

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Curator threshold alerts (${alerts.length})`,
      },
    },
  ];

  for (const a of sorted) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${severityEmoji[a.severity]} *${a.message}*`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<${dashboardUrl}|Open dashboard> · <${dashboardUrl}/methodology|Methodology>`,
      },
    ],
  });

  return { blocks };
}

/**
 * POST a Slack payload to the configured webhook URL. Returns the HTTP
 * status code; non-2xx is logged but doesn't throw — alerting must never
 * crash the cron itself (otherwise we lose visibility on a bad webhook).
 */
export async function postToSlack(
  webhookUrl: string,
  payload: object,
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(
        `[alerts] Slack webhook returned ${res.status}: ${await res.text().catch(() => '?')}`,
      );
    }
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.warn(
      '[alerts] Slack webhook fetch failed:',
      err instanceof Error ? err.message : err,
    );
    return { ok: false, status: 0 };
  }
}
