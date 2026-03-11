import { eq, desc, and, or, sql, gte, lte, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users, products, authentications, certificates, qrCodes,
  nftCollections, nfts, auctions, auctionBids, subscriptions, usageRecords,
  invoices, payments, leads, emailCampaigns, emailDrafts, supplyChainEvents,
  referrals, affiliates, affiliateCommissions, autopilotConfig, autopilotDecisions,
  abTests, whiteLabelClients, activityLog, fraudAlerts, customerHealthScores,
  revenueRecords, notifications, missions, missionTasks,
  type Product, type InsertProduct, type InsertNotification,
  type Mission, type MissionTask,
} from "../drizzle/schema";
import type { MissionType, MissionStatus, TaskStatus } from './missions/types.js';
import { missionTemplates, taskTemplates } from './missions/templates.js';
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _memoryLeadId = 1;
let _memoryNotificationId = 1;
const _memoryLeads: any[] = [];
const _memoryNotifications: any[] = [];

const REDACT_KEYS = new Set([
  "email",
  "prospectEmail",
  "phone",
  "password",
  "token",
  "secret",
  "authorization",
  "card",
  "cardNumber",
  "cvv",
  "ssn",
  "to",
]);

function redactString(value: string) {
  const emailMatch = value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (emailMatch) {
    const [local, domain] = value.split("@");
    const maskedLocal = local.length <= 2 ? "*".repeat(local.length) : `${local.slice(0, 2)}***`;
    return `${maskedLocal}@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) return "[REDACTED_PHONE]";
  return value;
}

function sanitizeForLog(input: any): any {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return redactString(input);
  if (Array.isArray(input)) return input.map(sanitizeForLog);
  if (typeof input !== "object") return input;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (REDACT_KEYS.has(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = sanitizeForLog(v);
  }
  return out;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(postgres(process.env.DATABASE_URL, { ssl: "require" }));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Helpers ────────────────────────────────────────────────────────────
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
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet as any });
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
  const result = await db.insert(products).values(data as any).returning({ id: products.id });
  return { id: result[0].id };
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
  const result = await db.insert(authentications).values(data).returning({ id: authentications.id });
  return { id: result[0].id };
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
  const result = await db.insert(certificates).values(data).returning({ id: certificates.id });
  return { id: result[0].id };
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
  const result = await db.insert(qrCodes).values(data).returning({ id: qrCodes.id });
  return { id: result[0].id };
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
  const result = await db.insert(nfts).values(data).returning({ id: nfts.id });
  return { id: result[0].id };
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
  const result = await db.insert(nftCollections).values(data).returning({ id: nftCollections.id });
  return { id: result[0].id };
}

// ─── Auction Helpers ─────────────────────────────────────────────────────────
export async function createAuction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(auctions).values(data).returning({ id: auctions.id });
  return { id: result[0].id };
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

export async function getSubscriptionByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return result[0];
}

export async function createSubscription(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptions).values(data).returning({ id: subscriptions.id });
  return { id: result[0].id };
}

export async function upsertStripeSubscription(data: {
  userId: number;
  plan: "starter" | "professional" | "enterprise";
  monthlyQuota: number;
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused";
  billingCycle: "monthly" | "annual";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date | null;
  cancelledAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingBySubId = data.stripeSubscriptionId
    ? await getSubscriptionByStripeSubscriptionId(data.stripeSubscriptionId)
    : undefined;

  if (existingBySubId) {
    await db
      .update(subscriptions)
      .set({
        plan: data.plan,
        status: data.status,
        monthlyQuota: data.monthlyQuota,
        billingCycle: data.billingCycle,
        stripeCustomerId: data.stripeCustomerId ?? existingBySubId.stripeCustomerId,
        currentPeriodStart: data.currentPeriodStart ?? existingBySubId.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd ?? existingBySubId.currentPeriodEnd,
        trialEndsAt: data.trialEndsAt ?? existingBySubId.trialEndsAt,
        cancelledAt: data.cancelledAt ?? existingBySubId.cancelledAt,
      })
      .where(eq(subscriptions.id, existingBySubId.id));
    return { id: existingBySubId.id, created: false };
  }

  const existingByUser = await getUserSubscription(data.userId);
  if (existingByUser) {
    await db
      .update(subscriptions)
      .set({
        plan: data.plan,
        status: data.status,
        monthlyQuota: data.monthlyQuota,
        billingCycle: data.billingCycle,
        stripeCustomerId: data.stripeCustomerId ?? existingByUser.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId ?? existingByUser.stripeSubscriptionId,
        currentPeriodStart: data.currentPeriodStart ?? existingByUser.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd ?? existingByUser.currentPeriodEnd,
        trialEndsAt: data.trialEndsAt ?? existingByUser.trialEndsAt,
        cancelledAt: data.cancelledAt ?? existingByUser.cancelledAt,
      })
      .where(eq(subscriptions.id, existingByUser.id));
    return { id: existingByUser.id, created: false };
  }

  const created = await createSubscription({
    userId: data.userId,
    plan: data.plan,
    status: data.status,
    monthlyQuota: data.monthlyQuota,
    usedQuota: 0,
    stripeCustomerId: data.stripeCustomerId ?? null,
    stripeSubscriptionId: data.stripeSubscriptionId ?? null,
    billingCycle: data.billingCycle,
    currentPeriodStart: data.currentPeriodStart ?? new Date(),
    currentPeriodEnd: data.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    trialEndsAt: data.trialEndsAt ?? null,
    cancelledAt: data.cancelledAt ?? null,
  });
  return { id: created.id, created: true };
}

export async function setSubscriptionStatusByStripeId(
  stripeSubscriptionId: string,
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused",
  cancelledAt?: Date,
) {
  const db = await getDb();
  if (!db) return;
  const patch: any = { status };
  if (cancelledAt) patch.cancelledAt = cancelledAt;
  await db
    .update(subscriptions)
    .set(patch)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function listPastDueSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.status, "past_due"))
    .orderBy(desc(subscriptions.updatedAt));
}

export async function hasDunningStepLogged(subscriptionId: number, step: "day_3" | "day_7" | "day_14") {
  const db = await getDb();
  if (!db) return false;
  const actionName = `billing_dunning_${step}`;
  const rows = await db
    .select()
    .from(activityLog)
    .where(and(
      eq(activityLog.action, actionName),
      eq(activityLog.entityType, "subscription"),
      eq(activityLog.entityId, subscriptionId),
    ))
    .limit(1);
  return rows.length > 0;
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
  const result = await db.insert(invoices).values(data).returning({ id: invoices.id });
  return { id: result[0].id };
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
  const result = await db.insert(payments).values(data).returning({ id: payments.id });
  return { id: result[0].id };
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
  if (!db) {
    const row = {
      id: _memoryLeadId++,
      email: String(data.email || "").trim().toLowerCase(),
      name: data.name ?? null,
      company: data.company ?? null,
      title: data.title ?? null,
      phone: data.phone ?? null,
      source: data.source ?? null,
      score: data.score ?? 0,
      status: data.status ?? "new",
      industry: data.industry ?? null,
      notes: data.notes ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    _memoryLeads.push(row);
    return { id: row.id };
  }
  const result = await db.insert(leads).values(data).returning({ id: leads.id });
  return { id: result[0].id };
}

export function computeLeadScore(input: {
  segmentFit?: number;
  intent?: number;
  urgency?: number;
  budgetProxy?: number;
}) {
  const score = Math.max(
    0,
    Math.min(
      100,
      (input.segmentFit || 0) +
        (input.intent || 0) +
        (input.urgency || 0) +
        (input.budgetProxy || 0),
    ),
  );
  if (score >= 80) return { score, band: "high" as const, route: "immediate_outreach" as const };
  if (score >= 50) return { score, band: "medium" as const, route: "nurture_sequence" as const };
  return { score, band: "low" as const, route: "education_waitlist" as const };
}

export async function upsertLeadByEmail(data: any) {
  const db = await getDb();
  const normalizedEmail = String(data.email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Lead email is required");

  if (!db) {
    const existing = _memoryLeads.find(x => x.email === normalizedEmail);
    if (existing) {
      existing.name = data.name ?? existing.name;
      existing.company = data.company ?? existing.company;
      existing.title = data.title ?? existing.title;
      existing.phone = data.phone ?? existing.phone;
      existing.source = data.source ?? existing.source;
      existing.industry = data.industry ?? existing.industry;
      existing.metadata = data.metadata ?? existing.metadata;
      existing.updatedAt = new Date();
      return { id: existing.id, created: false };
    }
    const created = await createLead({ ...data, email: normalizedEmail });
    return { id: created.id, created: true };
  }

  const existing = await db.select().from(leads).where(eq(leads.email, normalizedEmail)).limit(1);
  if (existing.length > 0) {
    await db
      .update(leads)
      .set({
        name: data.name ?? existing[0].name,
        company: data.company ?? existing[0].company,
        title: data.title ?? existing[0].title,
        phone: data.phone ?? existing[0].phone,
        source: data.source ?? existing[0].source,
        industry: data.industry ?? existing[0].industry,
        metadata: data.metadata ?? existing[0].metadata,
      })
      .where(eq(leads.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }

  const created = await createLead({ ...data, email: normalizedEmail });
  return { id: created.id, created: true };
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [..._memoryLeads].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  return await db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function updateLeadScore(id: number, score: number) {
  const db = await getDb();
  if (!db) {
    const row = _memoryLeads.find(x => x.id === id);
    if (row) {
      row.score = score;
      row.updatedAt = new Date();
    }
    return;
  }
  await db.update(leads).set({ score }).where(eq(leads.id, id));
}

export async function updateLeadStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) {
    const row = _memoryLeads.find(x => x.id === id);
    if (row) {
      row.status = status;
      row.updatedAt = new Date();
    }
    return;
  }
  await db.update(leads).set({ status: status as any }).where(eq(leads.id, id));
}

export async function getWeeklyRevenueDigest() {
  const db = await getDb();
  if (!db) {
    return {
      leads: 0,
      mqlToSql: 0,
      demosBooked: 0,
      trialToPaid: 0,
      churn: 0,
      mrr: 0,
      arpa: 0,
    };
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [leadCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(gte(leads.createdAt, sevenDaysAgo));
  const [mqlSqlCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(gte(leads.createdAt, sevenDaysAgo), gte(leads.score, 50)));
  const [sqlCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(gte(leads.createdAt, sevenDaysAgo), gte(leads.score, 80)));
  const [demosBooked] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLog)
    .where(and(gte(activityLog.createdAt, sevenDaysAgo), eq(activityLog.action, "demo_booked")));
  const [trialToPaid] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(and(gte(subscriptions.createdAt, sevenDaysAgo), eq(subscriptions.status, "active")));
  const [churn] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(and(gte(subscriptions.updatedAt, sevenDaysAgo), eq(subscriptions.status, "cancelled")));
  const [mrrResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(revenueRecords)
    .where(and(gte(revenueRecords.createdAt, sevenDaysAgo), eq(revenueRecords.type, "subscription")));
  const [arpaResult] = await db
    .select({ avg: sql<string>`COALESCE(AVG(amount), 0)` })
    .from(revenueRecords)
    .where(and(gte(revenueRecords.createdAt, sevenDaysAgo), eq(revenueRecords.type, "subscription")));

  const mql = mqlSqlCount?.count || 0;
  const sqlv = sqlCount?.count || 0;
  return {
    leads: leadCount?.count || 0,
    mqlToSql: mql > 0 ? Number((sqlv / mql).toFixed(4)) : 0,
    demosBooked: demosBooked?.count || 0,
    trialToPaid: trialToPaid?.count || 0,
    churn: churn?.count || 0,
    mrr: parseFloat(mrrResult?.total || "0"),
    arpa: parseFloat(arpaResult?.avg || "0"),
  };
}

export async function logAutomationAudit(action: string, details: Record<string, unknown>, userId?: number) {
  await logActivity({
    userId: userId ?? null,
    action,
    entityType: "revenue_automation",
    details,
  });
}

export async function getMonthlyLlmSpendUsd(now = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = await db
    .select({ details: activityLog.details })
    .from(activityLog)
    .where(and(
      eq(activityLog.action, "llm_usage"),
      gte(activityLog.createdAt, startOfMonth),
    ));
  let total = 0;
  for (const row of rows) {
    const details: any = row.details;
    const cost = typeof details?.costUsd === "number"
      ? details.costUsd
      : Number(details?.costUsd ?? 0);
    if (!Number.isNaN(cost) && Number.isFinite(cost)) total += cost;
  }
  return Number(total.toFixed(6));
}

export async function getSpendByActionPrefix(prefix: string, since: Date) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ action: activityLog.action, details: activityLog.details })
    .from(activityLog)
    .where(gte(activityLog.createdAt, since));
  let total = 0;
  for (const row of rows) {
    if (!String(row.action || "").startsWith(prefix)) continue;
    const details: any = row.details;
    const cost = typeof details?.costUsd === "number"
      ? details.costUsd
      : Number(details?.costUsd ?? 0);
    if (!Number.isNaN(cost) && Number.isFinite(cost)) total += cost;
  }
  return Number(total.toFixed(6));
}

export async function getBudgetStatus(now = new Date()) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const llmMonthly = await getMonthlyLlmSpendUsd(now);
  const adsDaily = await getSpendByActionPrefix("ads_spend", startOfDay);
  const enrichmentMonthly = await getSpendByActionPrefix("enrichment_spend", startOfMonth);

  const llmPct = ENV.llmMonthlyBudgetUsd > 0 ? (llmMonthly / ENV.llmMonthlyBudgetUsd) * 100 : 0;
  const adsPct = ENV.adsDailyCapUsd > 0 ? (adsDaily / ENV.adsDailyCapUsd) * 100 : 0;
  const enrichmentPct =
    ENV.enrichmentMonthlyCapUsd > 0 ? (enrichmentMonthly / ENV.enrichmentMonthlyCapUsd) * 100 : 0;

  return {
    period: {
      day: startOfDay.toISOString().slice(0, 10),
      month: startOfMonth.toISOString().slice(0, 7),
    },
    llm: {
      monthlySpendUsd: llmMonthly,
      monthlyCapUsd: ENV.llmMonthlyBudgetUsd,
      remainingUsd: Number((ENV.llmMonthlyBudgetUsd - llmMonthly).toFixed(6)),
      pct: Number(llmPct.toFixed(2)),
      over70: llmPct >= 70,
      over90: llmPct >= 90,
    },
    ads: {
      dailySpendUsd: adsDaily,
      dailyCapUsd: ENV.adsDailyCapUsd,
      remainingUsd: Number((ENV.adsDailyCapUsd - adsDaily).toFixed(6)),
      pct: Number(adsPct.toFixed(2)),
      over70: adsPct >= 70,
      over90: adsPct >= 90,
    },
    enrichment: {
      monthlySpendUsd: enrichmentMonthly,
      monthlyCapUsd: ENV.enrichmentMonthlyCapUsd,
      remainingUsd: Number((ENV.enrichmentMonthlyCapUsd - enrichmentMonthly).toFixed(6)),
      pct: Number(enrichmentPct.toFixed(2)),
      over70: enrichmentPct >= 70,
      over90: enrichmentPct >= 90,
    },
  };
}

export async function listUsersForOnboardingStep(stepDays: 0 | 2 | 5 | 10) {
  const db = await getDb();
  if (!db) return [];
  const allUsers = await db.select().from(users);
  const msPerDay = 24 * 60 * 60 * 1000;
  return allUsers.filter(u => {
    const ageDays = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / msPerDay);
    return ageDays >= stepDays;
  });
}

export async function listInactiveUsersNoRecentScans(days = 7) {
  const db = await getDb();
  if (!db) return [];
  const allUsers = await db.select().from(users);
  const allQrs = await db.select().from(qrCodes);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const qrsByUser = new Map<number, typeof allQrs>();
  for (const qr of allQrs) {
    const arr = qrsByUser.get(qr.userId) || [];
    arr.push(qr);
    qrsByUser.set(qr.userId, arr);
  }

  return allUsers.filter(u => {
    const qrs = qrsByUser.get(u.id) || [];
    if (qrs.length === 0) return true;
    const hasRecent = qrs.some(qr => qr.lastScannedAt && new Date(qr.lastScannedAt).getTime() >= cutoff);
    return !hasRecent;
  });
}

export async function listHighScanUsers(minTotalScans = 100) {
  const db = await getDb();
  if (!db) return [];
  const allUsers = await db.select().from(users);
  const allQrs = await db.select().from(qrCodes);
  const totalByUser = new Map<number, number>();
  for (const qr of allQrs) {
    totalByUser.set(qr.userId, (totalByUser.get(qr.userId) || 0) + (qr.scanCount || 0));
  }
  return allUsers.filter(u => (totalByUser.get(u.id) || 0) >= minTotalScans);
}

// ─── Email Campaign Helpers ──────────────────────────────────────────────────
export async function createEmailCampaign(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(emailCampaigns).values(data).returning({ id: emailCampaigns.id });
  return { id: result[0].id };
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
  const result = await db.insert(emailDrafts).values(data).returning({ id: emailDrafts.id });
  return { id: result[0].id };
}

export async function getPendingDrafts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailDrafts).where(eq(emailDrafts.status, "pending")).orderBy(desc(emailDrafts.createdAt));
}

export async function getApprovedDrafts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(emailDrafts)
    .where(eq(emailDrafts.status, "approved"))
    .orderBy(desc(emailDrafts.createdAt))
    .limit(limit);
}

export async function getEmailDraftById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(emailDrafts).where(eq(emailDrafts.id, id)).limit(1);
  return rows[0];
}

export async function getEmailDraftByTaskId(taskId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(emailDrafts)
    .where(and(eq(emailDrafts.taskId, taskId), inArray(emailDrafts.status, ['pending', 'approved'])))
    .orderBy(desc(emailDrafts.createdAt))
    .limit(1);
  return rows[0];
}

export async function getAdaptivePriors(): Promise<Record<string, { alpha: number; beta: number }>> {
  const { SEGMENT_PRIORS, updatePrior } = await import('./_core/bayesian.js');
  // Deep-clone starting priors so we don't mutate the module-level constants
  const priors: Record<string, { alpha: number; beta: number }> = {};
  for (const [k, v] of Object.entries(SEGMENT_PRIORS)) priors[k] = { ...v };

  const db = await getDb();
  if (!db) return priors;

  const signals = await db
    .select({ details: activityLog.details })
    .from(activityLog)
    .where(eq(activityLog.action, 'outcome_signal'))
    .orderBy(activityLog.createdAt);

  for (const { details } of signals) {
    const d = details as Record<string, unknown>;
    const seg = (d.segment as string) ?? 'DEFAULT';
    const signal = d.signal as string;
    if (priors[seg] && signal) {
      priors[seg] = updatePrior(priors[seg], signal as Parameters<typeof updatePrior>[1]);
    }
  }
  return priors;
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
  const result = await db.insert(supplyChainEvents).values(data).returning({ id: supplyChainEvents.id });
  return { id: result[0].id };
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
  const result = await db.insert(referrals).values(data).returning({ id: referrals.id });
  return { id: result[0].id };
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
  const result = await db.insert(affiliates).values(data).returning({ id: affiliates.id });
  return { id: result[0].id };
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
  const result = await db.insert(autopilotConfig).values(data).returning({ id: autopilotConfig.id });
  return result[0].id;
}

export async function createAutopilotDecision(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(autopilotDecisions).values(data).returning({ id: autopilotDecisions.id });
  return { id: result[0].id };
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
  const result = await db.insert(abTests).values(data).returning({ id: abTests.id });
  return { id: result[0].id };
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
  const result = await db.insert(whiteLabelClients).values(data).returning({ id: whiteLabelClients.id });
  return { id: result[0].id };
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
  const sanitized = {
    ...data,
    details: sanitizeForLog(data?.details ?? null),
  };
  await db.insert(activityLog).values(sanitized);
}

export async function getRecentActivity(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function hasUserActionLogged(userId: number, action: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.userId, userId), eq(activityLog.action, action)))
    .limit(1);
  return rows.length > 0;
}

export async function hasActionLogged(action: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.action, action))
    .limit(1);
  return rows.length > 0;
}

// ─── Fraud Alert Helpers ─────────────────────────────────────────────────────
export async function createFraudAlert(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fraudAlerts).values(data).returning({ id: fraudAlerts.id });
  return { id: result[0].id };
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

export async function getFunnelBySegmentAndChannel() {
  const db = await getDb();
  if (!db) return [];
  const allLeads = await db.select().from(leads);

  type Bucket = {
    segment: string;
    channel: string;
    leads: number;
    contacted: number;
    qualified: number;
    proposal: number;
    won: number;
    lost: number;
  };

  const buckets = new Map<string, Bucket>();
  for (const lead of allLeads) {
    const metadata: any = lead.metadata;
    const segment = (metadata?.segment || lead.industry || "unknown").toString().toLowerCase();
    const channel = (metadata?.acquisitionChannel || lead.source || "unknown").toString().toLowerCase();
    const key = `${segment}::${channel}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        segment,
        channel,
        leads: 0,
        contacted: 0,
        qualified: 0,
        proposal: 0,
        won: 0,
        lost: 0,
      });
    }
    const bucket = buckets.get(key)!;
    bucket.leads += 1;
    if (lead.status === "contacted") bucket.contacted += 1;
    if (lead.status === "qualified") bucket.qualified += 1;
    if (lead.status === "proposal") bucket.proposal += 1;
    if (lead.status === "won") bucket.won += 1;
    if (lead.status === "lost") bucket.lost += 1;
  }

  return Array.from(buckets.values()).sort((a, b) => b.leads - a.leads);
}

