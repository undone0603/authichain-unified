// server/content-db-helpers.ts
//
// Db-parameterized replacements for the server/db.ts helper functions used
// across the content/comms/composition cluster (server/social-service.ts,
// server/marketing/**, server/hubspot/**, server/gpt/**,
// server/email-drafts/**, server/email-campaigns/**, server/notifications/**,
// server/feedback/**, server/personalization/**, server/character-service.ts,
// server/govchain/**, server/mcp/**, server/internal-api.ts,
// server/dashboard/**, server/blockchain/**, server/analytics/**,
// server/ab-testing/**, server/routers/**, server/autopilot/** — Task 2b-6).
//
// server/db.ts's helpers all close over the module-scope getDb() singleton
// (Node-only, process.env.DATABASE_URL), which is incompatible with
// Cloudflare Workers' per-request env bindings. These do the same queries
// but take an explicit `db` instance (threaded from the caller) instead of
// reaching for the singleton themselves.
//
// Named content-db-helpers.ts (not db-helpers.ts / identity-db-helpers.ts)
// because those names are already taken by Task 2b-4's and Task 2b-5's
// cluster helper files.
import { eq, desc, and, gte, sql } from "drizzle-orm";
import {
  users,
  products,
  certificates,
  authentications,
  nfts,
  activityLog,
  leads,
  emailCampaigns,
  emailDrafts,
  autopilotConfig,
  autopilotDecisions,
  abTests,
  whiteLabelClients,
  notifications,
  type InsertNotification,
  type InsertProduct,
} from "../drizzle/schema";
import type { getHyperdriveDb } from "./db";

export type Db = ReturnType<typeof getHyperdriveDb>;
type FlexibleInsert<T> = T & Record<string, unknown>;
type ActivityPayload = {
  userId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number | string;
  details?: unknown;
};
type LeadInsert = typeof leads.$inferInsert;
type EmailCampaignInsert = typeof emailCampaigns.$inferInsert;
type EmailDraftInsert = typeof emailDrafts.$inferInsert;
type AutopilotConfigInsert = typeof autopilotConfig.$inferInsert;
type AutopilotDecisionInsert = typeof autopilotDecisions.$inferInsert;
type AbTestInsert = typeof abTests.$inferInsert;

// ─────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────

export async function getUserById(db: Db, id: number) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────

