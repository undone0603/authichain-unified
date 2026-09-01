/**
 * Cloudflare Workers Cron Trigger dispatcher.
 *
 * Workers fires `scheduled(event, env, ctx)` with `event.cron` equal to the
 * matched schedule string. This module maps every cron expression to the
 * corresponding job registered in `server/scheduled-jobs.ts` and runs it.
 *
 * The cron triggers themselves are defined (but commented out until Vercel is
 * decommissioned) in `worker-app/wrangler.toml`. Enable GROUP A at cutover;
 * hold GROUP B until each job has an explicit business sign-off.
 */

import { runJobManually } from "../server/scheduled-jobs";

/**
 * Maps cron schedule strings to job names as defined in
 * `server/scheduled-jobs.ts`. Every schedule in wrangler.toml must appear
 * here so the dispatcher can route the event to the right job.
 */
const CRON_TO_JOB: Record<string, string> = {
  // GROUP A — cleared to enable at Vercel cutover
  "0 3 * * *": "database-cleanup",
  "0 5 * * *": "customer-health-score",
  "0 6 * * *": "subscription-health-check",
  "0 7 * * *": "certificate-expiry-check",
  "0 8 * * *": "dunning-escalation",
  "0 8 * * 1": "weekly-analytics-digest",
  "0 11 * * *": "live-systems-check",
  "0 12 * * *": "token-metrics",
  "0 13 * * *": "ecosystem-health",
  "0 */6 * * *": "fraud-detection-sweep",

  // GROUP B — held; do NOT enable without explicit per-job sign-off
  "0 9 * * *": "lead-nurturing",
  "0 */4 * * *": "hubspot-crm-sync",
  "0 4 * * *": "staking-rewards",
  "0 9 1 * *": "founder-payout",
  "0 * * * *": "strainchain-metrc-sync",
  "*/2 * * * *": "autonomous-pipeline-tick",
  "*/10 * * * *": "vertical-cloner",
  "*/30 * * * *": "newsjacking-monitor",
};

export async function scheduled(
  event: ScheduledEvent,
  _env: unknown,
  ctx: ExecutionContext
): Promise<void> {
  const jobName = CRON_TO_JOB[event.cron];
  if (!jobName) {
    console.error(`[scheduled] No job mapped for cron "${event.cron}"`);
    return;
  }

  console.log(`[scheduled] Firing job "${jobName}" for cron "${event.cron}"`);

  // waitUntil ensures the job completes even if the response has been sent.
  ctx.waitUntil(
    runJobManually(jobName).then(success => {
      if (!success) {
        console.error(
          `[scheduled] Job "${jobName}" reported failure or was not found`
        );
      }
    })
  );
}
