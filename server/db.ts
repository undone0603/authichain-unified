import { drizzle } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import {
  eq,
  desc,
  and,
  sql,
  gte,
  lte,
  inArray,
  like,
} from "drizzle-orm";

import { Admin, MissionTask } from "../drizzle";
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

// ─── Internal singleton state ────────────────────────────────────────────────

let _db: DrizzleInstance | null = null;

/**
 * Low-level factory for creating a Drizzle instance.
 * Prefer using `getDb()` unless you explicitly need a custom instance.
 */
export function createDb(connectionString: string): DrizzleInstance {
  if (!connectionString) {
    throw new Error("[Database] Missing connection string");
  }
  return drizzle(connectionString);
}

/**
 * Lazily initializes and returns the shared Drizzle instance.
 * Throws if the database cannot be initialized.
 */
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

/**
 * Synchronous proxy for feature modules.
 * Ensures that any attempt to use `db` before initialization fails loudly.
 *
 * In long-running environments, call `await getDb()` during startup
 * to guarantee availability before handling requests.
 */
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

// ─── User helpers ────────────────────────────────────────────────────────────

/**
 * Upserts a user by openId.
 * - Requires `user.openId`
 * - Normalizes nullable text fields
 * - Automatically sets `lastSignedIn`
 * - Grants admin role to ENV.ownerOpenId if no explicit role is provided
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("[Database] User openId is required for upsert");
  }

  const db = await getDb();

  const values: InsertUser = {
    openId: user.openId,
  };

  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) {
    const now = new Date();
    values.lastSignedIn = now;
    if (!updateSet.lastSignedIn) {
      updateSet.lastSignedIn = now;
    }
  }

  // If nothing but openId is provided, still update lastSignedIn
  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = values.lastSignedIn ?? new Date();
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, user.openId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(users).values(values);
  } else {
    await db
      .update(users)
      .set(updateSet)
      .where(eq(users.openId, user.openId));
  }
}

// ─── Example exports for other domains (types only, no logic here) ───────────

// Re-export commonly used types so feature modules don’t need to reach
// into `../drizzle/schema` directly if you want a narrower surface.
export type {
  Product,
  InsertProduct,
  InsertNotification,
  SQL,
};

// You can gradually move domain-specific helpers (revenue, NFT, autopilot, etc.)
// into their own modules (e.g. `server/revenue/revenue.db.ts`) and keep this
// file focused on connection + very core primitives only.
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

// ─── Product Helpers ─────────────────────────────────────────────────────────
export async function createProduct(data: Omit<InsertProduct, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data as any);
  return { id: result[0].insertId };
}

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
  const conditions: any[] = [];
  if (filters?.collectionId) conditions.push(eq(nfts.collectionId, filters.collectionId));
  if (filters?.status) conditions.push(eq(nfts.status, filters.status as any));
  if (conditions.length) query = query.where(and(...conditions)) as any;
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

// ─── Lead Helpers ────────────────────────────────────────────────────────────
export async function createLead(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leads).values(data);
  return { id: result[0].insertId };
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function updateLeadScore(id: number, score: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set({ score }).where(eq(leads.id, id));
}

export async function updateLeadStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set({ status: status as any }).where(eq(leads.id, id));
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
  const existing = await getAutopilotConfig();
  if (existing) {
    await db.update(autopilotConfig).set(data).where(eq(autopilotConfig.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(autopilotConfig).values(data);
  return result[0].insertId;
}

export async function createAutopilotDecision(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(autopilotDecisions).values(data);
  return { id: result[0].insertId };
}

export async function getRecentDecisions(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(autopilotDecisions).orderBy(desc(autopilotDecisions.createdAt)).limit(limit);
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

// ─── Activity Log Helpers ────────────────────────────────────────────────────
export async function logActivity(data: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values(data);
}

export async function getRecentActivity(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
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
  const existing = await db.select().from(customerHealthScores).where(eq(customerHealthScores.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(customerHealthScores).set({ score, factors, trend: trend as any, lastCalculatedAt: new Date() }).where(eq(customerHealthScores.userId, userId));
  } else {
    await db.insert(customerHealthScores).values({ userId, score, factors, trend: trend as any });
  }
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
    query = query.where(and(gte(revenueRecords.createdAt, startDate), lte(revenueRecords.createdAt, endDate))) as any;
  }
  return await query.orderBy(desc(revenueRecords.createdAt));
}

// ─── Dashboard Metrics ───────────────────────────────────────────────────────
export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db) return { totalProducts: 0, totalAuthentications: 0, totalCertificates: 0, totalNfts: 0 };
  const [prods] = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.userId, userId));
  const [auths] = await db.select({ count: sql<number>`count(*)` }).from(authentications).where(eq(authentications.userId, userId));
  const [certs] = await db.select({ count: sql<number>`count(*)` }).from(certificates).where(eq(certificates.userId, userId));
  const [nftCount] = await db.select({ count: sql<number>`count(*)` }).from(nfts).where(eq(nfts.ownerId, userId));
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
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [prodCount] = await db.select({ count: sql<number>`count(*)` }).from(products);
  const [authCount] = await db.select({ count: sql<number>`count(*)` }).from(authentications);
  const [leadCount] = await db.select({ count: sql<number>`count(*)` }).from(leads);
  const [nftCount] = await db.select({ count: sql<number>`count(*)` }).from(nfts);
  const [revenue] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(revenueRecords);
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
  const result = await db.insert(notifications).values(data as any);
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
  const { eq: eqOp, and: andOp } = await import("drizzle-orm");
  await db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function createSystemNotification(userId: number, title: string, message: string, type: InsertNotification["type"], actionUrl?: string) {
  return createNotification({ userId, type: type as any, title, message, isRead: 0, actionUrl });
}


// ─── Service Order Helpers ──────────────────────────────────────────────────
export async function createServiceOrder(data: {
  userId?: number;
  customerEmail: string;
  customerName?: string;
  customerCompany?: string;
  customerPhone?: string;
  serviceType: string;
  amount: number;
  stripeSessionId?: string;
  businessName?: string;
  businessType?: string;
  businessUrl?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(serviceOrders).values(data as any);
  return { id: Number(result[0].insertId) };
}

export async function getServiceOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getServiceOrderBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(serviceOrders).where(eq(serviceOrders.stripeSessionId, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getServiceOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceOrders).where(eq(serviceOrders.userId, userId)).orderBy(desc(serviceOrders.createdAt));
}

export async function getAllServiceOrders() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
}

export async function updateServiceOrderStatus(id: number, status: string, extra?: { stripePaymentIntentId?: string; deliveryUrl?: string; deliveredAt?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(serviceOrders).set({ status: status as any, ...extra }).where(eq(serviceOrders.id, id));
}

// ─── Email Dispatch (routable via db mock in tests) ──────────────────────────

export async function sendApprovalEmail(to: string, subject: string, html: string): Promise<void> {
  const { sendEmail } = await import("./email/smtp");
  await sendEmail({ to, subject, html });
}

// ─── Missions / Tasks (stub — real impl requires DB migration) ────────────────

export async function getMissions(statusFilter?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  // TODO: implement with missions table once migrated
  return [];
}

export async function getMissionById(id: string): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  return null;
}

export async function createMission(type: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // TODO: insert into missions table and seed tasks via templates
  return crypto.randomUUID();
}

export async function updateMissionStatus(id: string, status: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // TODO: update missions table
}

export async function getTasksByMission(missionId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return [];
}

export async function retryTask(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // TODO: reset task status to PENDING
}

// ── Mission task helpers ─────────────────────────────────────────────────────

export async function getDueTasks(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(
      sql`SELECT * FROM mission_tasks WHERE status IN ('PENDING','RETRY') AND (run_at IS NULL OR run_at <= NOW()) ORDER BY run_at ASC LIMIT 20`,
    );
    return (rows as any[][])[0] ?? [];
  } catch { return []; }
}

export async function getRunTaskCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const rows = await db.execute(sql`SELECT COUNT(*) AS cnt FROM mission_tasks WHERE status='DONE'`);
    return Number(((rows as any[][])[0]?.[0] as any)?.cnt ?? 0);
  } catch { return 0; }
}

export async function getActiveMissionTypes(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`SELECT type FROM missions WHERE status='IN_PROGRESS'`);
    return ((rows as any[][])[0] ?? []).map((r: any) => r.type);
  } catch { return []; }
}

export async function markTaskRunning(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`UPDATE mission_tasks SET status='RUNNING', started_at=NOW() WHERE id=${id}`);
  } catch { /* ignore */ }
}

