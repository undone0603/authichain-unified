// server/db-helpers.ts
//
// Db-parameterized replacements for the server/db.ts helper functions used
// across the commerce/revenue cluster (server/webhooks/**, server/services/**,
// server/sales/**, server/admin/**, server/payments/**, server/paddle/**,
// server/subscriptions/**, server/stripe-connect-service.ts,
// server/tenant-billing.ts, server/revenue-orchestrator.ts,
// server/fulfillment-service.ts — Task 2b-4).
//
// server/db.ts's helpers all close over the module-scope getDb() singleton
// (Node-only, process.env.DATABASE_URL), which is incompatible with
// Cloudflare Workers' per-request env bindings. These do the same queries
// but take an explicit `db` instance (threaded from the caller — ultimately
// ctx.db in a tRPC procedure, or a per-request Workers db) instead of
// reaching for the singleton themselves.
//
// Shared across the whole cluster (rather than one file per subdirectory)
// because several functions here (logActivity, createSystemNotification,
// recordRevenue, ...) are used by 3+ of this cluster's subdirectories —
// duplicating them per-directory would just be drift risk for no benefit.
import { randomUUID } from "crypto";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import {
  activityLog,
  notifications,
  leads,
  missions,
  missionTasks,
  serviceOrders,
  users,
  products,
  authentications,
  nfts,
  revenueRecords,
  subscriptions,
  invoices,
  payments,
  fraudAlerts,
  customerHealthScores,
  type InsertNotification,
} from "../drizzle/schema";
import type { getHyperdriveDb } from "./db";
import type { MissionType } from "./missions/types";

export type Db = ReturnType<typeof getHyperdriveDb>;

// ─────────────────────────────────────────────────────────────
// ACTIVITY / AUDIT LOG
// ─────────────────────────────────────────────────────────────

