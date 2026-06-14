// Founder ops snapshot — one read-only synthesizer that pulls the heartbeat of
// the autonomous business into a single payload. Used by the AdminDashboard
// "Founder" tab. No writes, no sends, no fund movement.

import { sql, eq, desc, gte, and, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  revenueRecords,
  payouts,
  emailDrafts,
  scheduledJobRuns,
  missions,
  missionTasks,
  activityLog,
  leads,
} from "../../drizzle/schema";

export interface FounderSnapshot {
  generatedAt: string;
  revenue: {
    today: number;
    last7d: number;
    last30d: number;
    txnsToday: number;
    bySourceLast30d: Record<string, number>;
  };
  pipeline: {
    leadsByStatus: Record<string, number>;
    leadsLast24h: number;
  };
  approvals: {
    draftsPending: number;
    draftsByKind: Record<string, number>;
    payoutsPendingApproval: number;
    payoutsPendingTotalUsd: number;
  };
  autonomy: {
    jobs: Array<{
      name: string;
      lastStartedAt: string | null;
      lastStatus: string | null;
      lastDurationMs: number | null;
      successesLast24h: number;
      failuresLast24h: number;
    }>;
    missionsActive: number;
    tasksByStatus: Record<string, number>;
  };
  health: {
    failuresLast24h: number;
    recentFailures: Array<{ at: string; action: string; reason?: string }>;
  };
}