export async function markTaskDone(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`UPDATE mission_tasks SET status='DONE', finished_at=NOW() WHERE id=${id} AND status='RUNNING'`);
  } catch { /* ignore */ }
}

export async function markTaskFailed(id: string, message: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`UPDATE mission_tasks SET status='FAILED', error=${message}, finished_at=NOW() WHERE id=${id}`);
  } catch { /* ignore */ }
}

export async function markTaskWaitingHuman(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`UPDATE mission_tasks SET status='WAITING_HUMAN' WHERE id=${id}`);
  } catch { /* ignore */ }
}

export async function enqueueTask(
  missionId: string,
  kind: string,
  payload: Record<string, unknown>,
  runAt?: Date,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const id = crypto.randomUUID();
  try {
    if (runAt) {
      await db.execute(sql`INSERT INTO mission_tasks (id, mission_id, kind, payload, status, run_at, created_at) VALUES (${id}, ${missionId}, ${kind}, ${JSON.stringify(payload)}, 'PENDING', ${runAt}, NOW())`);
    } else {
      await db.execute(sql`INSERT INTO mission_tasks (id, mission_id, kind, payload, status, created_at) VALUES (${id}, ${missionId}, ${kind}, ${JSON.stringify(payload)}, 'PENDING', NOW())`);
    }
  } catch { /* ignore */ }
}