export async function getRecentActivity(db: Db, limit = 20) {
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function logActivity(
  db: Db,
  actionOrData: string | ActivityPayload,
  details?: string,
): Promise<void> {
  if (typeof actionOrData === "string") {
    await db.insert(activityLog).values({ action: actionOrData, details: details ? { text: details } : undefined });
  } else {
    await db.insert(activityLog).values({
      userId: actionOrData.userId ?? undefined,
      action: actionOrData.action,
      entityType: actionOrData.entityType,
      entityId: actionOrData.entityId == null ? undefined : String(actionOrData.entityId),
      details: actionOrData.details,
    });
  }
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

// ─────────────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────────────

export async function createLead(db: Db, data: FlexibleInsert<Pick<LeadInsert, "email"> & Partial<Omit<LeadInsert, "email">>>) {
  const values: LeadInsert = {
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

export async function getAllLeads(db: Db) {
  return db.select().from(leads).orderBy(desc(leads.createdAt)).limit(1000);
}

export async function updateLeadScore(db: Db, id: number, score: number) {
  await db.update(leads).set({ score }).where(eq(leads.id, id));
}

export async function updateLeadStatus(db: Db, id: number, status: NonNullable<LeadInsert["status"]>) {
  await db.update(leads).set({ status }).where(eq(leads.id, id));
}

// ─────────────────────────────────────────────────────────────
// PRODUCTS / CERTIFICATES
// ─────────────────────────────────────────────────────────────

export async function getProductById(db: Db, id: string) {
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function createProduct(db: Db, data: Omit<InsertProduct, "id" | "createdAt" | "updatedAt">) {
  const [result] = await db.insert(products).values(data).returning();
  return { id: result.id };
}

export async function getCertificateByNumber(db: Db, certNumber: string) {
  const result = await db.select().from(certificates).where(eq(certificates.certificateNumber, certNumber)).limit(1);
  return result[0];
}

// ─────────────────────────────────────────────────────────────
// EMAIL CAMPAIGNS
// ─────────────────────────────────────────────────────────────

export async function createEmailCampaign(db: Db, data: FlexibleInsert<EmailCampaignInsert>) {
  const [result] = await db.insert(emailCampaigns).values(data).returning();
  return { id: result.id };
}

export async function getUserEmailCampaigns(db: Db, userId: number) {
  return db.select().from(emailCampaigns).where(eq(emailCampaigns.userId, userId)).orderBy(desc(emailCampaigns.createdAt));
}

export async function updateEmailCampaign(db: Db, id: string, data: Partial<EmailCampaignInsert>) {
  await db.update(emailCampaigns).set(data).where(eq(emailCampaigns.id, id));
}

// ─────────────────────────────────────────────────────────────
// EMAIL DRAFTS
// ─────────────────────────────────────────────────────────────

export async function createEmailDraft(db: Db, data: FlexibleInsert<EmailDraftInsert>) {
  const [result] = await db.insert(emailDrafts).values(data).returning();
  return { id: result.id };
}

export async function getPendingDrafts(db: Db) {
  return db.select().from(emailDrafts).where(eq(emailDrafts.status, "pending")).orderBy(desc(emailDrafts.createdAt)).limit(200);
}

export async function updateDraftStatus(db: Db, id: string, status: string, approvedBy?: number) {
  const updateData: Pick<EmailDraftInsert, "status" | "approvedBy" | "approvedAt" | "sentAt"> = { status };
  if (approvedBy) { updateData.approvedBy = approvedBy; updateData.approvedAt = new Date(); }
  if (status === "sent") updateData.sentAt = new Date();
  await db.update(emailDrafts).set(updateData).where(eq(emailDrafts.id, id));
}

// ─────────────────────────────────────────────────────────────
// AUTOPILOT
// ─────────────────────────────────────────────────────────────

export async function getAutopilotConfig(db: Db) {
  const result = await db.select().from(autopilotConfig).orderBy(desc(autopilotConfig.id)).limit(1);
  return result[0];
}

export async function upsertAutopilotConfig(db: Db, data: FlexibleInsert<AutopilotConfigInsert>) {
  const [result] = await db.insert(autopilotConfig).values(data).onConflictDoUpdate({ target: autopilotConfig.tenantId, set: data }).returning();
  return result?.id;
}

export async function createAutopilotDecision(db: Db, data: FlexibleInsert<AutopilotDecisionInsert>) {
  const [result] = await db.insert(autopilotDecisions).values(data).returning();
  return { id: result.id };
}

export async function getRecentDecisions(db: Db, limit = 10) {
  return db.select().from(autopilotDecisions).orderBy(desc(autopilotDecisions.createdAt)).limit(limit);
}

// ─────────────────────────────────────────────────────────────
// A/B TESTS
// ─────────────────────────────────────────────────────────────

export async function createAbTest(db: Db, data: FlexibleInsert<AbTestInsert>) {
  const [result] = await db.insert(abTests).values(data).returning();
  return { id: result.id };
}

export async function getAllAbTests(db: Db) {
  return db.select().from(abTests).orderBy(desc(abTests.createdAt)).limit(200);
}

// ─────────────────────────────────────────────────────────────
// WHITE LABEL
// ─────────────────────────────────────────────────────────────

export async function getWhiteLabelByApiKey(db: Db, apiKey: string) {
  const result = await db.select().from(whiteLabelClients).where(eq(whiteLabelClients.apiKey, apiKey)).limit(1);
  return result[0];
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD METRICS
// ─────────────────────────────────────────────────────────────

export async function getDashboardMetrics(db: Db, userId: number) {
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

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

export async function createNotification(db: Db, data: Omit<InsertNotification, "id" | "createdAt">) {
  const [result] = await db.insert(notifications).values(data).returning();
  return { id: result.id };
}

export async function getUserNotifications(db: Db, userId: number, limit = 50) {
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(db: Db, userId: number) {
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result?.count || 0;
}

export async function markNotificationRead(db: Db, id: string, userId: number) {
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(db: Db, userId: number) {
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteNotification(db: Db, id: string, userId: number) {
  await db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}
