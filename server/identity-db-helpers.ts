// server/identity-db-helpers.ts
//
// Db-parameterized replacements for the server/db.ts helper functions used
// across the identity/product cluster (server/staking/**, server/referral/**,
// server/white-label/**, server/affiliate/**, server/bonuses/**,
// server/authenticate/**, server/b44-service.ts, server/asset-service.ts,
// server/supply-chain/**, server/qron/**, server/qrcode/**,
// server/products/**, server/nft/**, server/marketplace/**,
// server/certificates/**, server/ordinals-service.ts,
// server/metrc-service.ts — Task 2b-5).
//
// server/db.ts's helpers all close over the module-scope getDb() singleton
// (Node-only, process.env.DATABASE_URL), which is incompatible with
// Cloudflare Workers' per-request env bindings. These do the same queries
// but take an explicit `db` instance (threaded from the caller — ultimately
// ctx.db in a tRPC procedure, or a per-request Workers db) instead of
// reaching for the singleton themselves.
//
// One shared file for the whole cluster (rather than one file per
// subdirectory) because several functions here (logActivity, getProductById,
// ...) are used by 4+ of this cluster's subdirectories — duplicating them
// per-directory would just be drift risk for no benefit. Named
// identity-db-helpers.ts (not db-helpers.ts) because server/db-helpers.ts
// already exists at the repo root, created by Task 2b-4 for a different
// cluster.
import { eq, desc, and, gte, sql, SQL } from "drizzle-orm";
import {
  activityLog,
  notifications,
  stakingPositions,
  referrals,
  affiliates,
  affiliateCommissions,
  whiteLabelClients,
  subscriptions,
  usageRecords,
  products,
  authentications,
  certificates,
  autopilotDecisions,
  supplyChainEvents,
  qrCodes,
  qrScanEvents,
  nfts,
  nftCollections,
  auctions,
  auctionBids,
  type InsertNotification,
} from "../drizzle/schema";
import type { getHyperdriveDb } from "./db";

export type Db = ReturnType<typeof getHyperdriveDb>;

// ─────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────

export async function logActivity(
  db: Db,
  actionOrData: string | { userId?: number | null; action: string; entityType?: string; entityId?: number | string; details?: any },
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
  return createNotification(db, { userId, type: type as any, title, message, isRead: false, actionUrl });
}

// ─────────────────────────────────────────────────────────────
// STAKING
// ─────────────────────────────────────────────────────────────

export async function getUserStakingPositions(db: Db, userId: number) {
  return await db.select().from(stakingPositions).where(eq(stakingPositions.userId, userId)).orderBy(desc(stakingPositions.stakedAt));
}

export async function createStakingPosition(db: Db, data: any) {
  const [result] = await db.insert(stakingPositions).values(data).returning();
  return { id: result.id, ...data };
}

export async function updateStakingPosition(db: Db, id: number, userId: number, data: any) {
  await db.update(stakingPositions).set(data).where(and(eq(stakingPositions.id, id), eq(stakingPositions.userId, userId)));
}

// ─────────────────────────────────────────────────────────────
// REFERRALS
// ─────────────────────────────────────────────────────────────

export async function getReferralByCode(db: Db, code: string) {
  const result = await db.select().from(referrals).where(eq(referrals.referralCode, code)).limit(1);
  return result[0];
}

export async function getUserReferrals(db: Db, userId: number) {
  return await db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
}

// ─────────────────────────────────────────────────────────────
// AFFILIATES
// ─────────────────────────────────────────────────────────────

export async function getAffiliateByUserId(db: Db, userId: number) {
  const result = await db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
  return result[0];
}

export async function createAffiliate(db: Db, data: any) {
  const [result] = await db.insert(affiliates).values(data).returning();
  return { id: result.id };
}

export async function getAffiliateCommissions(db: Db, affiliateId: number) {
  return await db.select().from(affiliateCommissions).where(eq(affiliateCommissions.affiliateId, affiliateId)).orderBy(desc(affiliateCommissions.createdAt));
}

