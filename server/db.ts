import { drizzle } from "drizzle-orm/postgres-js";
import type { SQL } from "drizzle-orm";
import {
  eq, desc, and, sql, gte, lte, inArray, like
} from "drizzle-orm";
import type { OrderStatus } from "../shared/const";

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
  missions,
  missionTasks,
  type Product,
  type InsertProduct,
  type InsertNotification,
} from "../drizzle/schema";

import { randomUUID } from "crypto";

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

export async function createSystemNotification(userId: number | null, title: string, message: string, type?: string, actionUrl?: string) {
  const d = await getDb();
  await d.insert(notifications).values({
    userId: userId!,
    type: (type || title) as any,
    title,
    message,
    isRead: 0,
    actionUrl: actionUrl ?? undefined,
  });
}

export async function getAllUsers() {
  const d = await getDb();
  return d.select().from(users);
}

export async function getBudgetStatus(_now?: Date) {
  const now = _now ?? new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const day = `${month}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    llm: { pct: 0, spent: 0, budget: 500 },
    ads: { pct: 0, spent: 0, budget: 300 },
    enrichment: { pct: 0, spent: 0, budget: 200 },
    period: { month, day },
  };
}

export async function getRecentActivity(limit = 20) {
  const d = await getDb();
  return d.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function getRecentDecisions(limit = 10) {
  const d = await getDb();
  return d.select().from(autopilotDecisions).orderBy(desc(autopilotDecisions.createdAt)).limit(limit);
}

export async function logActivity(actionOrData: string | { userId?: number | null; action: string; entityType?: string; entityId?: number; details?: any }, details?: string) {
  const d = await getDb();
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

export async function enqueueTask(missionId: string, title: string, descriptionOrPayload?: string | Record<string, unknown>, orderOrScheduledAt?: number | Date) {
  const d = await getDb();
  const id = randomUUID();
  const description = typeof descriptionOrPayload === "string" ? descriptionOrPayload : (title ?? "");
  const payload = typeof descriptionOrPayload === "object" ? descriptionOrPayload : undefined;
  const order = typeof orderOrScheduledAt === "number" ? orderOrScheduledAt : 0;
  await d.insert(missionTasks).values({
    id,
    missionId,
    title,
    description,
    kind: title,
    payload: payload ?? undefined,
    status: "pending",
    order,
  });
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

// markTaskFailed is defined below with error parameter support

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
  const rows = await d.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(50);
  return rows;
}

// ─────────────────────────────────────────────────────────────
// SERVICE ORDERS (used by service-orders router)
// ─────────────────────────────────────────────────────────────

export async function createServiceOrder(data: any) {
  const d = await getDb();
  const [row] = await d.insert(serviceOrders).values(data).returning();
  const id = row.id;
  return { id, ...data };
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

export async function updateServiceOrderStatus(id: number, status: OrderStatus, extra?: Record<string, any>) {
  const d = await getDb();
  const updateData: any = { status, ...(extra ?? {}) };
  await d.update(serviceOrders).set(updateData).where(eq(serviceOrders.id, id));
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
  return d.select().from(users).where(lte(users.lastSignedIn, cutoff));
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
  return d.select().from(subscriptions).where(eq(subscriptions.status, "past_due"));
}

export async function hasDunningStepLogged(subscriptionId: number, step: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select().from(activityLog)
    .where(and(
      like(activityLog.action, `dunning:${step}:%`),
      sql`JSON_EXTRACT(${activityLog.details}, '$.text') LIKE ${'%sub:' + subscriptionId + '%'}`
    )).limit(1);
  return rows.length > 0;
}

export async function hasUserActionLogged(userId: number, action: string, sinceDaysAgo: number = 365): Promise<boolean> {
  const d = await getDb();
  const since = new Date(Date.now() - sinceDaysAgo * 86400000);
  const rows = await d.select().from(activityLog)
    .where(and(
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

// ─────────────────────────────────────────────────────────────
// USER LOOKUPS
// ─────────────────────────────────────────────────────────────

export async function getUserByOpenId(openId: string) {
  const d = await getDb();
  const rows = await d.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

// Duplicate function implementation.

export async function getAllAdminIds(): Promise<number[]> {
  const d = await getDb();
  const rows = await d.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return rows.map(r => r.id);
}

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────

export async function getUserProducts(userId: number) {
  const d = await getDb();
  return d.select().from(products).where(eq(products.userId, userId)).orderBy(desc(products.createdAt));
}

export async function getProductById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createProduct(data: any) {
  const d = await getDb();
  const [row] = await d.insert(products).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

export async function updateProduct(id: number, data: any) {
  const d = await getDb();
  await d.update(products).set(data).where(eq(products.id, id));
}

// ─────────────────────────────────────────────────────────────
// AUTHENTICATIONS
// ─────────────────────────────────────────────────────────────

export async function createAuthentication(data: any) {
  const d = await getDb();
  const [row] = await d.insert(authentications).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

export async function getUserAuthentications(userId: number) {
  const d = await getDb();
  return d.select().from(authentications).where(eq(authentications.userId, userId)).orderBy(desc(authentications.createdAt));
}

export async function getAuthenticationByShareToken(shareToken: string) {
  const d = await getDb();
  const rows = await d.select().from(authentications).where(eq(authentications.shareToken, shareToken)).limit(1);
  return rows[0] ?? null;
}

export async function updateAuthenticationSharing(authenticationId: number, isPublic: boolean, shareToken: string) {
  const d = await getDb();
  await d.update(authentications).set({
    isPublic: isPublic ? 1 : 0,
    shareToken,
  }).where(eq(authentications.id, authenticationId));
}

export async function incrementShareCount(authenticationId: number) {
  const d = await getDb();
  await d.update(authentications).set({
    shareCount: sql`${authentications.shareCount} + 1`,
  }).where(eq(authentications.id, authenticationId));
}

// ─────────────────────────────────────────────────────────────
// CERTIFICATES
// ─────────────────────────────────────────────────────────────

export async function getUserCertificates(userId: number) {
  const d = await getDb();
  return d.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.createdAt));
}

export async function getCertificateByNumber(certificateNumber: string) {
  const d = await getDb();
  const rows = await d.select().from(certificates).where(eq(certificates.certificateNumber, certificateNumber)).limit(1);
  return rows[0] ?? null;
}

export async function createCertificate(data: any) {
  const d = await getDb();
  const [row] = await d.insert(certificates).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────

export async function getUserSubscription(userId: number) {
  const d = await getDb();
  const rows = await d.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function createSubscription(data: any) {
  const d = await getDb();
  const [row] = await d.insert(subscriptions).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// Duplicate implementation removed.

export async function updateSubscriptionUsage(userId: number, usedQuota: number) {
  const d = await getDb();
  await d.update(subscriptions).set({ usedQuota }).where(eq(subscriptions.userId, userId));
}

// ─────────────────────────────────────────────────────────────
// USAGE RECORDS
// ─────────────────────────────────────────────────────────────

export async function recordUsage(data: any) {
  const d = await getDb();
  await d.insert(usageRecords).values(data);
}

// ─────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────

export async function getUserInvoices(userId: number) {
  const d = await getDb();
  return d.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
}

// ─────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────

export async function getUserPayments(userId: number) {
  const d = await getDb();
  return d.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
}

export async function createPayment(data: any) {
  const d = await getDb();
  const [row] = await d.insert(payments).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// QR CODES
// ─────────────────────────────────────────────────────────────

export async function createQrCode(data: any) {
  const d = await getDb();
  const [row] = await d.insert(qrCodes).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

export async function getProductQrCodes(productId: number) {
  const d = await getDb();
  return d.select().from(qrCodes).where(eq(qrCodes.productId, productId)).orderBy(desc(qrCodes.createdAt));
}

export async function incrementScanCount(qrCodeId: number) {
  const d = await getDb();
  await d.update(qrCodes).set({
    scanCount: sql`${qrCodes.scanCount} + 1`,
    lastScannedAt: new Date(),
  }).where(eq(qrCodes.id, qrCodeId));
}

// ─────────────────────────────────────────────────────────────
// NFTS
// ─────────────────────────────────────────────────────────────

export async function listNfts(filters?: { collectionId?: number; status?: string; limit?: number }) {
  const d = await getDb();
  const conditions: any[] = [];
  if (filters?.collectionId) conditions.push(eq(nfts.collectionId, filters.collectionId));
  if (filters?.status) conditions.push(eq(nfts.status, filters.status as any));
  const query = d.select().from(nfts);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(nfts.createdAt)).limit(filters?.limit ?? 50);
  }
  return query.orderBy(desc(nfts.createdAt)).limit(filters?.limit ?? 50);
}

export async function getNftById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(nfts).where(eq(nfts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createNft(data: any) {
  const d = await getDb();
  const [row] = await d.insert(nfts).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// NFT COLLECTIONS
// ─────────────────────────────────────────────────────────────

export async function listCollections() {
  const d = await getDb();
  return d.select().from(nftCollections).orderBy(desc(nftCollections.createdAt));
}

export async function getCollectionBySlug(slug: string) {
  const d = await getDb();
  const rows = await d.select().from(nftCollections).where(eq(nftCollections.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function createCollection(data: any) {
  const d = await getDb();
  const [row] = await d.insert(nftCollections).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// AUCTIONS
// ─────────────────────────────────────────────────────────────

export async function getActiveAuctions() {
  const d = await getDb();
  return d.select().from(auctions).where(eq(auctions.status, "active")).orderBy(desc(auctions.createdAt));
}

export async function getAuctionById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAuctionBids(auctionId: number) {
  const d = await getDb();
  return d.select().from(auctionBids).where(eq(auctionBids.auctionId, auctionId)).orderBy(desc(auctionBids.amount));
}

export async function createAuction(data: any) {
  const d = await getDb();
  const [row] = await d.insert(auctions).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

export async function placeBid(auctionId: number, bidderId: number, amount: string) {
  const d = await getDb();
  await d.insert(auctionBids).values({ auctionId, bidderId, amount });
  await d.update(auctions).set({
    currentBid: amount,
    highestBidderId: bidderId,
    bidCount: sql`${auctions.bidCount} + 1`,
  }).where(eq(auctions.id, auctionId));
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

export async function getUserNotifications(userId: number, limit = 50) {
  const d = await getDb();
  return d.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const d = await getDb();
  const rows = await d.select({ count: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
  return rows[0]?.count ?? 0;
}

export async function markNotificationRead(id: number, userId: number) {
  const d = await getDb();
  await d.update(notifications).set({ isRead: 1 }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const d = await getDb();
  await d.update(notifications).set({ isRead: 1 }).where(eq(notifications.userId, userId));
}

export async function deleteNotification(id: number, userId: number) {
  const d = await getDb();
  await d.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function createNotification(data: any) {
  const d = await getDb();
  const [row] = await d.insert(notifications).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// REFERRALS
// ─────────────────────────────────────────────────────────────

export async function getUserReferrals(userId: number) {
  const d = await getDb();
  return d.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
}

export async function getReferralByCode(code: string) {
  const d = await getDb();
  const rows = await d.select().from(referrals).where(eq(referrals.referralCode, code)).limit(1);
  return rows[0] ?? null;
}

export async function createReferral(data: any) {
  const d = await getDb();
  const [row] = await d.insert(referrals).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// AFFILIATES
// ─────────────────────────────────────────────────────────────

export async function getAffiliateByUserId(userId: number) {
  const d = await getDb();
  const rows = await d.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getAffiliateCommissions(affiliateId: number) {
  const d = await getDb();
  return d.select().from(affiliateCommissions).where(eq(affiliateCommissions.affiliateId, affiliateId)).orderBy(desc(affiliateCommissions.createdAt));
}

export async function createAffiliate(data: any) {
  const d = await getDb();
  const [row] = await d.insert(affiliates).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// AUTOPILOT
// ─────────────────────────────────────────────────────────────

export async function getAutopilotConfig() {
  const d = await getDb();
  const rows = await d.select().from(autopilotConfig).orderBy(desc(autopilotConfig.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function upsertAutopilotConfig(data: any) {
  const d = await getDb();
  const existing = await d.select().from(autopilotConfig).limit(1);
  if (existing.length === 0) {
    await d.insert(autopilotConfig).values(data);
  } else {
    await d.update(autopilotConfig).set(data).where(eq(autopilotConfig.id, existing[0].id));
  }
}

export async function getAutopilotDecisions(limit = 20) {
  const d = await getDb();
  return d.select().from(autopilotDecisions).orderBy(desc(autopilotDecisions.createdAt)).limit(limit);
}

export async function getAutopilotDecisionCountByMonth(type: string) {
  const d = await getDb();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await d.select({ count: sql<number>`count(*)` })
    .from(autopilotDecisions)
    .where(and(
      eq(autopilotDecisions.type, type),
      gte(autopilotDecisions.createdAt, startOfMonth)
    ));

  return { data: result[0]?.count ?? 0 };
}

export async function createAutopilotDecision(data: any) {
  const d = await getDb();
  const [row] = await d.insert(autopilotDecisions).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// A/B TESTING
// ─────────────────────────────────────────────────────────────

export async function getAllAbTests() {
  const d = await getDb();
  return d.select().from(abTests).orderBy(desc(abTests.createdAt));
}

export async function createAbTest(data: any) {
  const d = await getDb();
  const [row] = await d.insert(abTests).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// WHITE LABEL
// ─────────────────────────────────────────────────────────────

export async function getWhiteLabelClients() {
  const d = await getDb();
  return d.select().from(whiteLabelClients).orderBy(desc(whiteLabelClients.createdAt));
}

export async function createWhiteLabelClient(data: any) {
  const d = await getDb();
  const [row] = await d.insert(whiteLabelClients).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

export async function getWhiteLabelByApiKey(apiKey: string) {
  const d = await getDb();
  const rows = await d.select().from(whiteLabelClients).where(eq(whiteLabelClients.apiKey, apiKey)).limit(1);
  return rows[0] ?? null;
}

export async function setVendorKycStatus(stripeAccountId: string, status: string) {
  const d = await getDb();
  await d.update(whiteLabelClients)
    .set({ features: sql`json_set(COALESCE(features, '{}'), '$.kyc_status', ${status})` })
    .where(eq(whiteLabelClients.apiSecret, stripeAccountId));
}

export async function setVendorBillingStatus(stripeSubscriptionId: string, status: string) {
  const d = await getDb();
  await d.update(whiteLabelClients)
    .set({ features: sql`json_set(COALESCE(features, '{}'), '$.billing_status', ${status})` })
    .where(eq(whiteLabelClients.apiSecret, stripeSubscriptionId)); // Note: implementation assumes sub ID might be stored or linked
}

// ─────────────────────────────────────────────────────────────
// LEADS / MARKETING
// ─────────────────────────────────────────────────────────────

export async function getAllLeads() {
  const d = await getDb();
  return d.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function createLead(data: any) {
  const d = await getDb();
  const [row] = await d.insert(leads).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

export async function updateLeadScore(id: number, score: number) {
  const d = await getDb();
  await d.update(leads).set({ score }).where(eq(leads.id, id));
}

export async function updateLeadStatus(id: number, status: string) {
  const d = await getDb();
  await d.update(leads).set({ status: status as any, updatedAt: new Date() }).where(eq(leads.id, id));
}

export async function updateLeadStatusByEmail(email: string, status: string) {
  const d = await getDb();
  await d.update(leads)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(leads.email, email.toLowerCase()));
}

// ─────────────────────────────────────────────────────────────
// EMAIL CAMPAIGNS
// ─────────────────────────────────────────────────────────────

export async function getUserEmailCampaigns(userId: number) {
  const d = await getDb();
  return d.select().from(emailCampaigns).where(eq(emailCampaigns.userId, userId)).orderBy(desc(emailCampaigns.createdAt));
}

export async function createEmailCampaign(data: any) {
  const d = await getDb();
  const [row] = await d.insert(emailCampaigns).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// EMAIL DRAFTS
// ─────────────────────────────────────────────────────────────

export async function getPendingDrafts() {
  const d = await getDb();
  return d.select().from(emailDrafts).where(eq(emailDrafts.status, "pending")).orderBy(desc(emailDrafts.createdAt));
}

export async function createEmailDraft(data: any) {
  const d = await getDb();
  const [row] = await d.insert(emailDrafts).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

export async function updateDraftStatus(id: number, status: string, approvedBy?: number) {
  const d = await getDb();
  const updateData: any = { status: status as any };
  if (approvedBy !== undefined) {
    updateData.approvedBy = approvedBy;
    if (status === "approved" || status === "sent") updateData.approvedAt = new Date();
    if (status === "sent") updateData.sentAt = new Date();
  }
  await d.update(emailDrafts).set(updateData).where(eq(emailDrafts.id, id));
}

export async function sendApprovalEmail(to: string, subject: string, body: string) {
  // Placeholder — actual email sending is handled by the email service
  console.log(`[EmailDrafts] Sending approved email to ${to}: ${subject}`);
}

// ─────────────────────────────────────────────────────────────
// SUPPLY CHAIN
// ─────────────────────────────────────────────────────────────

export async function getProductSupplyChain(productId: number) {
  const d = await getDb();
  return d.select().from(supplyChainEvents).where(eq(supplyChainEvents.productId, productId)).orderBy(desc(supplyChainEvents.createdAt));
}

export async function createSupplyChainEvent(data: any) {
  const d = await getDb();
  const [row] = await d.insert(supplyChainEvents).values(data).returning();
  const id = row.id;
  return { id, ...data };
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD METRICS
// ─────────────────────────────────────────────────────────────

export async function getDashboardMetrics(userId: number) {
  const d = await getDb();
  const [productRows, authRows, certRows, subRows] = await Promise.all([
    d.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.userId, userId)),
    d.select({ count: sql<number>`count(*)` }).from(authentications).where(eq(authentications.userId, userId)),
    d.select({ count: sql<number>`count(*)` }).from(certificates).where(eq(certificates.userId, userId)),
    d.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1),
  ]);
  return {
    totalProducts: productRows[0]?.count ?? 0,
    totalAuthentications: authRows[0]?.count ?? 0,
    totalCertificates: certRows[0]?.count ?? 0,
    subscription: subRows[0] ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// ADMIN ANALYTICS
// ─────────────────────────────────────────────────────────────

export async function getAdminDashboardMetrics() {
  const d = await getDb();
  const [userCount, productCount, authCount, certCount, subCount] = await Promise.all([
    d.select({ count: sql<number>`count(*)` }).from(users),
    d.select({ count: sql<number>`count(*)` }).from(products),
    d.select({ count: sql<number>`count(*)` }).from(authentications),
    d.select({ count: sql<number>`count(*)` }).from(certificates),
    d.select({ count: sql<number>`count(*)` }).from(subscriptions),
  ]);
  return {
    totalUsers: userCount[0]?.count ?? 0,
    totalProducts: productCount[0]?.count ?? 0,
    totalAuthentications: authCount[0]?.count ?? 0,
    totalCertificates: certCount[0]?.count ?? 0,
    totalSubscriptions: subCount[0]?.count ?? 0,
  };
}

export async function getRevenueAnalytics(startDate?: Date, endDate?: Date) {
  const d = await getDb();
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(revenueRecords.createdAt, startDate));
  if (endDate) conditions.push(lte(revenueRecords.createdAt, endDate));
  if (conditions.length > 0) {
    return d.select().from(revenueRecords).where(and(...conditions)).orderBy(desc(revenueRecords.createdAt));
  }
  return d.select().from(revenueRecords).orderBy(desc(revenueRecords.createdAt));
}

export async function getOpenFraudAlerts() {
  const d = await getDb();
  return d.select().from(fraudAlerts).where(eq(fraudAlerts.status, "open")).orderBy(desc(fraudAlerts.createdAt));
}

export async function getAllHealthScores() {
  const d = await getDb();
  return d.select().from(customerHealthScores).orderBy(desc(customerHealthScores.lastCalculatedAt));
}

export async function getSubscriptionAnalytics() {
  const d = await getDb();
  const [total, active, cancelled, pastDue] = await Promise.all([
    d.select({ count: sql<number>`count(*)` }).from(subscriptions),
    d.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, "active")),
    d.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, "cancelled")),
    d.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, "past_due")),
  ]);
  return {
    total: total[0]?.count ?? 0,
    active: active[0]?.count ?? 0,
    cancelled: cancelled[0]?.count ?? 0,
    pastDue: pastDue[0]?.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// SERVICE ORDER SESSION LOOKUP
// ─────────────────────────────────────────────────────────────

export async function getServiceOrderBySessionId(sessionId: string) {
  const d = await getDb();
  const rows = await d.select().from(serviceOrders).where(eq(serviceOrders.stripeSessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// STRIPE WEBHOOK HELPERS
// ─────────────────────────────────────────────────────────────

export async function logAutomationAudit(action: string, details: Record<string, unknown>, userId?: number) {
  const d = await getDb();
  await d.insert(activityLog).values({
    userId: userId ?? undefined,
    action: `audit:${action}`,
    entityType: "automation",
    details,
  });
}

export async function recordRevenue(data: { source: string; amount: string; currency: string; type: string; userId: number | null; metadata?: Record<string, unknown> }) {
  const d = await getDb();
  await d.insert(revenueRecords).values({
    source: data.source,
    amount: data.amount,
    currency: data.currency,
    type: data.type as any,
    userId: data.userId ?? undefined,
    metadata: data.metadata,
  });
}

export async function upsertStripeSubscription(data: {
  userId: number;
  plan: string;
  status: string;
  monthlyQuota: number;
  billingCycle: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
}) {
  const d = await getDb();
  const existing = await d.select().from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, data.stripeSubscriptionId))
    .limit(1);

  if (existing.length === 0) {
    await d.insert(subscriptions).values({
      userId: data.userId,
      plan: data.plan as any,
      status: data.status as any,
      monthlyQuota: data.monthlyQuota,
      billingCycle: data.billingCycle as any,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt,
    });
  } else {
    await d.update(subscriptions).set({
      plan: data.plan as any,
      status: data.status as any,
      monthlyQuota: data.monthlyQuota,
      billingCycle: data.billingCycle as any,
      stripeCustomerId: data.stripeCustomerId,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt,
    }).where(eq(subscriptions.stripeSubscriptionId, data.stripeSubscriptionId));
  }
}

export async function setSubscriptionStatusByStripeId(stripeSubscriptionId: string, status: string, cancelledAt?: Date) {
  const d = await getDb();
  const updateData: any = { status: status as any };
  if (cancelledAt) updateData.cancelledAt = cancelledAt;
  await d.update(subscriptions).set(updateData).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
  const d = await getDb();
  const rows = await d.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId)).limit(1);
  return rows[0] ?? null;
}

export async function hasWebhookEventProcessed(eventId: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select().from(activityLog)
    .where(like(activityLog.action, `audit:%`))
    .limit(100);
  return rows.some(r => {
    const details = r.details as any;
    return details?.eventId === eventId;
  });
}

// ─────────────────────────────────────────────────────────────
// REVENUE ORCHESTRATOR HELPERS
// ─────────────────────────────────────────────────────────────

export function computeLeadScore(signals: { segmentFit?: number; intent?: number; urgency?: number; budgetProxy?: number }) {
  const weights = { segmentFit: 30, intent: 30, urgency: 20, budgetProxy: 20 };
  const score = Math.round(
    (signals.segmentFit ?? 50) * (weights.segmentFit / 100) +
    (signals.intent ?? 50) * (weights.intent / 100) +
    (signals.urgency ?? 50) * (weights.urgency / 100) +
    (signals.budgetProxy ?? 50) * (weights.budgetProxy / 100)
  );
  const band = score >= 80 ? "hot" : score >= 50 ? "warm" : "cold";
  const route = score >= 80 ? "immediate_outreach" : score >= 50 ? "nurture_sequence" : "monitor";
  return { score, band, route };
}

export async function upsertLeadByEmail(data: {
  email: string;
  name?: string;
  company?: string;
  title?: string;
  phone?: string;
  source?: string;
  industry?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: number; created: boolean }> {
  const d = await getDb();
  const existing = await d.select().from(leads).where(eq(leads.email, data.email)).limit(1);
  if (existing.length > 0) {
    await d.update(leads).set({
      name: data.name ?? existing[0].name,
      company: data.company ?? existing[0].company,
      title: data.title ?? existing[0].title,
      phone: data.phone ?? existing[0].phone,
      source: data.source ?? existing[0].source,
      industry: data.industry ?? existing[0].industry,
    }).where(eq(leads.email, data.email));
    return { id: existing[0].id, created: false };
  }
  const [row] = await d.insert(leads).values({
    email: data.email,
    name: data.name,
    company: data.company,
    title: data.title,
    phone: data.phone,
    source: data.source ?? "website_form",
    industry: data.industry,
    status: "new",
  }).returning();
  return { id: row.id, created: true };
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS SNAPSHOT HELPERS
// ─────────────────────────────────────────────────────────────

export async function getAcceptanceCriteriaStatus() {
  return { criteriaCount: 0, metCount: 0, details: [] as any[] };
}

export async function getFunnelBySegmentAndChannel() {
  return [] as Array<{ segment: string; channel: string; leads: number; converted: number }>;
}

export async function getLeadCohorts() {
  return [] as Array<{ cohort: string; size: number; convertedPct: number }>;
}

// ─────────────────────────────────────────────────────────────
// TASK RUNNER HELPERS
// ─────────────────────────────────────────────────────────────

export async function markTaskFailed(id: string, error?: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "failed", lastError: error ?? null }).where(eq(missionTasks.id, id));
}