export async function logActivity(
  db: Db,
  actionOrData: string | { userId?: number | null; action: string; entityType?: string; entityId?: number; details?: any },
  details?: string,
): Promise<void> {
  if (typeof actionOrData === "string") {
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

export async function logAutomationAudit(
  db: Db,
  action: string,
  data: Record<string, unknown>,
  userId?: number,
): Promise<void> {
  await db.insert(activityLog).values({ userId, action, details: { text: action, ...data } });
}

export async function hasWebhookEventProcessed(db: Db, eventId: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLog)
    .where(sql`${activityLog.details}->>'eventId' = ${eventId}`);
  return (row?.count ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

export async function createNotification(db: Db, data: Omit<InsertNotification, "id" | "createdAt">) {
  const [result] = await db.insert(notifications).values(data).returning();
  return { id: result.id };
}

export async function createSystemNotification(
  db: Db,
  userId: number,
  title: string,
  message: string,
  type: InsertNotification["type"],
  actionUrl?: string,
) {
  return createNotification(db, { userId, type: type as any, title, message, isRead: 0, actionUrl });
}

// ─────────────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────────────

export async function createLead(db: Db, data: any) {
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
  const [result] = await db.insert(leads).values(values).returning();
  return result;
}

export async function getLeadByEmail(db: Db, email: string) {
  const rows = await db.select().from(leads).where(eq(leads.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function updateLead(db: Db, id: number, data: any) {
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function getLeadById(db: Db, id: number) {
  const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function incrementInteractionCount(db: Db, id: number) {
  await db.update(leads).set({ interactionsCount: sql`coalesce(${leads.interactionsCount}, 0) + 1` }).where(eq(leads.id, id));
}

export async function updateLeadScore(db: Db, id: number, score: number) {
  await db.update(leads).set({ score }).where(eq(leads.id, id));
}

export async function updateLeadStatus(db: Db, id: number, status: string) {
  await db.update(leads).set({ status: status as any }).where(eq(leads.id, id));
}

export async function upsertLeadByEmail(
  db: Db,
  input: {
    email: string;
    name?: string;
    company?: string;
    title?: string;
    phone?: string;
    source?: string;
    industry?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ id: number; created: boolean }> {
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
  const [result] = await db.insert(leads).values({
    email: input.email,
    name: input.name,
    company: input.company,
    title: input.title,
    phone: input.phone,
    source: input.source || "website_form",
    industry: input.industry,
    metadata: input.metadata,
  }).returning();
  return { id: result.id, created: true };
}

// Pure function — no db access. Kept here (rather than imported from
// server/db.ts) so revenue-orchestrator.ts doesn't need any import from
// server/db.ts at all.
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

// ─────────────────────────────────────────────────────────────
// MISSIONS / TASKS (simple server/db.ts versions — NOT the
// template-aware missions/missions.db.ts versions)
// ─────────────────────────────────────────────────────────────

export async function createMission(db: Db, type: MissionType) {
  const id = randomUUID();
  await db.insert(missions).values({
    id,
    type,
    title: type,
    description: `Mission: ${type}`,
    status: "pending",
  });
  return id;
}

export async function createTask(db: Db, data: any) {
  const id = randomUUID();
  await db.insert(missionTasks).values({
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

export async function enqueueTask(db: Db, missionId: string, kind: string, payload: any, scheduledAt?: Date) {
  const id = randomUUID();
  await db.insert(missionTasks).values({
    id,
    missionId,
    kind,
    title: kind,
    status: "pending",
    payload,
    ...(scheduledAt ? { scheduledAt } : {}),
  });
  return id;
}

// ─────────────────────────────────────────────────────────────
// SERVICE ORDERS
// ─────────────────────────────────────────────────────────────

export async function getServiceOrderById(db: Db, id: number) {
  const rows = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateServiceOrderStatus(db: Db, id: number, status: string, extra?: Record<string, any>) {
  await db.update(serviceOrders).set({ status, ...(extra ?? {}), updatedAt: new Date() }).where(eq(serviceOrders.id, id));
}

export async function createServiceOrder(db: Db, data: any) {
  const [result] = await db.insert(serviceOrders).values(data).returning();
  const id = result.id;
  return { id, ...data };
}

export async function getServiceOrderBySessionId(db: Db, sessionId: string) {
  const rows = await db.select().from(serviceOrders).where(eq(serviceOrders.stripeSessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function getServiceOrdersByUser(db: Db, userId: number) {
  return db.select().from(serviceOrders).where(eq(serviceOrders.userId, userId)).orderBy(desc(serviceOrders.createdAt));
}

export async function getAllServiceOrders(db: Db) {
  return db.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
}

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTIONS / INVOICES / PAYMENTS
// ─────────────────────────────────────────────────────────────

export async function getUserSubscription(db: Db, userId: number) {
  const result = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).limit(1);
  return result[0];
}

export async function createSubscription(db: Db, data: any) {
  const [result] = await db.insert(subscriptions).values(data).returning();
  return { id: result.id };
}

export async function createInvoice(db: Db, data: any) {
  const [result] = await db.insert(invoices).values(data).returning();
  return { id: result.id };
}

export async function getUserInvoices(db: Db, userId: number) {
  return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
}

export async function createPayment(db: Db, data: any) {
  const [result] = await db.insert(payments).values(data).returning();
  return { id: result.id };
}

export async function getUserPayments(db: Db, userId: number) {
  return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
}

// ─────────────────────────────────────────────────────────────
// STRIPE SUBSCRIPTION HELPERS
// ─────────────────────────────────────────────────────────────

export async function upsertStripeSubscription(db: Db, data: {
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
}

export async function setSubscriptionStatusByStripeId(
  db: Db,
  stripeSubscriptionId: string,
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused",
  cancelledAt?: Date,
) {
  await db.update(subscriptions)
    .set({ status, cancelledAt: cancelledAt ?? undefined })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getSubscriptionByStripeSubscriptionId(db: Db, stripeSubscriptionId: string) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return result[0];
}

// ─────────────────────────────────────────────────────────────
// PADDLE SUBSCRIPTION HELPERS
// ─────────────────────────────────────────────────────────────

export async function upsertPaddleSubscription(db: Db, data: {
  userId: number;
  plan: "starter" | "professional" | "enterprise" | "medtech";
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused";
  monthlyQuota: number;
  billingCycle: "monthly" | "annual";
  paddleCustomerId: string | null;
  paddleSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}) {
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.paddleSubscriptionId, data.paddleSubscriptionId))
    .limit(1);
  if (existing[0]) {
    await db.update(subscriptions).set({
      plan: data.plan,
      status: data.status,
      monthlyQuota: data.monthlyQuota,
      billingCycle: data.billingCycle,
      paddleCustomerId: data.paddleCustomerId ?? undefined,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
    }).where(eq(subscriptions.id, existing[0].id));
  } else {
    await db.insert(subscriptions).values({
      userId: data.userId,
      plan: data.plan,
      status: data.status,
      monthlyQuota: data.monthlyQuota,
      billingCycle: data.billingCycle,
      paddleCustomerId: data.paddleCustomerId ?? undefined,
      paddleSubscriptionId: data.paddleSubscriptionId,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
    });
  }
}

export async function setSubscriptionStatusByPaddleId(
  db: Db,
  paddleSubscriptionId: string,
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused",
  cancelledAt?: Date,
) {
  await db.update(subscriptions)
    .set({ status, cancelledAt: cancelledAt ?? undefined })
    .where(eq(subscriptions.paddleSubscriptionId, paddleSubscriptionId));
}

export async function getSubscriptionByPaddleSubscriptionId(db: Db, paddleSubscriptionId: string) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paddleSubscriptionId, paddleSubscriptionId))
    .limit(1);
  return result[0];
}

// ─────────────────────────────────────────────────────────────
// REVENUE
// ─────────────────────────────────────────────────────────────

export async function recordRevenue(db: Db, data: any) {
  await db.insert(revenueRecords).values(data);
}

export async function getRevenueAnalytics(db: Db, startDate?: Date, endDate?: Date) {
  let query = db.select().from(revenueRecords);
  if (startDate && endDate) {
    query = query.where(and(gte(revenueRecords.createdAt, startDate), lte(revenueRecords.createdAt, endDate))) as typeof query;
  }
  return await query.orderBy(desc(revenueRecords.createdAt)).limit(2000);
}

// ─────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────

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
    totalRevenue: parseFloat(revenue?.total || "0"),
    totalLeads: leadCount?.count || 0,
    totalNfts: nftCount?.count || 0,
  };
}

export async function getAllUsers(db: Db) {
  return await db.select().from(users).orderBy(desc(users.createdAt)).limit(1000);
}

export async function getSubscriptionAnalytics(db: Db) {
  return await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(5000);
}

export async function getOpenFraudAlerts(db: Db) {
  return await db.select().from(fraudAlerts).where(eq(fraudAlerts.status, "open")).orderBy(desc(fraudAlerts.createdAt));
}

export async function getAllHealthScores(db: Db) {
  return await db.select().from(customerHealthScores).orderBy(desc(customerHealthScores.score)).limit(500);
}