export async function createProposal(data: {
  missionId: string;
  prospectEmail: string;
  subject: string;
  body: string;
  amount?: number;
  currency?: string;
  stripeSessionId?: string;
}): Promise<string> {
  const db = await getDb();
  if (!db) return crypto.randomUUID();
  const id = crypto.randomUUID();
  try {
    await db.execute(sql`INSERT INTO proposals (id, mission_id, prospect_email, subject, body, amount, currency, stripe_session_id, status, created_at) VALUES (${id}, ${data.missionId}, ${data.prospectEmail}, ${data.subject}, ${data.body}, ${data.amount ?? null}, ${data.currency ?? 'USD'}, ${data.stripeSessionId ?? null}, 'DRAFT', NOW())`);
  } catch { /* ignore */ }
  return id;
}

export async function getAdaptivePriors(): Promise<Record<string, { alpha: number; beta: number }>> {
  // Return static priors; in future these could be updated from activity_log outcomes
  const { SEGMENT_PRIORS } = await import("./_core/bayesian");
  return SEGMENT_PRIORS as Record<string, { alpha: number; beta: number }>;
}

// ── Reporting helpers ────────────────────────────────────────────────────────

export async function hasActionLogged(action: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(eq(activityLog.action, action))
    .limit(1);
  return rows.length > 0;
}

