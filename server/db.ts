import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, or, gte, lte, isNull, like, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  users,
  products,
  authentications,
  certificates,
  qrCodes,
  qrScanEvents,
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
  webhookEvents,
  missions,
  missionTasks,
  stakingPositions,
  budgetConfig,
<<<<<<< HEAD
  webhookEvents,
  bayesianPriors,
=======
>>>>>>> origin/add-agentz-editable
  proposals,
  type Product,
  type InsertProduct,
  type InsertNotification,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { SEGMENT_PRIORS } from './_core/bayesian';
import { bayesianPriors } from '../drizzle/schema';

type DrizzleInstance = ReturnType<typeof drizzle>;
let _db: DrizzleInstance | null = null;

// ─────────────────────────────────────────────────────────────
// DB FACTORY
// ─────────────────────────────────────────────────────────────

export function createDb(connectionString: string): DrizzleInstance {
  if (!connectionString) {
    throw new Error("[Database] Missing connection string");
  }
  // Cap pool size at 3 for serverless environments (Vercel/Railway). Each
  // function instance opens its own pool; Supabase session-pooler mode caps
  // total connections, so a default of 10 per instance causes exhaustion.
  const client = postgres(connectionString, { max: 3, idle_timeout: 20 });
  return drizzle(client);
}

export async function getDb(): Promise<DrizzleInstance> {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    // Cap pool size at 3 for serverless environments (see createDb above).
    const client = postgres(process.env.DATABASE_URL, { max: 3, idle_timeout: 20 });
    _db = drizzle(client);
    return _db;
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    throw error;
  }
}

// Synchronous proxy for feature modules - throws if DB not initialised
export const db: DrizzleInstance = new Proxy({} as DrizzleInstance, {
  get(_target, prop: string | symbol) {
    if (!_db) throw new Error("Database not available");
    return Reflect.get(_db as object, prop as string);
  },
});

// --- User Helpers --------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized as any;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.role) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (user.points !== undefined) {
      values.points = user.points;
      updateSet.points = user.points;
    }

    if (user.lastSignedIn) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    } else if (user.openId === ENV.ownerOpenId) values.role = 'admin';

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt)).limit(1000);
}

// ─── Staking Helpers ────────────────────────────────────────────────────────
export async function getUserStakingPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(stakingPositions).where(eq(stakingPositions.userId, userId)).orderBy(desc(stakingPositions.stakedAt));
}

export async function createStakingPosition(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(stakingPositions).values(data).returning({ id: stakingPositions.id });
  return { id: row!.id, ...data };
=======
  const [result] = await db.insert(stakingPositions).values(data).returning();
  return { id: result.id, ...data };
>>>>>>> origin/add-agentz-editable
}

export async function updateStakingPosition(id: number, userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stakingPositions).set(data).where(and(eq(stakingPositions.id, id), eq(stakingPositions.userId, userId)));
}

