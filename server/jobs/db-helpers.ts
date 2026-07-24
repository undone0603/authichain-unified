// server/jobs/db-helpers.ts
//
// Db-parameterized replacements for the handful of server/db.ts helper
// functions used by server/jobs/** and server/scheduled-jobs.ts. server/db.ts's
// helpers all close over the module-scope getDb() singleton (Node-only,
// process.env.DATABASE_URL), which is incompatible with Cloudflare Workers'
// per-request env bindings.
//
// These do the same queries but take an explicit `db` instance (threaded from
// the caller — ultimately ctx.db in a tRPC procedure, a per-request Workers
// db, or a documented getDb() bridge at a standalone entry point such as a
// CLI script or the node-cron scheduler) instead of reaching for the
// singleton themselves.
import { randomUUID } from 'crypto';
import { eq, desc, and, or, gte, lte, isNull, like, sql } from 'drizzle-orm';
import {
  users,
  products,
  authentications,
  leads,
  nfts,
  activityLog,
  missionTasks,
  missions,
  notifications,
  subscriptions,
  revenueRecords,
  budgetConfig,
  whiteLabelClients,
  bayesianPriors,
  type InsertNotification,
} from '../../drizzle/schema';
import { SEGMENT_PRIORS } from '../_core/bayesian';
import type { MissionType } from '../missions/types';
import type { getHyperdriveDb } from '../db';

export type Db = ReturnType<typeof getHyperdriveDb>;

// ─── Activity Log ─────────────────────────────────────────────────────────

export async function logActivity(
  db: Db,
  actionOrData: string | { userId?: number | null; action: string; entityType?: string; entityId?: number; details?: any },
  details?: string,
): Promise<void> {
  if (typeof actionOrData === 'string') {
    await db.insert(activityLog).values({ action: actionOrData, details: details ? { text: details } : undefined });
  } else {
    await db.insert(activityLog).values({
      userId: actionOrData.userId ?? undefined,
      action: actionOrData.action,
      entityType: actionOrData.entityType,
      entityId: actionOrData.entityId,
      details: actionOrData.details,
    });
  }
}

