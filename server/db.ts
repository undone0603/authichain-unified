import { drizzle } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import {
  eq, desc, and, sql, gte, lte, inArray, like
} from "drizzle-orm";

import {
  InsertUser,
  users,
  products,
  authentications,
  certificates,
  qrCodes,
  nftCollections,
  nfts,
  auctions,
  auctionBids,
  subscriptions,
  usageRecords,
  invoices,
  payments,
  leads,
  emailCampaigns,
  emailDrafts,
  supplyChainEvents,
  referrals,
  affiliates,
  affiliateCommissions,
  autopilotConfig,
  autopilotDecisions,
  abTests,
  whiteLabelClients,
  activityLog,
  fraudAlerts,
  customerHealthScores,
  revenueRecords,
  notifications,
  bonuses,
  referralClicks,
  aiModels,
  modelPurchases,
  modelReviews,
  serviceOrders,
  type Product,
  type InsertProduct,
  type InsertNotification,
} from "../drizzle/schema";

import { ENV } from "./_core/env";

export type DrizzleInstance = ReturnType<typeof drizzle>;

let _db: DrizzleInstance | null = null;

// ─────────────────────────────────────────────────────────────
// DB FACTORY
// ─────────────────────────────────────────────────────────────

export function createDb(connectionString: string): DrizzleInstance {
  if (!connectionString) {
    throw new Error("[Database] Missing connection string");
  }
  return drizzle(connectionString);
}

export async function getDb(): Promise<DrizzleInstance> {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[Database] DATABASE_URL is not set");
  }

  try {
    _db = createDb(url);
    return _db;
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    _db = null;
    throw new Error("[Database] Unable to initialize database connection");
  }
}

// ─────────────────────────────────────────────────────────────
// SYNCHRONOUS PROXY
// ─────────────────────────────────────────────────────────────

export const db: DrizzleInstance = new Proxy({} as DrizzleInstance, {
  get(_target, prop: string | symbol) {
    if (!_db) {
      throw new Error(
        "[Database] Database not available. Call `await getDb()` during startup."
      );
    }
    return Reflect.get(_db as object, prop as string);
  },
});

// ─────────────────────────────────────────────────────────────
// UPSERT USER
// ─────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("[Database] User openId is required for upsert");
  }

  const db = await getDb();

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }

  const now = new Date();
  values.lastSignedIn = user.lastSignedIn ?? now;
  updateSet.lastSignedIn = user.lastSignedIn ?? now;

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, user.openId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(users).values(values);
  } else {
    await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
  }
}

// ─────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────

export type {
  Product,
  InsertProduct,
  InsertNotification,
  SQL,
};
// ─────────────────────────────────────────────────────────────
// SYSTEM HELPERS (used by scheduled-jobs, budget-monitor, agents)
// ─────────────────────────────────────────────────────────────

export async function createSystemNotification(userId: number | null, type: string, message: string) {
  const d = await getDb();
  await d.insert(notifications).values({
    userId,
    type,
    message,
    read: false,
  });
}

export async function getAllUsers() {
  const d = await getDb();
  return d.select().from(users);
}

export async function getBudgetStatus() {
  const d = await getDb();
  const rows = await d.select().from(revenueRecords).orderBy(desc(revenueRecords.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function getRecentActivity(limit = 20) {
  const d = await getDb();
  return d.select().from(activityLog).orderBy(desc(activityLog.timestamp)).limit(limit);
}

export async function logActivity(action: string, details?: string) {
  const d = await getDb();
  await d.insert(activityLog).values({ action, details });
}

// ─────────────────────────────────────────────────────────────
// TASK QUEUE (used by agents, missions)
// ─────────────────────────────────────────────────────────────

export async function enqueueTask(missionId: string, title: string, description: string, order: number) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missionTasks).values({ id, missionId, title, description, status: "pending", order });
  return id;
}

export async function getDueTasks(limit = 10) {
  const d = await getDb();
  return d.select().from(missionTasks).where(eq(missionTasks.status, "pending")).orderBy(missionTasks.order).limit(limit);
}

export async function getRunTaskCount() {
  const d = await getDb();
  const rows = await d.select({ count: sql<number>`count(*)` }).from(missionTasks).where(eq(missionTasks.status, "in_progress"));
  return rows[0]?.count ?? 0;
}

export async function markTaskRunning(id: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "in_progress" }).where(eq(missionTasks.id, id));
}

export async function markTaskDone(id: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "completed" }).where(eq(missionTasks.id, id));
}

export async function markTaskFailed(id: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "failed" }).where(eq(missionTasks.id, id));
}

export async function markTaskWaitingHuman(id: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "pending" }).where(eq(missionTasks.id, id));
}

export async function getActiveMissionTypes(): Promise<string[]> {
  const d = await getDb();
  const rows = await d.select({ title: missions.title }).from(missions).where(eq(missions.status, "active"));
  return rows.map(r => r.title);
}

export async function getAdaptivePriors() {
  const d = await getDb();
  const rows = await d.select().from(activityLog).orderBy(desc(activityLog.timestamp)).limit(50);
  return rows;
}

// ─────────────────────────────────────────────────────────────
// SERVICE ORDERS (used by service-orders router)
// ─────────────────────────────────────────────────────────────