// ─────────────────────────────────────────────────────────────
// WHITE LABEL
// ─────────────────────────────────────────────────────────────

export async function createWhiteLabelClient(db: Db, data: any) {
  const [result] = await db.insert(whiteLabelClients).values(data).returning();
  return { id: result.id };
}

export async function getWhiteLabelClients(db: Db) {
  return await db.select().from(whiteLabelClients).orderBy(desc(whiteLabelClients.createdAt)).limit(200);
}

export async function getWhiteLabelByApiKey(db: Db, apiKey: string) {
  const result = await db.select().from(whiteLabelClients).where(eq(whiteLabelClients.apiKey, apiKey)).limit(1);
  return result[0];
}

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTIONS (subset used by authenticate router)
// ─────────────────────────────────────────────────────────────

export async function getUserSubscription(db: Db, userId: number) {
  const result = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).limit(1);
  return result[0];
}

export async function consumeSubscriptionQuota(db: Db, userId: number): Promise<"ok" | "exceeded" | "no_subscription"> {
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

export async function recordUsage(db: Db, data: any) {
  await db.insert(usageRecords).values(data);
}

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────

export async function getUserProducts(db: Db, userId: number) {
  return await db.select().from(products).where(eq(products.userId, userId)).orderBy(desc(products.createdAt));
}

export async function getProductById(db: Db, id: string) {
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function updateProduct(db: Db, id: string, data: any) {
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function createProduct(db: Db, data: any) {
  const [result] = await db.insert(products).values(data).returning();
  return { id: result.id };
}

// ─────────────────────────────────────────────────────────────
// AUTHENTICATIONS / CERTIFICATES
// ─────────────────────────────────────────────────────────────

export async function createAuthentication(db: Db, data: any) {
  const [result] = await db.insert(authentications).values(data).returning();
  return { id: result.id };
}

export async function getUserAuthentications(db: Db, userId: number) {
  return await db.select().from(authentications).where(eq(authentications.userId, userId)).orderBy(desc(authentications.createdAt));
}

export async function getAuthenticationByShareToken(db: Db, shareToken: string) {
  const result = await db.select().from(authentications).where(eq(authentications.shareToken, shareToken)).limit(1);
  return result[0];
}

export async function updateAuthenticationSharing(db: Db, id: string, userId: number, isPublic: boolean, shareToken: string) {
  await db.update(authentications).set({ isPublic: isPublic ? 1 : 0, shareToken }).where(and(eq(authentications.id, id), eq(authentications.userId, userId)));
}

export async function incrementShareCount(db: Db, id: string) {
  await db.update(authentications).set({ shareCount: sql`${authentications.shareCount} + 1` }).where(eq(authentications.id, id));
}

export async function createCertificate(db: Db, data: any) {
  const [result] = await db.insert(certificates).values(data).returning();
  return result;
}

export async function getCertificateByNumber(db: Db, certNumber: string) {
  const result = await db.select().from(certificates).where(eq(certificates.certificateNumber, certNumber)).limit(1);
  return result[0];
}

export async function getUserCertificates(db: Db, userId: number) {
  return await db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.createdAt));
}

// ─────────────────────────────────────────────────────────────
// AUTOPILOT (used by b44-service.ts)
// ─────────────────────────────────────────────────────────────

export async function createAutopilotDecision(db: Db, data: any) {
  const [result] = await db.insert(autopilotDecisions).values(data).returning();
  return { id: result.id };
}

export async function getAutopilotDecisionCountByMonth(db: Db, _type?: string): Promise<{ data: number }> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(autopilotDecisions)
    .where(gte(autopilotDecisions.createdAt, firstOfMonth));
  return { data: rows[0]?.count ?? 0 };
}

// ─────────────────────────────────────────────────────────────
// SUPPLY CHAIN
// ─────────────────────────────────────────────────────────────

export async function createSupplyChainEvent(db: Db, data: any) {
  const [result] = await db.insert(supplyChainEvents).values(data).returning();
  return { id: result.id };
}

