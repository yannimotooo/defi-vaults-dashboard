/**
 * /api/cron/threshold-alerts
 *
 * Daily cron that evaluates threshold rules against the curators in
 * MONITORED_CURATORS and posts any triggered alerts to Slack.
 *
 * Schedule lives in `vercel.json` (`{ "path": "/api/cron/threshold-alerts",
 * "schedule": "0 13 * * *" }` — daily at 13:00 UTC = 9am ET).
 *
 * **Auth:** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` on every
 * scheduled invocation. We require it both in dev (for safety) and prod (so
 * the route can't be triggered externally to spam Slack).
 *
 * **Failure mode:** if SLACK_WEBHOOK_URL is unset we still run the evaluation
 * and return the alert list in JSON — useful for testing and manual smoke
 * checks. The cron itself returns 200 even if the webhook fails so Vercel
 * doesn't infinitely retry on a bad webhook URL; webhook failures are logged.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getProtocolHistoricalTvl } from '@/lib/defillama';
import { CURATOR_SLUG_TO_NAME } from '@/lib/curator-names';
import {
  evaluateCuratorAlerts,
  type CuratorAlert,
} from '@/lib/alert-evaluator';
import {
  MONITORED_CURATORS,
  buildSlackPayload,
  postToSlack,
} from '@/lib/alert-config';

// Don't cache — every cron tick should re-evaluate against fresh data.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROD_DASHBOARD_URL = 'https://defi-vault-dashboard.vercel.app';

export async function GET(request: NextRequest) {
  // ---- Auth ----
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. Reject anything
  // else. CRON_SECRET is auto-managed by Vercel when you enable cron.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[cron/threshold-alerts] CRON_SECRET not configured — refusing to run');
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- Evaluate ----
  // Fetch each monitored curator's history in parallel and run the evaluator.
  const results = await Promise.all(
    MONITORED_CURATORS.map(async (slug): Promise<CuratorAlert[]> => {
      try {
        const history = await getProtocolHistoricalTvl(slug);
        const name = CURATOR_SLUG_TO_NAME[slug] || slug;
        return evaluateCuratorAlerts(slug, name, history);
      } catch (err) {
        console.warn(
          `[cron/threshold-alerts] failed to fetch history for ${slug}:`,
          err instanceof Error ? err.message : err,
        );
        return [];
      }
    }),
  );

  // Drop "no-history" entries from the alert list — they're noise for the
  // operator (means we couldn't fetch, not that something's wrong with
  // the curator). Still surfaced in the route response for debugging.
  const allAlerts = results.flat();
  const actionableAlerts = allAlerts.filter(a => a.kind !== 'no-history');

  // ---- Notify ----
  let slackResult: { ok: boolean; status: number } | { skipped: string } = {
    skipped: 'no actionable alerts',
  };
  if (actionableAlerts.length > 0) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      slackResult = { skipped: 'SLACK_WEBHOOK_URL not configured' };
      console.warn(
        '[cron/threshold-alerts] would post to Slack but SLACK_WEBHOOK_URL is unset:',
        actionableAlerts.map(a => a.message),
      );
    } else {
      const payload = buildSlackPayload(actionableAlerts, PROD_DASHBOARD_URL);
      if (payload) slackResult = await postToSlack(webhookUrl, payload);
    }
  }

  // Always return 200 with a structured summary — Vercel logs this for the
  // cron history view, and we don't want bad webhooks to mark the run as
  // "failed" and cascade into retry/alert noise on the platform side.
  return NextResponse.json({
    ok: true,
    evaluatedCurators: MONITORED_CURATORS.length,
    actionableAlerts: actionableAlerts.length,
    noHistoryCount: allAlerts.length - actionableAlerts.length,
    slack: slackResult,
    alerts: actionableAlerts,
  });
}