export async function createServiceOrder(data: any) {
  const d = await getDb();
  const result = await d.insert(serviceOrders).values(data);
  return result;
}

export async function getAllServiceOrders() {
  const d = await getDb();
  return d.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
}

export async function getServiceOrderById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(serviceOrders).where(eq(serviceOrders.id, id));
  return rows[0] ?? null;
}

export async function getServiceOrdersByUser(userId: number) {
  const d = await getDb();
  return d.select().from(serviceOrders).where(eq(serviceOrders.userId, userId));
}

export async function updateServiceOrderStatus(id: number, status: string) {
  const d = await getDb();
  await d.update(serviceOrders).set({ status: status as any }).where(eq(serviceOrders.id, id));
}

// ─────────────────────────────────────────────────────────────
// PROPOSALS
// ─────────────────────────────────────────────────────────────

export async function createProposal(data: any) {
  const d = await getDb();
  await d.execute(sql`INSERT INTO proposals (data) VALUES (${JSON.stringify(data)})`);
}

// ─────────────────────────────────────────────────────────────
// REPORTING & ANALYTICS (used by jobs/revenue-digest, value-report)
// ─────────────────────────────────────────────────────────────

export async function getWeeklyRevenueDigest() {
  const d = await getDb();
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  return d.select().from(revenueRecords).where(gte(revenueRecords.createdAt, weekAgo));
}

export async function hasActionLogged(action: string, sinceDaysAgo = 1): Promise<boolean> {
  const d = await getDb();
  const since = new Date(Date.now() - sinceDaysAgo * 86400000);
  const rows = await d.select().from(activityLog)
    .where(and(eq(activityLog.action, action), gte(activityLog.timestamp, since)))
    .limit(1);
  return rows.length > 0;
}

export async function getQuarterlyValueReport() {
  const d = await getDb();
  const quarterAgo = new Date(Date.now() - 90 * 86400000);
  return d.select().from(revenueRecords).where(gte(revenueRecords.createdAt, quarterAgo));
}

// ─────────────────────────────────────────────────────────────
// USER SEGMENT QUERIES (used by jobs/retention.ts, onboarding)
// ─────────────────────────────────────────────────────────────

export async function listHighScanUsers(minScans = 10) {
  const d = await getDb();
  return d.select().from(users).orderBy(desc(users.lastSignedIn)).limit(50);
}

export async function listInactiveUsersNoRecentScans(daysSinceLastScan = 30) {
  const d = await getDb();
  const cutoff = new Date(Date.now() - daysSinceLastScan * 86400000);
  return d.select().from(users).where(lte(users.lastSignedIn, cutoff));
}

export async function listUsersForOnboardingStep(step: string) {
  const d = await getDb();
  return d.select().from(users).orderBy(desc(users.createdAt)).limit(100);
}

// ─────────────────────────────────────────────────────────────
// DUNNING & RETENTION (used by jobs/dunning.ts, jobs/retention.ts)
// ─────────────────────────────────────────────────────────────

export async function listPastDueSubscriptions() {
  const d = await getDb();
  return d.select().from(subscriptions).where(eq(subscriptions.status, "past_due"));
}

export async function hasDunningStepLogged(subscriptionId: number, step: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select().from(activityLog)
    .where(and(
      like(activityLog.action, `dunning:${step}:%`),
      like(activityLog.details ?? sql`''`, `%sub:${subscriptionId}%`)
    )).limit(1);
  return rows.length > 0;
}

export async function hasUserActionLogged(userId: number, action: string, sinceDaysAgo: number): Promise<boolean> {
  const d = await getDb();
  const since = new Date(Date.now() - sinceDaysAgo * 86400000);
  const rows = await d.select().from(activityLog)
    .where(and(
      eq(activityLog.action, action),
      gte(activityLog.timestamp, since)
    )).limit(1);
  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────
// MISSIONS CRUD (used by missions/router.ts)
// ─────────────────────────────────────────────────────────────

import { missions, missionTasks } from "../drizzle/schema";
import { randomUUID } from "crypto";
import type { MissionType, MissionStatus } from "./missions/types";

export async function getMissions(statusFilter?: string) {
  const d = await getDb();
  if (statusFilter) {
    return d.select().from(missions).where(eq(missions.status, statusFilter as any));
  }
  return d.select().from(missions).orderBy(desc(missions.createdAt));
}

export async function getMissionById(id: string) {
  const d = await getDb();
  const rows = await d.select().from(missions).where(eq(missions.id, id));
  return rows[0] ?? null;
}

export async function createMission(type: MissionType) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missions).values({
    id,
    title: type,
    description: `Mission: ${type}`,
    status: "pending",
  });
  return id;
}

export async function updateMissionStatus(id: string, status: MissionStatus) {
  const d = await getDb();
  await d.update(missions).set({ status: status.toLowerCase() as any }).where(eq(missions.id, id));
}

export async function getTasksByMission(missionId: string) {
  const d = await getDb();
  return d.select().from(missionTasks).where(eq(missionTasks.missionId, missionId)).orderBy(missionTasks.order);
}

export async function retryTask(id: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "pending" }).where(eq(missionTasks.id, id));
}