export async function getProductSupplyChain(db: Db, productId: string) {
  return await db.select().from(supplyChainEvents).where(eq(supplyChainEvents.productId, productId)).orderBy(supplyChainEvents.createdAt);
}

// ─────────────────────────────────────────────────────────────
// QRON
// ─────────────────────────────────────────────────────────────

export async function getQronList(db: Db) {
  return db.select().from(qrCodes).orderBy(desc(qrCodes.createdAt)).limit(200);
}

export async function createQron(db: Db, data: {
  id: string;
  productId: string;
  userId: number;
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
}) {
  return db.insert(qrCodes).values({
    userId: data.userId,
    productId: data.productId,
    shortCode: data.id,
    mode: data.mode ?? "standard",
    imageUrl: data.imageUrl,
    qrData: data.id,
    metadata: {
      qronId: data.id,
      productName: data.productName,
      brand: data.brand,
      category: data.category,
      seed: data.seed,
      thumbnailUrl: data.thumbnailUrl,
      fingerprintHash: data.fingerprintHash,
      nftTokenId: data.nftTokenId,
      openartUrl: data.openartUrl,
      openartRegistered: !!data.openartUrl,
      trustScore: data.trustScore ?? 100,
      verifiedScanCount: 0,
      fakeFlagCount: 0,
    },
  }).returning();
}