export async function getLeadCohorts() {
  const db = await getDb();
  if (!db) return [];
  const allLeads = await db.select().from(leads);

  type Cohort = {
    cohortWeek: string;
    cohortMonth: string;
    total: number;
    won: number;
    qualified: number;
    conversionRate: number;
  };

  const buckets = new Map<string, Cohort>();
  for (const lead of allLeads) {
    const created = new Date(lead.createdAt);
    const startOfYear = new Date(created.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((created.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.floor(dayOfYear / 7) + 1;
    const cohortWeek = `${created.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    const cohortMonth = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const key = `${cohortWeek}:${cohortMonth}`;
    if (!buckets.has(key)) {
      buckets.set(key, { cohortWeek, cohortMonth, total: 0, won: 0, qualified: 0, conversionRate: 0 });
    }
    const bucket = buckets.get(key)!;
    bucket.total += 1;
    if (lead.status === "won") bucket.won += 1;
    if (lead.status === "qualified" || lead.status === "proposal" || lead.status === "won") bucket.qualified += 1;
  }

  const result = Array.from(buckets.values()).map(c => ({
    ...c,
    conversionRate: c.total > 0 ? Number((c.won / c.total).toFixed(4)) : 0,
  }));
  return result.sort((a, b) => b.cohortWeek.localeCompare(a.cohortWeek));
}

export async function getQuarterlyValueReport() {
  const db = await getDb();
  if (!db) {
    return {
      period: "current_quarter",
      scans: 0,
      conversions: 0,
      topLocations: [],
      topPortals: [],
      revenueUsd: 0,
      roiSummary: "No data available.",
    };
  }

  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);

  const qrs = await db.select().from(qrCodes);
  const leadsInQuarter = await db.select().from(leads).where(gte(leads.createdAt, quarterStart));
  const revenues = await db.select().from(revenueRecords).where(gte(revenueRecords.createdAt, quarterStart));

  let scans = 0;
  const locationCount = new Map<string, number>();
  const portalCount = new Map<string, number>();
  for (const qr of qrs) {
    scans += qr.scanCount || 0;
    const metadata: any = qr.qrData ? (() => {
      try { return JSON.parse(qr.qrData); } catch { return {}; }
    })() : {};
    const loc = (metadata?.location || "unknown").toString().toLowerCase();
    const portal = (metadata?.portal || metadata?.shortcode || "unknown").toString().toLowerCase();
    locationCount.set(loc, (locationCount.get(loc) || 0) + (qr.scanCount || 0));
    portalCount.set(portal, (portalCount.get(portal) || 0) + (qr.scanCount || 0));
  }

  const conversions = leadsInQuarter.filter(l => l.status === "won").length;
  const revenueUsd = revenues.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const topLocations = Array.from(locationCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));
  const topPortals = Array.from(portalCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([portal, count]) => ({ portal, count }));

  const roiSummary =
    scans > 0
      ? `Quarter performance: ${scans} scans, ${conversions} won deals, $${revenueUsd.toFixed(2)} revenue.`
      : "No scan activity recorded in current quarter.";

  return {
    period: `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`,
    scans,
    conversions,
    topLocations,
    topPortals,
    revenueUsd: Number(revenueUsd.toFixed(2)),
    roiSummary,
  };
}

export async function getAcceptanceCriteriaStatus() {
  const db = await getDb();
  if (!db) {
    return {
      ready: false,
      criteria: {
        leadIngestion: false,
        scoringRouting: false,
        outreachComplianceLogging: false,
        billingEntitlements: false,
        dunningStateTransitions: false,
        weeklyKpiDigest: false,
        auditCoverage: false,
      },
      blockers: ["DATABASE_URL unavailable"],
    };
  }

  const allLeads = await db.select().from(leads);
  const allSubs = await db.select().from(subscriptions);
  const allActivity = await db.select().from(activityLog);

  const leadIngestion = allLeads.length > 0;
  const scoringRouting = allLeads.some(l => (l.score || 0) > 0);
  const outreachComplianceLogging = allActivity.some(a => a.action === "email_send_attempt");
  const billingEntitlements = allSubs.some(s => !!s.stripeSubscriptionId);
  const dunningStateTransitions = allActivity.some(a => String(a.action).startsWith("billing_dunning_"));
  const weeklyKpiDigest = allActivity.some(a => a.action === "report_generated_weekly_kpi_digest");
  const auditCoverage = allActivity.some(a => a.action === "lead_create")
    && allActivity.some(a => a.action === "lead_update" || a.action === "lead_routed")
    && allActivity.some(a => a.action === "email_send_attempt")
    && allActivity.some(a => String(a.action).startsWith("billing_"))
    && allActivity.some(a => String(a.entityType) === "reporting");

  const criteria = {
    leadIngestion,
    scoringRouting,
    outreachComplianceLogging,
    billingEntitlements,
    dunningStateTransitions,
    weeklyKpiDigest,
    auditCoverage,
  };

  const blockers = Object.entries(criteria)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  return {
    ready: blockers.length === 0,
    criteria,
    blockers,
  };
}

export async function hasWebhookEventProcessed(eventId: string) {
  const db = await getDb();
  if (!db) return false;
  const recent = await db
    .select({ action: activityLog.action, details: activityLog.details })
    .from(activityLog)
    .where(gte(activityLog.createdAt, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)))
    .orderBy(desc(activityLog.createdAt))
    .limit(2000);

  return recent.some(row => {
    const action = String(row.action || "");
    if (!action.startsWith("billing_") && action !== "checkout_abandoned") return false;
    const details: any = row.details;
    return details?.eventId === eventId;
  });
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
  if (!db) {
    const row = {
      id: _memoryNotificationId++,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: data.isRead ?? 0,
      actionUrl: data.actionUrl ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
    };
    _memoryNotifications.push(row);
    return { id: row.id };
  }
  const result = await db.insert(notifications).values(data as any).returning({ id: notifications.id });
  return { id: result[0].id };
}

export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) {
    return _memoryNotifications
      .filter(x => x.userId === userId)
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
      .slice(0, limit);
  }
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return _memoryNotifications.filter(x => x.userId === userId && x.isRead === 0).length;
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
  return result?.count || 0;
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const row = _memoryNotifications.find(x => x.id === id && x.userId === userId);
    if (row) row.isRead = 1;
    return;
  }
  await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) {
    for (const row of _memoryNotifications) {
      if (row.userId === userId && row.isRead === 0) row.isRead = 1;
    }
    return;
  }
  await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
}

export async function deleteNotification(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const idx = _memoryNotifications.findIndex(x => x.id === id && x.userId === userId);
    if (idx >= 0) _memoryNotifications.splice(idx, 1);
    return;
  }
  const { eq: eqOp, and: andOp } = await import("drizzle-orm");
  await db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function createSystemNotification(userId: number, title: string, message: string, type: InsertNotification["type"], actionUrl?: string) {
  return createNotification({ userId, type: type as any, title, message, isRead: 0, actionUrl });
}

// ─── Missions ────────────────────────────────────────────────────────────────

export async function getMissions(statusFilter?: MissionStatus): Promise<Mission[]> {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(missions).orderBy(desc(missions.priority), desc(missions.createdAt));
  if (statusFilter) {
    return query.where(eq(missions.status, statusFilter));
  }
  return query;
}

export async function getMissionById(id: string): Promise<(Mission & { tasks: MissionTask[] }) | null> {
  const db = await getDb();
  if (!db) return null;
  const [mission] = await db.select().from(missions).where(eq(missions.id, id));
  if (!mission) return null;
  const tasks = await db.select().from(missionTasks).where(eq(missionTasks.missionId, id)).orderBy(missionTasks.createdAt);
  return { ...mission, tasks };
}

export async function createMission(type: MissionType): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const template = missionTemplates[type];
  const now = new Date();

  if (db) {
    await db.insert(missions).values({
      id,
      type: template.type,
      title: template.title,
      status: 'PLANNED',
      priority: template.priority,
    });

    const taskRows = taskTemplates[type].map(t => ({
      id: crypto.randomUUID(),
      missionId: id,
      kind: t.kind,
      payload: t.payload,
      status: 'PENDING' as const,
      runAt: now,
    }));

    if (taskRows.length > 0) {
      await db.insert(missionTasks).values(taskRows);
    }
  }

  await logActivity({ userId: null, action: 'mission_created', entityType: 'mission', entityId: 0, details: { missionId: id, type, title: template.title } });
  return id;
}

export async function updateMissionStatus(id: string, status: MissionStatus): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(missions).set({ status, updatedAt: new Date() }).where(eq(missions.id, id));
}

// ─── Mission Tasks ────────────────────────────────────────────────────────────

const MAX_TASK_RETRIES = 3;

// Backoff schedule: attempt 1→5 min, attempt 2→15 min, attempt 3→60 min
function retryDelayMs(retryCount: number): number {
  const delays = [5 * 60_000, 15 * 60_000, 60 * 60_000];
  return delays[Math.min(retryCount, delays.length - 1)];
}

export async function getDueTasks(limit = 5): Promise<MissionTask[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  // Pick up PENDING tasks due now, OR FAILED tasks whose retryAfter has passed and retryCount < max
  return db.select().from(missionTasks)
    .where(or(
      and(eq(missionTasks.status, 'PENDING'), lte(missionTasks.runAt, now)),
      and(
        eq(missionTasks.status, 'FAILED'),
        lte(missionTasks.retryAfter, now),
        sql`${missionTasks.retryCount} < ${MAX_TASK_RETRIES}`,
      ),
    ))
    .orderBy(missionTasks.runAt)
    .limit(limit);
}

export async function getTasksByMission(missionId: string): Promise<MissionTask[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(missionTasks).where(eq(missionTasks.missionId, missionId)).orderBy(missionTasks.createdAt);
}

export async function markTaskRunning(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(missionTasks).set({ status: 'RUNNING', updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function markTaskDone(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Only transition to DONE from RUNNING — preserves WAITING_HUMAN if agent set it.
  const result = await db.update(missionTasks)
    .set({ status: 'DONE', lastError: null, updatedAt: new Date() })
    .where(and(eq(missionTasks.id, id), eq(missionTasks.status, 'RUNNING')))
    .returning({ missionId: missionTasks.missionId });

  const missionId = result[0]?.missionId;
  if (!missionId) return; // was WAITING_HUMAN — skip mission check

  // Auto-complete mission if every task is now DONE
  const remaining = await db.select({ id: missionTasks.id }).from(missionTasks)
    .where(and(eq(missionTasks.missionId, missionId), sql`status NOT IN ('DONE')`));
  if (remaining.length === 0) {
    await db.update(missions)
      .set({ status: 'COMPLETED', updatedAt: new Date() })
      .where(and(eq(missions.id, missionId), sql`status != 'COMPLETED'`));
  }
}

export async function markTaskFailed(id: string, error: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Read current retryCount to compute next backoff
  const [current] = await db.select({ retryCount: missionTasks.retryCount })
    .from(missionTasks).where(eq(missionTasks.id, id));
  const retryCount = (current?.retryCount ?? 0) + 1;
  const retryAfter = retryCount < MAX_TASK_RETRIES
    ? new Date(Date.now() + retryDelayMs(retryCount))
    : null; // exhausted — stays FAILED permanently

  await db.update(missionTasks).set({
    status: 'FAILED',
    lastError: error,
    retryCount,
    retryAfter,
    updatedAt: new Date(),
  }).where(eq(missionTasks.id, id));
}

export async function markTaskWaitingHuman(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(missionTasks).set({ status: 'WAITING_HUMAN', updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function retryTask(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Manual retry resets backoff state so the task can try again from scratch
  await db.update(missionTasks)
    .set({ status: 'PENDING', lastError: null, retryCount: 0, retryAfter: null, runAt: new Date(), updatedAt: new Date() })
    .where(and(eq(missionTasks.id, id), eq(missionTasks.status, 'FAILED')));
}

export async function getRunTaskCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: sql<number>`count(*)::int` })
    .from(missionTasks)
    .where(inArray(missionTasks.status, ['DONE', 'FAILED', 'WAITING_HUMAN']));
  return row?.count ?? 0;
}

export async function enqueueTask(missionId: string, kind: string, payload: Record<string, unknown>, runAt?: Date): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  if (db) {
    await db.insert(missionTasks).values({
      id,
      missionId,
      kind,
      payload,
      status: 'PENDING',
      runAt: runAt ?? new Date(),
    });
  }
  return id;
}