const EMPTY: FounderSnapshot = {
  generatedAt: new Date().toISOString(),
  revenue: { today: 0, last7d: 0, last30d: 0, txnsToday: 0, bySourceLast30d: {} },
  pipeline: { leadsByStatus: {}, leadsLast24h: 0 },
  approvals: { draftsPending: 0, draftsByKind: {}, payoutsPendingApproval: 0, payoutsPendingTotalUsd: 0 },
  autonomy: { jobs: [], missionsActive: 0, tasksByStatus: {} },
  health: { failuresLast24h: 0, recentFailures: [] },
};

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export async function getFounderSnapshot(): Promise<FounderSnapshot> {
  const db = await getDb();
  if (!db) return EMPTY;

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const hour24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // ── Revenue ────────────────────────────────────────────────────────────────
  const [revToday] = await db.select({ total: sql<string>`coalesce(sum(${revenueRecords.amount}),0)`, n: sql<number>`count(*)` })
    .from(revenueRecords).where(gte(revenueRecords.createdAt, startOfToday));
  const [rev7d]   = await db.select({ total: sql<string>`coalesce(sum(${revenueRecords.amount}),0)` })
    .from(revenueRecords).where(gte(revenueRecords.createdAt, day7));
  const [rev30d]  = await db.select({ total: sql<string>`coalesce(sum(${revenueRecords.amount}),0)` })
    .from(revenueRecords).where(gte(revenueRecords.createdAt, day30));
  const bySource = await db.select({ source: revenueRecords.source, total: sql<string>`coalesce(sum(${revenueRecords.amount}),0)` })
    .from(revenueRecords).where(gte(revenueRecords.createdAt, day30)).groupBy(revenueRecords.source);
  const bySourceLast30d: Record<string, number> = {};
  for (const r of bySource) bySourceLast30d[r.source] = num(r.total);

  // ── Pipeline (leads) ───────────────────────────────────────────────────────
  const leadStatusRows = await db.select({ status: leads.status, n: sql<number>`count(*)` })
    .from(leads).groupBy(leads.status);
  const leadsByStatus: Record<string, number> = {};
  for (const r of leadStatusRows) leadsByStatus[r.status ?? "unknown"] = Number(r.n);
  const [leadsRecent] = await db.select({ n: sql<number>`count(*)` })
    .from(leads).where(gte(leads.createdAt, hour24));
  const leadsLast24h = Number(leadsRecent?.n ?? 0);

  // ── Approvals ──────────────────────────────────────────────────────────────
  const draftKindRows = await db.select({ kind: emailDrafts.generatedBy, n: sql<number>`count(*)` })
    .from(emailDrafts).where(eq(emailDrafts.status, "pending")).groupBy(emailDrafts.generatedBy);
  const draftsByKind: Record<string, number> = {};
  let draftsPending = 0;
  for (const r of draftKindRows) {
    const k = r.kind ?? "unknown";
    draftsByKind[k] = Number(r.n);
    draftsPending += Number(r.n);
  }
  const [payoutsPendingRow] = await db.select({
    n: sql<number>`count(*)`,
    total: sql<string>`coalesce(sum(${payouts.amount}),0)`,
  }).from(payouts).where(eq(payouts.status, "pending_approval"));

  // ── Autonomy (jobs heartbeat + missions) ───────────────────────────────────
  const jobRows = await db.select({
    name: scheduledJobRuns.jobName,
    status: scheduledJobRuns.status,
    startedAt: scheduledJobRuns.startedAt,
    duration: scheduledJobRuns.duration,
  }).from(scheduledJobRuns).where(gte(scheduledJobRuns.startedAt, day7)).orderBy(desc(scheduledJobRuns.startedAt));

  type JobAcc = { lastStartedAt: Date | null; lastStatus: string | null; lastDuration: number | null; ok24: number; fail24: number };
  const jobAcc = new Map<string, JobAcc>();
  for (const r of jobRows) {
    const acc = jobAcc.get(r.name) ?? { lastStartedAt: null, lastStatus: null, lastDuration: null, ok24: 0, fail24: 0 };
    if (!acc.lastStartedAt) {
      acc.lastStartedAt = r.startedAt;
      acc.lastStatus = r.status;
      acc.lastDuration = r.duration ?? null;
    }
    if (r.startedAt >= hour24) {
      if (r.status === "success") acc.ok24++;
      else if (r.status === "failure" || r.status === "error") acc.fail24++;
    }
    jobAcc.set(r.name, acc);
  }
  const jobs = Array.from(jobAcc.entries()).map(([name, a]) => ({
    name,
    lastStartedAt: a.lastStartedAt?.toISOString() ?? null,
    lastStatus: a.lastStatus,
    lastDurationMs: a.lastDuration,
    successesLast24h: a.ok24,
    failuresLast24h: a.fail24,
  })).sort((x, y) => x.name.localeCompare(y.name));

  const [missionsActiveRow] = await db.select({ n: sql<number>`count(*)` })
    .from(missions).where(eq(missions.status, "active"));
  const taskRows = await db.select({ status: missionTasks.status, n: sql<number>`count(*)` })
    .from(missionTasks).groupBy(missionTasks.status);
  const tasksByStatus: Record<string, number> = {};
  for (const r of taskRows) tasksByStatus[r.status ?? "unknown"] = Number(r.n);

  // ── Health (failures in activity log + recent items) ───────────────────────
  const [failuresRow] = await db.select({ n: sql<number>`count(*)` })
    .from(activityLog).where(and(
      gte(activityLog.createdAt, hour24),
      sql`${activityLog.action} like '%fail%' or ${activityLog.action} like '%error%'`,
    ));
  const recentFailRows = await db.select({
    at: activityLog.createdAt,
    action: activityLog.action,
    details: activityLog.details,
  }).from(activityLog).where(and(
    gte(activityLog.createdAt, hour24),
    sql`${activityLog.action} like '%fail%' or ${activityLog.action} like '%error%'`,
  )).orderBy(desc(activityLog.createdAt)).limit(10);
  const recentFailures = recentFailRows.map(r => {
    const d = (r.details ?? null) as { reason?: string; error?: string; failureReason?: string } | null;
    return {
      at: r.at.toISOString(),
      action: r.action,
      reason: d?.reason ?? d?.error ?? d?.failureReason,
    };
  });

  return {
    generatedAt: now.toISOString(),
    revenue: {
      today: num(revToday?.total),
      last7d: num(rev7d?.total),
      last30d: num(rev30d?.total),
      txnsToday: Number(revToday?.n ?? 0),
      bySourceLast30d,
    },
    pipeline: { leadsByStatus, leadsLast24h },
    approvals: {
      draftsPending,
      draftsByKind,
      payoutsPendingApproval: Number(payoutsPendingRow?.n ?? 0),
      payoutsPendingTotalUsd: num(payoutsPendingRow?.total),
    },
    autonomy: {
      jobs,
      missionsActive: Number(missionsActiveRow?.n ?? 0),
      tasksByStatus,
    },
    health: {
      failuresLast24h: Number(failuresRow?.n ?? 0),
      recentFailures,
    },
  };
}