// ─── Product Helpers ─────────────────────────────────────────────────────────
export async function createProduct(data: Omit<InsertProduct, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(products).values(data).returning({ id: products.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(products).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getRecentActivity(limit = 20) {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function getRecentDecisions(limit = 10) {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(autopilotDecisions).orderBy(desc(autopilotDecisions.createdAt)).limit(limit);
}

export async function logActivity(actionOrData: string | { userId?: number | null; action: string; entityType?: string; entityId?: number; details?: any }, details?: string) {
  const d = await getDb();
  if (!d) return;
  if (typeof actionOrData === "string") {
    await d.insert(activityLog).values({ action: actionOrData, details: details ? { text: details } : undefined });
  } else {
    await d.insert(activityLog).values({
      userId: actionOrData.userId ?? undefined,
      action: actionOrData.action,
      entityType: actionOrData.entityType,
      entityId: actionOrData.entityId,
      details: actionOrData.details,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// TASK QUEUE (used by agents, missions)
// ─────────────────────────────────────────────────────────────

export async function getDueTasks(limit = 10) {
  const d = await getDb();
  const now = new Date();
  return d.select().from(missionTasks)
    .where(and(
      eq(missionTasks.status, "pending"),
      or(isNull(missionTasks.scheduledAt), lte(missionTasks.scheduledAt, now)),
    ))
    .orderBy(missionTasks.order)
    .limit(limit);
}

export async function getRunTaskCount() {
  const d = await getDb();
  const rows = await d.select({ count: sql<number>`count(*)` }).from(missionTasks).where(eq(missionTasks.status, "in_progress"));
  return rows[0]?.count ?? 0;
}

export async function markTaskWaitingHuman(id: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "waiting_human", updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function getActiveMissionTypes(): Promise<string[]> {
  const d = await getDb();
  const rows = await d.select({ title: missions.title }).from(missions).where(eq(missions.status, "active"));
  return rows.map(r => r.title);
}

export async function getAdaptivePriors(): Promise<Record<string, { alpha: number; beta: number }>> {
<<<<<<< HEAD
  const d = await getDb();
  const rows = await d.select().from(bayesianPriors);
  const map: Record<string, { alpha: number; beta: number }> = {
    DEFAULT: { alpha: 2, beta: 23 },
  };
  for (const row of rows) {
    map[row.segment] = { alpha: Number(row.priorAlpha ?? "2"), beta: Number(row.priorBeta ?? "23") };
  }
  return map;
}

export async function updateBayesianPrior(segment: string, alphaDelta: number, betaDelta: number) {
  const d = await getDb();
  // Use raw SQL UPSERT for atomic increment — Drizzle's onConflictDoUpdate set field
  // does not accept sql template expressions, so we use execute() directly.
  await d.execute(sql`
    INSERT INTO bayesian_priors (segment, "priorAlpha", "priorBeta", "currentMean", "observationsCount", "updatedAt")
    VALUES (
      ${segment},
      ${2 + alphaDelta},
      ${23 + betaDelta},
      ${(2 + alphaDelta) / (2 + alphaDelta + 23 + betaDelta)},
      1,
      NOW()
    )
    ON CONFLICT (segment) DO UPDATE SET
      "priorAlpha" = bayesian_priors."priorAlpha"::numeric + ${alphaDelta},
      "priorBeta"  = bayesian_priors."priorBeta"::numeric  + ${betaDelta},
      "currentMean" = (bayesian_priors."priorAlpha"::numeric + ${alphaDelta})
                    / (bayesian_priors."priorAlpha"::numeric + ${alphaDelta}
                       + bayesian_priors."priorBeta"::numeric + ${betaDelta}),
      "observationsCount" = bayesian_priors."observationsCount" + 1,
      "updatedAt" = NOW()
  `);
}

export async function getRecentOutcomeSignals(sinceMs = 5 * 60 * 1000): Promise<Array<{ segment: string; signal: string }>> {
  const d = await getDb();
  const since = new Date(Date.now() - sinceMs);
  const rows = await d.select().from(activityLog)
    .where(and(eq(activityLog.action, "outcome_signal"), gte(activityLog.createdAt, since)));
  return rows
    .map(r => ({ segment: (r.details as any)?.segment as string, signal: (r.details as any)?.signal as string }))
    .filter(r => r.segment && r.signal);
=======
  try {
    const d = await getDb();
    if (!d) return { ...SEGMENT_PRIORS };
    const rows = await d.select({
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
>>>>>>> origin/add-agentz-editable
}

export async function createLead(data: any) {
  const d = await getDb();
  const values = {
    email: data.email,
    name: data.name ?? null,
    company: data.company ?? null,
    title: data.title ?? null,
    phone: data.phone ?? null,
    source: data.source ?? "direct",
    status: data.status ?? "new",
    isVip: data.isVip ?? false,
    industry: data.industry ?? null,
    metadata: data.metadata ?? null,
  };
<<<<<<< HEAD
  const [row] = await d.insert(leads).values(values).returning({ id: leads.id });
  return { id: row!.id, ...values };
=======
  const [result] = await d.insert(leads).values(values).returning();
  return result;
>>>>>>> origin/add-agentz-editable
}

export async function getLeadByEmail(email: string) {
  const d = await getDb();
  const rows = await d.select().from(leads).where(eq(leads.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function updateLead(id: number, data: any) {
  const d = await getDb();
  await d.update(leads).set(data).where(eq(leads.id, id));
}

export async function getLeadById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(leads).where(eq(leads.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAllLeads() {
  const d = await getDb();
  return d.select().from(leads).orderBy(desc(leads.createdAt)).limit(1000);
}

export async function incrementInteractionCount(id: number) {
  const d = await getDb();
  await d.update(leads).set({ interactionsCount: sql`coalesce(${leads.interactionsCount}, 0) + 1` }).where(eq(leads.id, id));
}

export async function updateLeadScore(id: number, score: number) {
  const d = await getDb();
  await d.update(leads).set({ score }).where(eq(leads.id, id));
}

export async function recordEmailOpen(email: string) {
  const d = await getDb();
  await d.update(leads).set({ emailOpened: true, updatedAt: new Date() }).where(eq(leads.email, email.toLowerCase()));
}

export async function recordEmailClick(email: string) {
  const d = await getDb();
  await d.update(leads).set({ emailClicked: true, updatedAt: new Date() }).where(eq(leads.email, email.toLowerCase()));
}

export async function recordEmailReply(email: string) {
  const d = await getDb();
  await d.update(leads).set({ emailReplied: true, updatedAt: new Date() }).where(eq(leads.email, email.toLowerCase()));
}

export async function updateLeadStatus(id: number, status: string) {
  const d = await getDb();
  await d.update(leads).set({ status: status as any }).where(eq(leads.id, id));
}

export async function incrementInteractionCount(id: number) {
  const d = await getDb();
  if (!d) return;
  await d.update(leads)
    .set({ interactionsCount: sql`${leads.interactionsCount} + 1` })
    .where(eq(leads.id, id));
}

// ─────────────────────────────────────────────────────────────
// SERVICE ORDERS (used by service-orders router)
// ─────────────────────────────────────────────────────────────

export async function getServiceOrderById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateServiceOrderStatus(id: number, status: string, extra?: Record<string, any>) {
  const d = await getDb();
  await d.update(serviceOrders).set({ status, ...(extra ?? {}), updatedAt: new Date() }).where(eq(serviceOrders.id, id));
}

export async function createServiceOrder(data: any) {
  const d = await getDb();
<<<<<<< HEAD
  const [row] = await d.insert(serviceOrders).values(data).returning({ id: serviceOrders.id });
  const id = row!.id;
=======
  const [result] = await d.insert(serviceOrders).values(data).returning();
  const id = result.id;
>>>>>>> origin/add-agentz-editable
  return { id, ...data };
}

export async function getServiceOrderById(id: number) {
  const d = await getDb();
  if (!d) return null;
  const rows = await d.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getServiceOrdersByUser(userId: number) {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(serviceOrders)
    .where(eq(serviceOrders.userId, userId))
    .orderBy(desc(serviceOrders.createdAt));
}

export async function getAllServiceOrders() {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
}

export async function getServiceOrderBySessionId(sessionId: string) {
  const d = await getDb();
<<<<<<< HEAD
  if (!d) return null;
  const rows = await d.select().from(serviceOrders).where(sql`(${serviceOrders.details}::jsonb)->>'sessionId' = ${sessionId}`).limit(1);
  return rows[0] ?? null;
}

export async function updateServiceOrderStatus(
  id: number,
  status: string,
  updates?: { stripePaymentIntentId?: string; [key: string]: unknown },
) {
  const d = await getDb();
  if (!d) return;
  const setValues: Record<string, unknown> = { status, updatedAt: new Date() };
  if (updates?.stripePaymentIntentId) {
    setValues.stripePaymentIntentId = updates.stripePaymentIntentId;
  }
  await d.update(serviceOrders).set(setValues as any).where(eq(serviceOrders.id, id));
=======
  const rows = await d.select().from(serviceOrders).where(eq(serviceOrders.stripeSessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function getServiceOrdersByUser(userId: number) {
  const d = await getDb();
  return d.select().from(serviceOrders).where(eq(serviceOrders.userId, userId)).orderBy(desc(serviceOrders.createdAt));
}

export async function getAllServiceOrders() {
  const d = await getDb();
  return d.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
>>>>>>> origin/add-agentz-editable
}

// ─────────────────────────────────────────────────────────────
// BUDGET & TASKS
// ─────────────────────────────────────────────────────────────

<<<<<<< HEAD
export async function getAcceptanceCriteriaStatus() {
  return { total: 0, passed: 0, failed: 0, pending: 0 };
}

export async function getFunnelBySegmentAndChannel() {
  return [];
}

export async function getLeadCohorts() {
  return [];
}

export async function getBudgetStatus() {
  const d = await getDb();
  const rows = await d.select().from(budgetConfig).limit(1);
  const row = rows[0] ?? { monthlyLimit: "1000.00", spent: "0.00" };
  const limit = Number(row.monthlyLimit);
  const spent = Number(row.spent ?? "0");
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const now = new Date();
  return {
    ...row,
    llm: { pct },
    ads: { pct },
    enrichment: { pct },
    period: {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      day: now.toISOString().slice(0, 10),
    },
=======
export async function getBudgetStatus(_asOf?: Date) {
  const d = await getDb();
  const rows = await d.select().from(budgetConfig).limit(1);
  const row = rows[0] ?? { monthlyLimit: "1000.00", spent: "0.00", currency: "USD" };
  const limit = parseFloat(row.monthlyLimit);
  const spent = parseFloat(row.spent ?? "0");
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const now = _asOf ?? new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayKey = now.toISOString().slice(0, 10);
  return {
    ...row,
    llm:        { pct, spent, limit },
    ads:        { pct: 0, spent: 0, limit: 0 },
    enrichment: { pct: 0, spent: 0, limit: 0 },
    period:     { month: monthKey, day: dayKey },
>>>>>>> origin/add-agentz-editable
  };
}

export async function markTaskRunning(id: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.update(missionTasks)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(and(eq(missionTasks.id, id), eq(missionTasks.status, "pending")))
    .returning({ id: missionTasks.id });
  return rows.length > 0;
}

export async function markTaskDone(id: string, result?: any) {
  const d = await getDb();
  // WHERE status='in_progress' preserves 'waiting_human' if an agent set it during execution
  await d.update(missionTasks).set({ status: "completed", result, updatedAt: new Date() }).where(and(eq(missionTasks.id, id), eq(missionTasks.status, "in_progress")));
}

export async function markTaskFailed(id: string, error: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "failed", error, updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function enqueueTask(missionId: string, kind: string, payload: any, scheduledAt?: Date) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missionTasks).values({
    id,
    missionId,
    kind,
    title: kind,
    status: "pending",
    payload,
<<<<<<< HEAD
    scheduledAt: scheduledAt ?? null,
=======
    ...(scheduledAt ? { scheduledAt } : {}),
>>>>>>> origin/add-agentz-editable
  });
  return id;
}

// ─────────────────────────────────────────────────────────────
// PROPOSALS
// ─────────────────────────────────────────────────────────────

export async function createProposal(data: {
  leadEmail: string;
  missionId: string;
  taskId?: string;
  segment: string;
  content: string;
  paymentLink?: string;
  checkoutSessionId?: string;
<<<<<<< HEAD
  pilotPriceUsd: number;
}): Promise<string> {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(proposals).values({
    id,
    leadEmail: data.leadEmail,
    missionId: data.missionId,
    taskId: data.taskId ?? null,
    segment: data.segment,
    content: data.content,
    paymentLink: data.paymentLink ?? null,
    checkoutSessionId: data.checkoutSessionId ?? null,
    pilotPriceUsd: data.pilotPriceUsd,
    status: "SENT",
  });
=======
  pilotPriceUsd?: number;
}): Promise<string> {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(proposals).values({ id, ...data });
>>>>>>> origin/add-agentz-editable
  return id;
}

// ─────────────────────────────────────────────────────────────
// REPORTING & ANALYTICS (used by jobs/revenue-digest, value-report)
// ─────────────────────────────────────────────────────────────

export async function getWeeklyRevenueDigest() {
  const d = await getDb();
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const rows = await d.select().from(revenueRecords).where(gte(revenueRecords.createdAt, weekAgo));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return {
    leads: rows.length,
    mqlToSql: 0,
    demosBooked: 0,
    trialToPaid: 0,
    churn: 0,
    mrr: total.toFixed(2),
    arpa: rows.length ? (total / rows.length).toFixed(2) : "0.00",
    rows,
  };
}

export async function hasActionLogged(action: string, sinceDaysAgo = 1): Promise<boolean> {
  const d = await getDb();
  const since = new Date(Date.now() - sinceDaysAgo * 86400000);
  const rows = await d.select().from(activityLog)
    .where(and(eq(activityLog.action, action), gte(activityLog.createdAt, since)))
    .limit(1);
  return rows.length > 0;
}

export async function getQuarterlyValueReport() {
  const d = await getDb();
  const quarterAgo = new Date(Date.now() - 90 * 86400000);
  const now = new Date();
  const q = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const rows = await d.select().from(revenueRecords).where(gte(revenueRecords.createdAt, quarterAgo));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return {
    period: q,
    roiSummary: `Q${Math.ceil((now.getMonth() + 1) / 3)} revenue: $${total.toFixed(2)} across ${rows.length} records.`,
    totalRevenue: total,
    rows,
  };
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
  return d.select().from(users).where(lte(users.lastSignedIn, cutoff)).limit(500);
}

export async function listUsersForOnboardingStep(step: string | number) {
  const d = await getDb();
  return d.select().from(users).orderBy(desc(users.createdAt)).limit(100);
}

// ─────────────────────────────────────────────────────────────
// DUNNING & RETENTION (used by jobs/dunning.ts, jobs/retention.ts)
// ─────────────────────────────────────────────────────────────

export async function listPastDueSubscriptions() {
  const d = await getDb();
  return d.select().from(subscriptions).where(eq(subscriptions.status, "past_due")).limit(1000);
}

export async function hasDunningStepLogged(subscriptionId: number, step: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select().from(activityLog)
    .where(and(
      like(activityLog.action, `dunning:${step}:%`),
<<<<<<< HEAD
      sql`(${activityLog.details}::jsonb)->>'text' LIKE ${'%sub:' + subscriptionId + '%'}`
=======
      sql`${activityLog.details}->>'text' LIKE ${'%sub:' + subscriptionId + '%'}`
>>>>>>> origin/add-agentz-editable
    )).limit(1);
  return rows.length > 0;
}

export async function hasUserActionLogged(userId: number, action: string, sinceDaysAgo: number = 365): Promise<boolean> {
  const d = await getDb();
  const since = new Date(Date.now() - sinceDaysAgo * 86400000);
  const rows = await d.select().from(activityLog)
    .where(and(
      eq(activityLog.userId, userId),
      eq(activityLog.action, action),
      gte(activityLog.createdAt, since)
    )).limit(1);
  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────
// MISSIONS CRUD (used by missions/router.ts)
// ─────────────────────────────────────────────────────────────

import type { MissionType, MissionStatus } from "./missions/types";

export async function getMissions(statusFilter?: string) {
  const d = await getDb();
  if (statusFilter) {
    return d.select().from(missions).where(eq(missions.status, statusFilter as any));
  }
  return d.select().from(missions).orderBy(desc(missions.createdAt)).limit(200);
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
    type,
    title: type,
    description: `Mission: ${type}`,
    status: "pending",
  });
  return id;
}

export async function createTask(data: any) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missionTasks).values({
    id,
    missionId: data.missionId,
    kind: data.kind,
    title: data.title || data.kind,
    description: data.description || data.kind,
    priority: data.priority || 0,
    status: data.status || "pending",
    payload: data.payload,
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

// ─────────────────────────────────────────────────────────────
// USER LOOKUPS
// ─────────────────────────────────────────────────────────────

export async function getAllAdminIds(): Promise<number[]> {
  const d = await getDb();
  const rows = await d.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return rows.map(r => r.id);
}

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────

export async function getUserProducts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).where(eq(products.userId, userId)).orderBy(desc(products.createdAt));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function updateProduct(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

// ─── Authentication Helpers ──────────────────────────────────────────────────
export async function createAuthentication(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(authentications).values(data).returning({ id: authentications.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(authentications).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getUserAuthentications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(authentications).where(eq(authentications.userId, userId)).orderBy(desc(authentications.createdAt));
}

export async function getAuthenticationByShareToken(shareToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(authentications).where(eq(authentications.shareToken, shareToken)).limit(1);
  return result[0];
}

export async function updateAuthenticationSharing(id: number, userId: number, isPublic: boolean, shareToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(authentications).set({ isPublic: isPublic ? 1 : 0, shareToken }).where(and(eq(authentications.id, id), eq(authentications.userId, userId)));
}

export async function incrementShareCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(authentications).set({ shareCount: sql`${authentications.shareCount} + 1` }).where(eq(authentications.id, id));
}

// ─── Certificate Helpers ─────────────────────────────────────────────────────
export async function createCertificate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(certificates).values(data).returning({ id: certificates.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(certificates).values(data).returning();
  return result;
>>>>>>> origin/add-agentz-editable
}

export async function getCertificateByNumber(certNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificates).where(eq(certificates.certificateNumber, certNumber)).limit(1);
  return result[0];
}

export async function getUserCertificates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.createdAt));
}

// ─── QR Code Helpers ─────────────────────────────────────────────────────────
export async function createQrCode(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(qrCodes).values(data).returning({ id: qrCodes.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(qrCodes).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getProductQrCodes(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(qrCodes).where(eq(qrCodes.productId, productId));
}

export async function incrementScanCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(qrCodes).set({ scanCount: sql`${qrCodes.scanCount} + 1`, lastScannedAt: new Date() }).where(eq(qrCodes.id, id));
}

export async function logScanEvent(data: { qrCodeId: number; productId: number; isAuthentic?: boolean; userAgent?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(qrScanEvents).values(data);
}

export async function getRecentScanEvents(productId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(qrScanEvents)
    .where(eq(qrScanEvents.productId, productId))
    .orderBy(desc(qrScanEvents.scannedAt))
    .limit(limit);
}

// ─── NFT Helpers ─────────────────────────────────────────────────────────────
export async function listNfts(filters?: { collectionId?: number; status?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(nfts);
  const conditions: SQL[] = [];
  if (filters?.collectionId) conditions.push(eq(nfts.collectionId, filters.collectionId));
  if (filters?.status) conditions.push(eq(nfts.status, filters.status as typeof nfts.status._.data));
  if (conditions.length) query = query.where(and(...conditions)) as typeof query;
  return await query.orderBy(desc(nfts.createdAt)).limit(filters?.limit || 50);
}

export async function getNftById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(nfts).where(eq(nfts.id, id)).limit(1);
  return result[0];
}

export async function createNft(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(nfts).values(data).returning({ id: nfts.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(nfts).values(data).returning();
  return result;
>>>>>>> origin/add-agentz-editable
}

export async function listCollections() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(nftCollections).orderBy(desc(nftCollections.createdAt)).limit(200);
}

export async function getCollectionBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(nftCollections).where(eq(nftCollections.slug, slug)).limit(1);
  return result[0];
}

export async function createCollection(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(nftCollections).values(data).returning({ id: nftCollections.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(nftCollections).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

// ─── Auction Helpers ─────────────────────────────────────────────────────────
export async function createAuction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(auctions).values(data).returning({ id: auctions.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(auctions).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getActiveAuctions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auctions).where(eq(auctions.status, "active")).orderBy(desc(auctions.createdAt));
}

export async function getAuctionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  return result[0];
}

export async function placeBid(auctionId: number, bidderId: number, amount: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(auctionBids).values({ auctionId, bidderId, amount });
  await db.update(auctions).set({
    currentBid: amount,
    highestBidderId: bidderId,
    bidCount: sql`${auctions.bidCount} + 1`,
  }).where(eq(auctions.id, auctionId));
}

export async function getAuctionBids(auctionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auctionBids).where(eq(auctionBids.auctionId, auctionId)).orderBy(desc(auctionBids.amount));
}

// ─── Subscription Helpers ────────────────────────────────────────────────────
export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).limit(1);
  return result[0];
}

export async function createSubscription(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(subscriptions).values(data).returning({ id: subscriptions.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(subscriptions).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function updateSubscriptionUsage(userId: number, usedQuota: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set({ usedQuota }).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
}

export async function consumeSubscriptionQuota(userId: number): Promise<"ok" | "exceeded" | "no_subscription"> {
  const db = await getDb();
  if (!db) return "no_subscription";
  const rows = await db.update(subscriptions)
    .set({ usedQuota: sql`${subscriptions.usedQuota} + 1` })
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, "active"),
      sql`COALESCE(${subscriptions.usedQuota}, 0) < ${subscriptions.monthlyQuota}`,
    ))
    .returning({ id: subscriptions.id });
  if (rows.length > 0) return "ok";
  const [sub] = await db.select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .limit(1);
  return sub ? "exceeded" : "no_subscription";
}

export async function recordUsage(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(usageRecords).values(data);
}

// ─── Invoice Helpers ─────────────────────────────────────────────────────────
export async function createInvoice(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(invoices).values(data).returning({ id: invoices.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(invoices).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getUserInvoices(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
}

// ─── Payment Helpers ─────────────────────────────────────────────────────────
export async function createPayment(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(payments).values(data).returning({ id: payments.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(payments).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getUserPayments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
}

export async function updatePaymentStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set({ status: status as any }).where(eq(payments.id, id));
}

// ─── Email Campaign Helpers ──────────────────────────────────────────────────
export async function createEmailCampaign(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(emailCampaigns).values(data).returning({ id: emailCampaigns.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(emailCampaigns).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getUserEmailCampaigns(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailCampaigns).where(eq(emailCampaigns.userId, userId)).orderBy(desc(emailCampaigns.createdAt));
}

export async function updateEmailCampaign(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailCampaigns).set(data).where(eq(emailCampaigns.id, id));
}

// ─── Email Draft Helpers ─────────────────────────────────────────────────────
export async function createEmailDraft(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(emailDrafts).values(data).returning({ id: emailDrafts.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(emailDrafts).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getPendingDrafts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailDrafts).where(eq(emailDrafts.status, "pending")).orderBy(desc(emailDrafts.createdAt)).limit(200);
}

export async function updateDraftStatus(id: number, status: string, approvedBy?: number) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { status };
  if (approvedBy) { updateData.approvedBy = approvedBy; updateData.approvedAt = new Date(); }
  if (status === "sent") updateData.sentAt = new Date();
  await db.update(emailDrafts).set(updateData).where(eq(emailDrafts.id, id));
}

// ─── Supply Chain Helpers ────────────────────────────────────────────────────
export async function createSupplyChainEvent(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(supplyChainEvents).values(data).returning({ id: supplyChainEvents.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(supplyChainEvents).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getProductSupplyChain(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(supplyChainEvents).where(eq(supplyChainEvents.productId, productId)).orderBy(supplyChainEvents.createdAt);
}

// ─── Referral Helpers ────────────────────────────────────────────────────────
export async function createReferral(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(referrals).values(data).returning({ id: referrals.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(referrals).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getReferralByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(referrals).where(eq(referrals.referralCode, code)).limit(1);
  return result[0];
}

export async function getUserReferrals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
}

// ─── Affiliate Helpers ───────────────────────────────────────────────────────
export async function getAffiliateByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
  return result[0];
}

export async function createAffiliate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(affiliates).values(data).returning({ id: affiliates.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(affiliates).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getAffiliateCommissions(affiliateId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(affiliateCommissions).where(eq(affiliateCommissions.affiliateId, affiliateId)).orderBy(desc(affiliateCommissions.createdAt));
}

// ─── Autopilot Helpers ───────────────────────────────────────────────────────
export async function getAutopilotConfig() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(autopilotConfig).orderBy(desc(autopilotConfig.id)).limit(1);
  return result[0];
}

export async function upsertAutopilotConfig(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ id: autopilotConfig.id }).from(autopilotConfig).limit(1);
  if (existing.length > 0) {
    await db.update(autopilotConfig).set(data).where(eq(autopilotConfig.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db.insert(autopilotConfig).values(data).returning({ id: autopilotConfig.id });
  return result?.id;
}

export async function createAutopilotDecision(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(autopilotDecisions).values(data).returning({ id: autopilotDecisions.id });
  return { id: row!.id };
}

export async function getAutopilotDecisionCountByMonth(type: string): Promise<{ data: number }> {
  const db = await getDb();
  if (!db) return { data: 0 };
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(autopilotDecisions)
    .where(and(eq(autopilotDecisions.type, type), gte(autopilotDecisions.createdAt, start)));
  return { data: Number(rows[0]?.count ?? 0) };
=======
  const [result] = await db.insert(autopilotDecisions).values(data).returning();
  return { id: result.id };
}

export async function getAutopilotDecisionCountByMonth(_type?: string): Promise<{ data: number }> {
  const db = await getDb();
  if (!db) return { data: 0 };
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(autopilotDecisions)
    .where(gte(autopilotDecisions.createdAt, firstOfMonth));
  return { data: rows[0]?.count ?? 0 };
>>>>>>> origin/add-agentz-editable
}

// ─── A/B Test Helpers ────────────────────────────────────────────────────────
export async function createAbTest(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(abTests).values(data).returning({ id: abTests.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(abTests).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getActiveAbTests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(abTests).where(eq(abTests.status, "running")).orderBy(desc(abTests.createdAt));
}

export async function getAllAbTests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(abTests).orderBy(desc(abTests.createdAt)).limit(200);
}

// ─── White Label Helpers ─────────────────────────────────────────────────────
export async function createWhiteLabelClient(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(whiteLabelClients).values(data).returning({ id: whiteLabelClients.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(whiteLabelClients).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getWhiteLabelClients() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(whiteLabelClients).orderBy(desc(whiteLabelClients.createdAt)).limit(200);
}

export async function getWhiteLabelByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(whiteLabelClients).where(eq(whiteLabelClients.apiKey, apiKey)).limit(1);
  return result[0];
}

// ─── Fraud Alert Helpers ─────────────────────────────────────────────────────
export async function createFraudAlert(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(fraudAlerts).values(data).returning({ id: fraudAlerts.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(fraudAlerts).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getOpenFraudAlerts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fraudAlerts).where(eq(fraudAlerts.status, "open")).orderBy(desc(fraudAlerts.createdAt));
}

// ─── Customer Health Helpers ─────────────────────────────────────────────────
export async function upsertHealthScore(userId: number, score: number, factors: any, trend: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(customerHealthScores)
    .values({ userId, score, factors, trend: trend as any })
    .onConflictDoUpdate({ target: customerHealthScores.userId, set: { score, factors, trend: trend as any, lastCalculatedAt: new Date() } });
}

export async function getAllHealthScores() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(customerHealthScores).orderBy(desc(customerHealthScores.score)).limit(500);
}

// ─── Revenue Helpers ─────────────────────────────────────────────────────────
export async function recordRevenue(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(revenueRecords).values(data);
}

export async function getRevenueAnalytics(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(revenueRecords);
  if (startDate && endDate) {
    query = query.where(and(gte(revenueRecords.createdAt, startDate), lte(revenueRecords.createdAt, endDate))) as typeof query;
  }
  return await query.orderBy(desc(revenueRecords.createdAt)).limit(2000);
}

// ─── Dashboard Metrics ───────────────────────────────────────────────────────
export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db) return { totalProducts: 0, totalAuthentications: 0, totalCertificates: 0, totalNfts: 0 };
  const [[prods], [auths], [certs], [nftCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(authentications).where(eq(authentications.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(certificates).where(eq(certificates.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(nfts).where(eq(nfts.ownerId, userId)),
  ]);
  return {
    totalProducts: prods?.count || 0,
    totalAuthentications: auths?.count || 0,
    totalCertificates: certs?.count || 0,
    totalNfts: nftCount?.count || 0,
  };
}

export async function getAdminDashboardMetrics() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalProducts: 0, totalAuthentications: 0, totalRevenue: 0, totalLeads: 0, totalNfts: 0 };
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
    totalRevenue: parseFloat(revenue?.total || "0"),
    totalLeads: leadCount?.count || 0,
    totalNfts: nftCount?.count || 0,
  };
}

export async function getSubscriptionAnalytics() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(5000);
}

// ─── Notification Helpers ───────────────────────────────────────────────────
export async function createNotification(data: Omit<InsertNotification, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
<<<<<<< HEAD
  const [row] = await db.insert(notifications).values(data).returning({ id: notifications.id });
  return { id: row!.id };
=======
  const [result] = await db.insert(notifications).values(data).returning();
  return { id: result.id };
>>>>>>> origin/add-agentz-editable
}

export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
  return result?.count || 0;
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
}

export async function deleteNotification(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function createSystemNotification(userId: number, title: string, message: string, type: InsertNotification["type"], actionUrl?: string) {
  return createNotification({ userId, type: type as any, title, message, isRead: 0, actionUrl });
}

// ─── Automation Audit ────────────────────────────────────────────────────────

export async function logAutomationAudit(action: string, data: Record<string, unknown>, userId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values({ userId, action, details: { text: action, ...data } });
}

// ─── Lead Upsert & Scoring ──────────────────────────────────────────────────

export async function upsertLeadByEmail(input: {
  email: string;
  name?: string;
  company?: string;
  title?: string;
  phone?: string;
  source?: string;
  industry?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: number; created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ id: leads.id }).from(leads).where(eq(leads.email, input.email)).limit(1);
  if (existing[0]) {
    await db.update(leads).set({
      name: input.name,
      company: input.company,
      title: input.title,
      phone: input.phone,
      source: input.source,
      industry: input.industry,
      metadata: input.metadata,
    }).where(eq(leads.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }
<<<<<<< HEAD
  const [row] = await db.insert(leads).values({
=======
  const [result] = await db.insert(leads).values({
>>>>>>> origin/add-agentz-editable
    email: input.email,
    name: input.name,
    company: input.company,
    title: input.title,
    phone: input.phone,
    source: input.source || "website_form",
    industry: input.industry,
    metadata: input.metadata,
<<<<<<< HEAD
  }).returning({ id: leads.id });
  return { id: row!.id, created: true };
=======
  }).returning();
  return { id: result.id, created: true };
>>>>>>> origin/add-agentz-editable
}

export function computeLeadScore(signals: {
  segmentFit?: number;
  intent?: number;
  urgency?: number;
  budgetProxy?: number;
}): { score: number; band: "hot" | "warm" | "cold"; route: string } {
  const w = { segmentFit: 0.3, intent: 0.35, urgency: 0.2, budgetProxy: 0.15 };
  const score = Math.round(
    (signals.segmentFit ?? 50) * w.segmentFit +
    (signals.intent ?? 50) * w.intent +
    (signals.urgency ?? 50) * w.urgency +
    (signals.budgetProxy ?? 50) * w.budgetProxy,
  );
  const band: "hot" | "warm" | "cold" = score >= 80 ? "hot" : score >= 50 ? "warm" : "cold";
  const route = band === "hot" ? "sales_direct" : band === "warm" ? "nurture_sequence" : "newsletter";
  return { score, band, route };
}

// ─── Stripe Subscription Helpers ─────────────────────────────────────────────

export async function upsertStripeSubscription(data: {
  userId: number;
  plan: "starter" | "professional" | "enterprise" | "medtech";
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused";
  monthlyQuota: number;
  billingCycle: "monthly" | "annual";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, data.stripeSubscriptionId))
    .limit(1);
  if (existing[0]) {
    await db.update(subscriptions).set({
      plan: data.plan,
      status: data.status,
      monthlyQuota: data.monthlyQuota,
      billingCycle: data.billingCycle,
      stripeCustomerId: data.stripeCustomerId ?? undefined,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt ?? undefined,
    }).where(eq(subscriptions.id, existing[0].id));
  } else {
    await db.insert(subscriptions).values({
      userId: data.userId,
      plan: data.plan,
      status: data.status,
      monthlyQuota: data.monthlyQuota,
      billingCycle: data.billingCycle,
      stripeCustomerId: data.stripeCustomerId ?? undefined,
      stripeSubscriptionId: data.stripeSubscriptionId,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt ?? undefined,
    });
  }
  // Keep users.stripeCustomerId in sync so paymentHistory tRPC query works
  if (data.stripeCustomerId) {
    await db.update(users)
      .set({ stripeCustomerId: data.stripeCustomerId })
      .where(eq(users.id, data.userId));
  }
}

export async function setSubscriptionStatusByStripeId(
  stripeSubscriptionId: string,
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused",
  cancelledAt?: Date,
) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions)
    .set({ status, cancelledAt: cancelledAt ?? undefined })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return result[0];
}

<<<<<<< HEAD
export async function hasWebhookEventProcessed(eventId: string, eventType = "unknown", provider = "stripe"): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // Atomic claim: INSERT returns 0 rows on conflict → already processed.
  const result = await db
    .insert(webhookEvents)
    .values({ provider, eventId, eventType, receivedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  return result.length === 0;
=======
export async function claimWebhookEvent(
  provider: string,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const inserted = await db.insert(webhookEvents)
    .values({ provider, eventId, eventType })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });
  return inserted.length > 0;
>>>>>>> origin/add-agentz-editable
}

export async function markWebhookEventProcessed(provider: string, eventId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
}

export async function getAcceptanceCriteriaStatus() {
  return { total: 0, passed: 0, failed: 0, pending: 0 };
}

export async function getFunnelBySegmentAndChannel() {
  return [] as Array<{ segment: string; channel: string; leads: number; converted: number }>;
}

export async function getLeadCohorts() {
  return [] as Array<{ cohort: string; count: number; conversionRate: number }>;
}

// ─── Additional Helpers ───────────────────────────────────────────────────────

export async function getLeads() {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function getRecentAgentZActivity(limit = 10) {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(activityLog)
    .where(eq(activityLog.entityType, "agent"))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}

export async function getQronList(): Promise<any[]> {
  const d = await getDb();
  if (!d) return [];
  return d.select().from(qrCodes).orderBy(desc(qrCodes.createdAt));
}

export async function createQron(data: {
  id?: string;
  productId: number;
  productName?: string;
  brand?: string;
  category?: string;
  mode?: string;
  seed?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  fingerprintHash?: string;
  nftTokenId?: string;
  openartUrl?: string;
  trustScore?: number;
}): Promise<any[]> {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  const [row] = await d.insert(qrCodes).values({
    productId: data.productId,
    userId: 0,
    qrData: data.id ?? String(data.productId),
    qrImageUrl: data.imageUrl,
  }).returning();
  return [{ ...row, ...data }];
}

export async function getQronById(id: string | number): Promise<any | null> {
  const d = await getDb();
  if (!d) return null;
  if (typeof id === "string") {
    const rows = await d.select().from(qrCodes).where(eq(qrCodes.qrData, id)).limit(1);
    return rows[0] ?? null;
  }
  const rows = await d.select().from(qrCodes).where(eq(qrCodes.id, id as number)).limit(1);
  return rows[0] ?? null;
}

export async function createQronScanVerdict(data: {
  qronId: number | string;
  scannedImageUrl?: string;
  similarityScore?: number;
  verdict?: string;
  details?: string;
}): Promise<void> {
  const d = await getDb();
  if (!d) return;
  // Log as activity since we don't have a dedicated scan_verdicts table
  await d.insert(activityLog).values({
    action: "qron_scan_verdict",
    entityType: "qron",
    entityId: typeof data.qronId === "number" ? data.qronId : undefined,
    details: data,
  });
}

export async function updateQron(id: number | string, data: Partial<{
  verifiedScanCount: number;
  fakeFlagCount: number;
  trustScore: number;
  [key: string]: unknown;
}>): Promise<void> {
  const d = await getDb();
  if (!d) return;
  if (typeof id === "number") {
    await d.update(qrCodes).set({ scanCount: data.verifiedScanCount ?? undefined }).where(eq(qrCodes.id, id));
  }
}

export async function claimStripeProvisionedUser(openId: string, email: string): Promise<void> {
  const d = await getDb();
  if (!d) return;
  if (!email) return;
  await d.update(users)
    .set({ openId })
    .where(and(eq(users.email, email), sql`${users.openId} LIKE 'stripe_provisioned_%'`));
}