export async function getQronById(db: Db, qronId: string) {
  const rows = await db.select().from(qrCodes).where(eq(qrCodes.shortCode, qronId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    ...row,
    id: row.shortCode ?? String(row.id),
    fingerprintHash: meta.fingerprintHash as string | undefined,
    nftTokenId: meta.nftTokenId as string | undefined,
    openartUrl: meta.openartUrl as string | undefined,
    openartRegistered: !!(meta.openartUrl),
    trustScore: meta.trustScore as number | undefined,
    verifiedScanCount: meta.verifiedScanCount as number | undefined,
    fakeFlagCount: meta.fakeFlagCount as number | undefined,
  };
}

export async function createQronScanVerdict(db: Db, data: {
  qronId: string;
  scannedImageUrl: string;
  similarityScore: number;
  verdict: string;
  details: unknown;
}) {
  const rows = await db.select({ id: qrCodes.id, productId: qrCodes.productId })
    .from(qrCodes).where(eq(qrCodes.shortCode, data.qronId)).limit(1);
  const qr = rows[0];
  // qr_scan_events.productId is NOT NULL. The old code passed `?? 0`, inventing a
  // product that does not exist; with uuid keys that fails outright. If the QR is
  // not bound to a product there is no scan event to record.
  if (!qr || !qr.productId) return;
  await db.insert(qrScanEvents).values({
    qrCodeId: qr.id,
    productId: qr.productId,
    isAuthentic: data.verdict === "authentic",
    userAgent: JSON.stringify({
      verdict: data.verdict,
      similarity: data.similarityScore,
      details: data.details,
      scannedImageUrl: data.scannedImageUrl,
    }),
  });
}

export async function updateQron(
  db: Db,
  qronId: string,
  data: { verifiedScanCount?: number; fakeFlagCount?: number; trustScore?: number },
) {
  const rows = await db.select({ id: qrCodes.id, metadata: qrCodes.metadata })
    .from(qrCodes).where(eq(qrCodes.shortCode, qronId)).limit(1);
  const row = rows[0];
  if (!row) return;
  const merged = { ...(row.metadata as Record<string, unknown> ?? {}), ...data };
  await db.update(qrCodes)
    .set({ metadata: merged, updatedAt: new Date() })
    .where(eq(qrCodes.id, row.id));
}

// ─────────────────────────────────────────────────────────────
// QR CODES / SCANS
// ─────────────────────────────────────────────────────────────

export async function createQrCode(db: Db, data: any) {
  const [result] = await db.insert(qrCodes).values(data).returning();
  return { id: result.id };
}

export async function getProductQrCodes(db: Db, productId: string) {
  return await db.select().from(qrCodes).where(eq(qrCodes.productId, productId));
}

export async function incrementScanCount(db: Db, id: string) {
  await db.update(qrCodes).set({ scanCount: sql`${qrCodes.scanCount} + 1`, lastScannedAt: new Date() }).where(eq(qrCodes.id, id));
}

export async function getRecentScanEvents(db: Db, productId: string, limit = 20) {
  return await db
    .select()
    .from(qrScanEvents)
    .where(eq(qrScanEvents.productId, productId))
    .orderBy(desc(qrScanEvents.scannedAt))
    .limit(limit);
}

export async function recordReputationEvent(db: Db, userId: number, eventType: string, pointsDelta: number) {
  await db.execute(sql`
    INSERT INTO reputation_events (user_id, event_type, points_delta)
    VALUES (${userId}, ${eventType}, ${pointsDelta})
  `);
  await db.execute(sql`
    INSERT INTO user_reputation (user_id, points, trust_level)
    VALUES (${userId}, ${pointsDelta}, 'novice')
    ON CONFLICT (user_id) DO UPDATE SET
      points = user_reputation.points + EXCLUDED.points,
      last_updated_at = now()
  `);
}

export async function logScanEvent(db: Db, data: { qrCodeId: string; productId: string; isAuthentic?: boolean; userAgent?: string; userId?: number }) {
  await db.insert(qrScanEvents).values({
    qrCodeId: data.qrCodeId,
    productId: data.productId,
    isAuthentic: data.isAuthentic,
    userAgent: data.userAgent,
  });

  if (data.userId && data.isAuthentic) {
    await recordReputationEvent(db, data.userId, "scan_authenticity_confirmed", 1);
  }
}

// ─────────────────────────────────────────────────────────────
// NFT / COLLECTIONS / AUCTIONS
// ─────────────────────────────────────────────────────────────

export async function listNfts(db: Db, filters?: { collectionId?: number; status?: string; limit?: number; offset?: number }) {
  let query = db.select().from(nfts);
  const conditions: SQL[] = [];
  if (filters?.collectionId) conditions.push(eq(nfts.collectionId, filters.collectionId));
  if (filters?.status) conditions.push(eq(nfts.status, filters.status as typeof nfts.status._.data));
  if (conditions.length) query = query.where(and(...conditions)) as typeof query;
  return await query.orderBy(desc(nfts.createdAt)).limit(filters?.limit || 50);
}

export async function getNftById(db: Db, id: string) {
  const result = await db.select().from(nfts).where(eq(nfts.id, id)).limit(1);
  return result[0];
}

export async function createNft(db: Db, data: any) {
  const [result] = await db.insert(nfts).values(data).returning();
  return result;
}

export async function listCollections(db: Db) {
  return await db.select().from(nftCollections).orderBy(desc(nftCollections.createdAt)).limit(200);
}

export async function getCollectionBySlug(db: Db, slug: string) {
  const result = await db.select().from(nftCollections).where(eq(nftCollections.slug, slug)).limit(1);
  return result[0];
}

export async function createCollection(db: Db, data: any) {
  const [result] = await db.insert(nftCollections).values(data).returning();
  return { id: result.id };
}

export async function createAuction(db: Db, data: any) {
  const [result] = await db.insert(auctions).values(data).returning();
  return { id: result.id };
}

export async function getActiveAuctions(db: Db) {
  return await db.select().from(auctions).where(eq(auctions.status, "active")).orderBy(desc(auctions.createdAt));
}

export async function getAuctionById(db: Db, id: string) {
  const result = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  return result[0];
}

export async function placeBid(db: Db, auctionId: string, bidderId: number, amount: string) {
  await db.insert(auctionBids).values({ auctionId, bidderId, amount });
  await db.update(auctions).set({
    currentBid: amount,
    highestBidderId: bidderId,
    bidCount: sql`${auctions.bidCount} + 1`,
  }).where(eq(auctions.id, auctionId));
}

export async function getAuctionBids(db: Db, auctionId: string) {
  return await db.select().from(auctionBids).where(eq(auctionBids.auctionId, auctionId)).orderBy(desc(auctionBids.amount));
}
