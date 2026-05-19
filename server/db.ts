import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, and, gte, lte, like, sql, SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
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
  stakingPositions,
  budgetConfig,
  type Product,
  type InsertProduct,
  type InsertNotification,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from './_core/env';

type DrizzleInstance = ReturnType<typeof drizzle>;
let _db: DrizzleInstance | null = null;

export async function getDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    _db = drizzle(pool);
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
  return await db.select().from(users).orderBy(desc(users.createdAt));
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
  const result = await db.insert(stakingPositions).values(data);
  return { id: result[0].insertId, ...data };
}

export async function updateStakingPosition(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stakingPositions).set(data).where(eq(stakingPositions.id, id));
}

// ─── Product Helpers ─────────────────────────────────────────────────────────
export async function createProduct(data: Omit<InsertProduct, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return { id: result[0].insertId };
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

export async function getDueTasks(limit = 10) {
  const d = await getDb();
  return d.select().from(missionTasks).where(eq(missionTasks.status, "pending")).orderBy(missionTasks.order).limit(limit);
}

export async function getRunTaskCount() {
  const d = await getDb();
  const rows = await d.select({ count: sql<number>`count(*)` }).from(missionTasks).where(eq(missionTasks.status, "in_progress"));
  return rows[0]?.count ?? 0;
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
  const rows = await d.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(50);
  return rows;
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
  const result = await d.insert(leads).values(values);
  return { id: result[0].insertId, ...values };
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
  return d.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function updateLeadScore(id: number, score: number) {
  const d = await getDb();
  await d.update(leads).set({ score }).where(eq(leads.id, id));
}

export async function updateLeadStatus(id: number, status: string) {
  const d = await getDb();
  await d.update(leads).set({ status: status as any }).where(eq(leads.id, id));
}

// ─────────────────────────────────────────────────────────────
// SERVICE ORDERS (used by service-orders router)
// ─────────────────────────────────────────────────────────────

export async function createServiceOrder(data: any) {
  const d = await getDb();
  const result = await d.insert(serviceOrders).values(data);
  const id = result[0].insertId;
  return { id, ...data };
}

export async function getServiceOrderBySessionId(sessionId: string) {
  const d = await getDb();
  const rows = await d.select().from(serviceOrders).where(eq(sql`json_extract(details, '$.sessionId')`, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// BUDGET & TASKS
// ─────────────────────────────────────────────────────────────

export async function getBudgetStatus() {
  const d = await getDb();
  const rows = await d.select().from(budgetConfig).limit(1);
  return rows[0] ?? { monthlyLimit: "1000.00", spent: "0.00" };
}

export async function markTaskRunning(id: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function markTaskDone(id: string, result?: any) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "completed", result, updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function markTaskFailed(id: string, error: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "failed", error, updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function enqueueTask(missionId: string, kind: string, payload: any) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missionTasks).values({
    id,
    missionId,
    kind,
    title: kind,
    status: "pending",
    payload,
  });
  return id;
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
  const result = await db.insert(authentications).values(data);
  return { id: result[0].insertId };
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

export async function updateAuthenticationSharing(id: number, isPublic: boolean, shareToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(authentications).set({ isPublic: isPublic ? 1 : 0, shareToken }).where(eq(authentications.id, id));
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
  const result = await db.insert(certificates).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(qrCodes).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(nfts).values(data);
  return { id: result[0].insertId };
}

export async function listCollections() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(nftCollections).orderBy(desc(nftCollections.createdAt));
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
  const result = await db.insert(nftCollections).values(data);
  return { id: result[0].insertId };
}

// ─── Auction Helpers ─────────────────────────────────────────────────────────
export async function createAuction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(auctions).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(subscriptions).values(data);
  return { id: result[0].insertId };
}

export async function updateSubscriptionUsage(userId: number, usedQuota: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set({ usedQuota }).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
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
  const result = await db.insert(invoices).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(payments).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(emailCampaigns).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(emailDrafts).values(data);
  return { id: result[0].insertId };
}

export async function getPendingDrafts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailDrafts).where(eq(emailDrafts.status, "pending")).orderBy(desc(emailDrafts.createdAt));
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
  const result = await db.insert(supplyChainEvents).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(referrals).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(affiliates).values(data);
  return { id: result[0].insertId };
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
  const [result] = await db.insert(autopilotConfig).values(data).onConflictDoUpdate({ target: autopilotConfig.tenantId, set: data }).returning();
  return result?.id;
}

export async function createAutopilotDecision(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(autopilotDecisions).values(data);
  return { id: result[0].insertId };
}

// ─── A/B Test Helpers ────────────────────────────────────────────────────────
export async function createAbTest(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(abTests).values(data);
  return { id: result[0].insertId };
}

export async function getActiveAbTests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(abTests).where(eq(abTests.status, "running")).orderBy(desc(abTests.createdAt));
}

export async function getAllAbTests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(abTests).orderBy(desc(abTests.createdAt));
}

// ─── White Label Helpers ─────────────────────────────────────────────────────
export async function createWhiteLabelClient(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(whiteLabelClients).values(data);
  return { id: result[0].insertId };
}

export async function getWhiteLabelClients() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(whiteLabelClients).orderBy(desc(whiteLabelClients.createdAt));
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
  const result = await db.insert(fraudAlerts).values(data);
  return { id: result[0].insertId };
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
  return await db.select().from(customerHealthScores).orderBy(desc(customerHealthScores.score));
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
  return await query.orderBy(desc(revenueRecords.createdAt));
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
  return await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
}

// ─── Notification Helpers ───────────────────────────────────────────────────
export async function createNotification(data: Omit<InsertNotification, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(data);
  return { id: result[0].insertId };
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
  const result = await db.insert(leads).values({
    email: input.email,
    name: input.name,
    company: input.company,
    title: input.title,
    phone: input.phone,
    source: input.source || "website_form",
    industry: input.industry,
    metadata: input.metadata,
  });
  return { id: result[0].insertId, created: true };
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
  plan: "starter" | "professional" | "enterprise";
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

export async function hasWebhookEventProcessed(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLog)
    .where(sql`JSON_EXTRACT(${activityLog.details}, '$.eventId') = ${eventId}`);
  return (row?.count ?? 0) > 0;
}

// ─── Paddle Subscription Helpers ──────────────────────────────────────────────

export async function upsertPaddleSubscription(data: {
  userId: number;
  plan: "starter" | "professional" | "enterprise";
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused";
  monthlyQuota: number;
  billingCycle: "monthly" | "annual";
  paddleCustomerId: string | null;
  paddleSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}) {
  const db = await getDb();
  if (!db) return;
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
  paddleSubscriptionId: string,
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused",
  cancelledAt?: Date,
) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions)
    .set({ status, cancelledAt: cancelledAt ?? undefined })
    .where(eq(subscriptions.paddleSubscriptionId, paddleSubscriptionId));
}

export async function getSubscriptionByPaddleSubscriptionId(paddleSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paddleSubscriptionId, paddleSubscriptionId))
    .limit(1);
  return result[0];
}