export async function getWeeklyRevenueDigest() {
  const db = await getDb();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const leadsThisWeek = db
    ? (await db.select({ id: leads.id }).from(leads).where(gte(leads.createdAt, oneWeekAgo))).length
    : 0;
  const mrrRows = db
    ? await db
        .select({ amount: revenueRecords.amount })
        .from(revenueRecords)
        .where(gte(revenueRecords.createdAt, new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
    : [];
  const mrr = mrrRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const totalSubs = db ? (await db.select({ id: subscriptions.id }).from(subscriptions)).length : 0;

  return {
    leads: leadsThisWeek,
    mqlToSql: 0,
    demosBooked: 0,
    trialToPaid: 0,
    churn: 0,
    mrr: mrr.toFixed(2),
    arpa: totalSubs > 0 ? (mrr / totalSubs).toFixed(2) : "0.00",
  };
}

export async function getQuarterlyValueReport() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const period = `${now.getFullYear()}-Q${q}`;

  const db = await getDb();
  const quarterStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
  const revenueRows = db
    ? await db
        .select({ amount: revenueRecords.amount })
        .from(revenueRecords)
        .where(gte(revenueRecords.createdAt, quarterStart))
    : [];
  const revenue = revenueRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  return {
    period,
    revenue: revenue.toFixed(2),
    roiSummary: `Q${q} ${now.getFullYear()}: $${revenue.toFixed(0)} revenue generated via autonomous pipeline.`,
  };
}

// ── Budget monitoring ────────────────────────────────────────────────────────

export async function getBudgetStatus(_now?: Date) {
  const db = await getDb();
  const now = _now ?? new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const dayKey = `${monthKey}-${String(now.getUTCDate()).padStart(2, "0")}`;

  // Tally spend from activity log by action prefix
  let llmSpent = 0;
  let adsSpent = 0;
  let enrichmentSpent = 0;

  if (db) {
    const rows = await db
      .select({ action: activityLog.action, details: activityLog.details })
      .from(activityLog)
      .where(like(activityLog.action, "spend_%"));

    for (const row of rows) {
      const d = (row.details ?? {}) as any;
      const amount = Number(d.usd ?? 0);
      if (row.action?.startsWith("spend_llm")) llmSpent += amount;
      if (row.action?.startsWith("spend_ads")) adsSpent += amount;
      if (row.action?.startsWith("spend_enrichment")) enrichmentSpent += amount;
    }
  }

  const llmBudget = ENV.llmMonthlyBudgetUsd;
  const adsBudget = ENV.adsDailyCapUsd;
  const enrichmentBudget = ENV.enrichmentMonthlyCapUsd;

  return {
    period: { month: monthKey, day: dayKey },
    llm: { spent: llmSpent, budget: llmBudget, pct: llmBudget > 0 ? Math.round((llmSpent / llmBudget) * 100) : 0 },
    ads: { spent: adsSpent, budget: adsBudget, pct: adsBudget > 0 ? Math.round((adsSpent / adsBudget) * 100) : 0 },
    enrichment: { spent: enrichmentSpent, budget: enrichmentBudget, pct: enrichmentBudget > 0 ? Math.round((enrichmentSpent / enrichmentBudget) * 100) : 0 },
  };
}

// ── Dunning helpers ──────────────────────────────────────────────────────────

export async function listPastDueSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.status, "past_due"));
}

export async function hasDunningStepLogged(subscriptionId: number, step: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const action = `billing_dunning_${step}`;
  const rows = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.entityType, "subscription"),
        eq(activityLog.entityId, subscriptionId),
        eq(activityLog.action, action),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ── Retention helpers ────────────────────────────────────────────────────────

export async function hasUserActionLogged(userId: number, action: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(and(eq(activityLog.userId, userId), eq(activityLog.action, action)))
    .limit(1);
  return rows.length > 0;
}

export async function listUsersForOnboardingStep(daysSinceSignup: number) {
  const db = await getDb();
  if (!db) return [];
  // Users whose account is approximately daysSinceSignup days old (within a 1-day window)
  const lowerBound = new Date(Date.now() - (daysSinceSignup + 1) * 24 * 60 * 60 * 1000);
  const upperBound = new Date(Date.now() - daysSinceSignup * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(users)
    .where(and(gte(users.createdAt, lowerBound), lte(users.createdAt, upperBound)));
}

export async function listInactiveUsersNoRecentScans(inactiveDays: number) {
  const db = await getDb();
  if (!db) return [];
  // Users who have qr codes but no scans recorded in the last N days
  // Approximated by checking users with scanCount=0 or very low scan activity
  const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
  const allUsers = await db.select().from(users);
  const activeUserIds = new Set(
    (
      await db
        .select({ userId: activityLog.userId })
        .from(activityLog)
        .where(and(eq(activityLog.entityType, "qr_scan"), gte(activityLog.createdAt, cutoff)))
    )
      .map(r => r.userId)
      .filter(Boolean),
  );
  return allUsers.filter(u => !activeUserIds.has(u.id));
}

export async function listHighScanUsers(minScans: number) {
  const db = await getDb();
  if (!db) return [];
  // Users with total scan activity count >= minScans in the activity log
  const scanCounts = await db
    .select({
      userId: activityLog.userId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(activityLog)
    .where(eq(activityLog.entityType, "qr_scan"))
    .groupBy(activityLog.userId)
    .having(sql`count(*) >= ${minScans}`);

  if (scanCounts.length === 0) return [];
  const ids = scanCounts.map(r => r.userId).filter((id): id is number => id !== null);
  if (ids.length === 0) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}
export async function getAllAdminIds() {
  return db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));
}