export async function getRecentActivity(db: Db, limit = 20) {
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function hasActionLogged(db: Db, action: string, sinceDaysAgo = 1): Promise<boolean> {
  const since = new Date(Date.now() - sinceDaysAgo * 86400000);
  const rows = await db.select().from(activityLog)
    .where(and(eq(activityLog.action, action), gte(activityLog.createdAt, since)))
    .limit(1);
  return rows.length > 0;
}

export async function hasDunningStepLogged(db: Db, subscriptionId: number, step: string): Promise<boolean> {
  const rows = await db.select().from(activityLog)
    .where(and(
      like(activityLog.action, `dunning:${step}:%`),
      sql`${activityLog.details}->>'text' LIKE ${'%sub:' + subscriptionId + '%'}`
    )).limit(1);
  return rows.length > 0;
}

export async function hasUserActionLogged(db: Db, userId: number, action: string, sinceDaysAgo: number = 365): Promise<boolean> {
  const since = new Date(Date.now() - sinceDaysAgo * 86400000);
  const rows = await db.select().from(activityLog)
    .where(and(
      eq(activityLog.userId, userId),
      eq(activityLog.action, action),
      gte(activityLog.createdAt, since)
    )).limit(1);
  return rows.length > 0;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getAllUsers(db: Db) {
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(1000);
}

export async function getUserById(db: Db, id: number) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function listHighScanUsers(db: Db, _minScans = 10) {
  return db.select().from(users).orderBy(desc(users.lastSignedIn)).limit(50);
}

export async function listInactiveUsersNoRecentScans(db: Db, daysSinceLastScan = 30) {
  const cutoff = new Date(Date.now() - daysSinceLastScan * 86400000);
  return db.select().from(users).where(lte(users.lastSignedIn, cutoff)).limit(500);
}

export async function listUsersForOnboardingStep(db: Db, _step: string | number) {
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function createNotification(
  db: Db,
  data: Omit<InsertNotification, 'id' | 'createdAt'>,
): Promise<{ id: number }> {
  const [result] = await db.insert(notifications).values(data).returning();
  return { id: result.id };
}

export async function createSystemNotification(
  db: Db,
  userId: number,
  title: string,
  message: string,
  type: InsertNotification['type'],
  actionUrl?: string,
): Promise<{ id: number }> {
  return createNotification(db, { userId, type: type as any, title, message, isRead: 0, actionUrl });
}

// ─── Budget & Task Queue ────────────────────────────────────────────────────

export async function getBudgetStatus(db: Db, _asOf?: Date) {
  const rows = await db.select().from(budgetConfig).limit(1);
  const row = rows[0] ?? { monthlyLimit: '1000.00', spent: '0.00', currency: 'USD' };
  const limit = parseFloat(row.monthlyLimit);
  const spent = parseFloat(row.spent ?? '0');
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const now = _asOf ?? new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayKey = now.toISOString().slice(0, 10);
  return {
    ...row,
    llm:        { pct, spent, limit },
    ads:        { pct: 0, spent: 0, limit: 0 },
    enrichment: { pct: 0, spent: 0, limit: 0 },
    period:     { month: monthKey, day: dayKey },
  };
}

export async function getDueTasks(db: Db, limit = 10) {
  const now = new Date();
  return db.select().from(missionTasks)
    .where(and(
      eq(missionTasks.status, 'pending'),
      or(isNull(missionTasks.scheduledAt), lte(missionTasks.scheduledAt, now)),
    ))
    .orderBy(missionTasks.order)
    .limit(limit);
}

export async function getRunTaskCount(db: Db) {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(missionTasks).where(eq(missionTasks.status, 'in_progress'));
  return rows[0]?.count ?? 0;
}

export async function markTaskRunning(db: Db, id: string): Promise<boolean> {
  const rows = await db.update(missionTasks)
    .set({ status: 'in_progress', updatedAt: new Date() })
    .where(and(eq(missionTasks.id, id), eq(missionTasks.status, 'pending')))
    .returning({ id: missionTasks.id });
  return rows.length > 0;
}

export async function markTaskDone(db: Db, id: string, result?: any) {
  // WHERE status='in_progress' preserves 'waiting_human' if an agent set it during execution
  await db.update(missionTasks).set({ status: 'completed', result, updatedAt: new Date() }).where(and(eq(missionTasks.id, id), eq(missionTasks.status, 'in_progress')));
}

export async function markTaskFailed(db: Db, id: string, error: string) {
  await db.update(missionTasks).set({ status: 'failed', error, updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function getAdaptivePriors(db: Db): Promise<Record<string, { alpha: number; beta: number }>> {
  try {
    if (!db) return { ...SEGMENT_PRIORS };
    const rows = await db.select({
      segment: bayesianPriors.segment,
      priorAlpha: bayesianPriors.priorAlpha,
      priorBeta: bayesianPriors.priorBeta,
    }).from(bayesianPriors).limit(200);
    if (!rows.length) return { ...SEGMENT_PRIORS };
    const map: Record<string, { alpha: number; beta: number }> = { ...SEGMENT_PRIORS };
    for (const row of rows) {
      map[row.segment] = {
        alpha: parseFloat(row.priorAlpha ?? '2'),
        beta: parseFloat(row.priorBeta ?? '18'),
      };
    }
    return map;
  } catch {
    return { ...SEGMENT_PRIORS };
  }
}

// ─── Missions ───────────────────────────────────────────────────────────────

export async function createMission(db: Db, type: MissionType) {
  const id = randomUUID();
  await db.insert(missions).values({
    id,
    type,
    title: type,
    description: `Mission: ${type}`,
    status: 'pending',
  });
  return id;
}

export async function getActiveMissionTypes(db: Db): Promise<string[]> {
  const rows = await db.select({ title: missions.title }).from(missions).where(eq(missions.status, 'active'));
  return rows.map(r => r.title);
}

// ─── Subscriptions / Dunning ────────────────────────────────────────────────

export async function listPastDueSubscriptions(db: Db) {
  return db.select().from(subscriptions).where(eq(subscriptions.status, 'past_due')).limit(1000);
}

// ─── Reporting & Analytics ──────────────────────────────────────────────────

export async function getRevenueAnalytics(db: Db, startDate?: Date, endDate?: Date) {
  let query = db.select().from(revenueRecords);
  if (startDate && endDate) {
    query = query.where(and(gte(revenueRecords.createdAt, startDate), lte(revenueRecords.createdAt, endDate))) as typeof query;
  }
  return await query.orderBy(desc(revenueRecords.createdAt)).limit(2000);
}

export async function getWeeklyRevenueDigest(db: Db) {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const rows = await db.select().from(revenueRecords).where(gte(revenueRecords.createdAt, weekAgo));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return {
    leads: rows.length,
    mqlToSql: 0,
    demosBooked: 0,
    trialToPaid: 0,
    churn: 0,
    mrr: total.toFixed(2),
    arpa: rows.length ? (total / rows.length).toFixed(2) : '0.00',
    rows,
  };
}

export async function getQuarterlyValueReport(db: Db) {
  const quarterAgo = new Date(Date.now() - 90 * 86400000);
  const now = new Date();
  const q = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const rows = await db.select().from(revenueRecords).where(gte(revenueRecords.createdAt, quarterAgo));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return {
    period: q,
    roiSummary: `Q${Math.ceil((now.getMonth() + 1) / 3)} revenue: $${total.toFixed(2)} across ${rows.length} records.`,
    totalRevenue: total,
    rows,
  };
}

export async function getAdminDashboardMetrics(db: Db) {
  const [[userCount], [prodCount], [authCount], [leadCount], [nftCount], [revenue]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(products),
    db.select({ count: sql<number>`count(*)` }).from(authentications),
    db.select({ count: sql<number>`count(*)` }).from(leads),
    db.select({ count: sql<number>`count(*)` }).from(nfts),
    db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(revenueRecords),
  ]);
  return {
    totalUsers: userCount?.count || 0,
    totalProducts: prodCount?.count || 0,
    totalAuthentications: authCount?.count || 0,
    totalRevenue: parseFloat(revenue?.total || '0'),
    totalLeads: leadCount?.count || 0,
    totalNfts: nftCount?.count || 0,
  };
}

// ─── White-Label Clients ────────────────────────────────────────────────────

export async function getWhiteLabelClients(db: Db) {
  return db.select().from(whiteLabelClients).orderBy(desc(whiteLabelClients.createdAt)).limit(200);
}
