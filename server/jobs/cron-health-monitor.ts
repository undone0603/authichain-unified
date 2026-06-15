// Cron health monitor — watches scheduled_job_runs for jobs that just started
// failing and pings the owner via notifyOwner. Idempotent across runs (won't
// re-alert on the same active incident).
//
// "Incident" semantics:
//   - A job has N consecutive failures with no intervening success in the
//     observation window → ALERT (once per incident).
//   - A successful run after a failure → CLEAR (once per recovery).
//   - Dedup by writing alert state to activity_log, keyed on job name.

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activityLog, scheduledJobRuns } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

const FAIL_THRESHOLD = 3;          // N consecutive failures triggers ALERT
const OBSERVATION_WINDOW_HOURS = 6; // only look at recent runs

interface MonitorResult {
  alerts: string[];
  recoveries: string[];
  jobsChecked: number;
}

/** True when the most recent activity_log row for a given job is the given action. */
async function lastAlertActionFor(jobName: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ action: activityLog.action })
    .from(activityLog)
    .where(and(
      sql`${activityLog.action} in ('cron_alert_open', 'cron_alert_clear')`,
      sql`${activityLog.details}->>'jobName' = ${jobName}`,
    ))
    .orderBy(desc(activityLog.createdAt))
    .limit(1);
  return rows[0]?.action ?? null;
}

async function recordAlertState(jobName: string, action: "cron_alert_open" | "cron_alert_clear", details: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values({
    action,
    details: { jobName, ...details },
  });
}

export async function runCronHealthMonitor(): Promise<MonitorResult> {
  const db = await getDb();
  if (!db) return { alerts: [], recoveries: [], jobsChecked: 0 };

  const windowStart = new Date(Date.now() - OBSERVATION_WINDOW_HOURS * 60 * 60 * 1000);

  const rows = await db
    .select({
      name: scheduledJobRuns.jobName,
      status: scheduledJobRuns.status,
      startedAt: scheduledJobRuns.startedAt,
      error: scheduledJobRuns.error,
    })
    .from(scheduledJobRuns)
    .where(gte(scheduledJobRuns.startedAt, windowStart))
    .orderBy(desc(scheduledJobRuns.startedAt));

  // Group by job, in chronological order from newest → walk to compute streak.
  type Streak = { recentFailures: number; lastStatus: string; lastError: string | null; lastRunAt: Date };
  const byJob = new Map<string, Streak>();
  for (const r of rows) {
    if (!byJob.has(r.name)) {
      byJob.set(r.name, { recentFailures: 0, lastStatus: r.status, lastError: r.error, lastRunAt: r.startedAt });
    }
    const s = byJob.get(r.name)!;
    // Walk from newest backward; stop streak at first non-failure.
    if (s.recentFailures >= 0 && (r.status === "failure" || r.status === "error")) {
      s.recentFailures++;
    } else if (s.recentFailures >= 0 && r.status === "success") {
      // freeze streak at first success encountered while walking back
      s.recentFailures = -1 - s.recentFailures; // negative marker = "streak ended by success"
    }
  }

  const alerts: string[] = [];
  const recoveries: string[] = [];

  for (const [jobName, s] of byJob.entries()) {
    const lastState = await lastAlertActionFor(jobName);
    const streakLen = s.recentFailures > 0 ? s.recentFailures : 0;

    // ALERT path: streak hit threshold and we haven't already opened one
    if (streakLen >= FAIL_THRESHOLD && lastState !== "cron_alert_open") {
      const ok = await notifyOwner({
        title: `Cron alert: ${jobName} failing (${streakLen}× in a row)`,
        content: `Job "${jobName}" has ${streakLen} consecutive failure(s) in the last ${OBSERVATION_WINDOW_HOURS}h.\n` +
          `Last run: ${s.lastRunAt.toISOString()}\n` +
          (s.lastError ? `Last error: ${String(s.lastError).slice(0, 600)}\n` : "") +
          `Check the Founder dashboard → Cron heartbeat.`,
      }).catch(() => false);
      await recordAlertState(jobName, "cron_alert_open", {
        streakLen,
        lastRunAt: s.lastRunAt.toISOString(),
        lastError: s.lastError ? String(s.lastError).slice(0, 500) : null,
        notified: ok,
      });
      alerts.push(jobName);
      continue;
    }

    // CLEAR path: most recent run was successful AND we previously opened an alert
    if (s.lastStatus === "success" && lastState === "cron_alert_open") {
      const ok = await notifyOwner({
        title: `Cron recovered: ${jobName}`,
        content: `Job "${jobName}" succeeded after a prior alert. Last run: ${s.lastRunAt.toISOString()}.`,
      }).catch(() => false);
      await recordAlertState(jobName, "cron_alert_clear", {
        lastRunAt: s.lastRunAt.toISOString(),
        notified: ok,
      });
      recoveries.push(jobName);
    }
  }

  return { alerts, recoveries, jobsChecked: byJob.size };
}
