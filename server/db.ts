  import { randomUUID } from "crypto";
  import { and,desc,eq,gte,isNull,like,lte,or,sql,SQL } from "drizzle-orm";
  import { drizzle } from "drizzle-orm/node-postgres";
  import tls from "node:tls";
  import { Pool } from "pg";
  import {
    abTests,
    activityLog,
    affiliateCommissions,
    affiliates,
    auctionBids,
    auctions,
    authentications,
    autopilotConfig,
    autopilotDecisions,
    bayesianPriors,
    budgetConfig,
    certificates,
    customerHealthScores,
    emailCampaigns,
    emailDrafts,
    fraudAlerts,
    invoices,
    leads,
    missions,
    missionTasks,
    nftCollections,
    nfts,
    notifications,
    payments,
    products,
    proposals,
    qrCodes,
    qrScanEvents,
    referrals,
    revenueRecords,
    scheduledJobRuns,
    serviceOrders,
    stakingPositions,
    subscriptions,
    supplyChainEvents,
    usageRecords,
    users,
    whiteLabelClients,
    type InsertNotification,
    type InsertProduct,
    type InsertUser
  } from "../drizzle/schema";
  import { SEGMENT_PRIORS } from './_core/bayesian';
  import { ENV } from './_core/env';

// Supabase's Transaction Mode pooler (port 6543) may chain through a root CA
// that is not in Node.js's default trust store, so we allow an extra CA to be
// supplied. Set SUPABASE_POOLER_CA to the certificate from the Supabase
// dashboard (Project Settings → Database → SSL configuration) to rotate without
// a code deploy.
//
// Two things this deliberately does NOT do:
//
//  1. It does not *replace* the trust store. Passing `ssl: { ca }` with a single
//     certificate makes that certificate the only trusted root, so a pooler
//     presenting an ordinary publicly-rooted chain fails with
//     SELF_SIGNED_CERT_IN_CHAIN. We concatenate onto tls.rootCertificates
//     instead, so both a public chain and a pinned private root verify.
//  2. It does not fall back to rejectUnauthorized:false when verification
//     fails. An unverified TLS session still carries the database password;
//     silently downgrading would turn a loud failure into a quiet one.
//
// The default below is the Supabase Root 2021 CA, read off the wire on
// 2026-08-20 by scripts/diagnose-db-tls.mjs against the pooler itself:
//
//   [0] CN = *.pooler.supabase.com          <- Supabase Intermediate 2021 CA
//   [1] CN = Supabase Intermediate 2021 CA  <- Supabase Root 2021 CA
//   [2] CN = Supabase Root 2021 CA          (self-signed root)
//
//   sha256 fingerprint 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
//                      82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
//   valid until 2031-04-26
//
// It replaces the Entrust Root CA (2006) that sat here from the first commit
// of this constant, under the comment "Replace this value with the cert from
// your Supabase project's SSL settings if the connection fails." Nothing ever
// replaced it, because no CI job survived long enough to open a connection
// until #737 fixed the Chromium install. Since the pooler roots its chain in a
// private self-signed CA, no public trust store could ever have verified it.
//
// This is a public CA certificate, not a credential, so it belongs in the
// repository. SUPABASE_POOLER_CA remains the override for rotation.
const SUPABASE_POOLER_CA_DEFAULT = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

type DrizzleInstance = ReturnType<typeof drizzle>;
type FlexibleInsert<T> = T & Record<string, unknown>;
type FlexibleUpdate<T> = Partial<T> & Record<string, unknown>;
type ActivityPayload = {
  userId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number | string;
  details?: unknown;
};
type StakingPositionInsert = typeof stakingPositions.$inferInsert;
type LeadInsert = typeof leads.$inferInsert;
type ServiceOrderInsert = typeof serviceOrders.$inferInsert;
type MissionInsert = typeof missions.$inferInsert;
type MissionTaskInsert = typeof missionTasks.$inferInsert;
type ProductInsert = typeof products.$inferInsert;
type AuthenticationInsert = typeof authentications.$inferInsert;
type CertificateInsert = typeof certificates.$inferInsert;
type QrCodeInsert = typeof qrCodes.$inferInsert;
type NftInsert = typeof nfts.$inferInsert;
type NftCollectionInsert = typeof nftCollections.$inferInsert;
type AuctionInsert = typeof auctions.$inferInsert;
type SubscriptionInsert = typeof subscriptions.$inferInsert;
type UsageRecordInsert = typeof usageRecords.$inferInsert;
type InvoiceInsert = typeof invoices.$inferInsert;
type PaymentInsert = typeof payments.$inferInsert;
type EmailCampaignInsert = typeof emailCampaigns.$inferInsert;
type EmailDraftInsert = typeof emailDrafts.$inferInsert;
type SupplyChainEventInsert = typeof supplyChainEvents.$inferInsert;
type ReferralInsert = typeof referrals.$inferInsert;
type AffiliateInsert = typeof affiliates.$inferInsert;
type AutopilotConfigInsert = typeof autopilotConfig.$inferInsert;
type AutopilotDecisionInsert = typeof autopilotDecisions.$inferInsert;
type AbTestInsert = typeof abTests.$inferInsert;
type WhiteLabelClientInsert = typeof whiteLabelClients.$inferInsert;
type FraudAlertInsert = typeof fraudAlerts.$inferInsert;
type CustomerHealthScoreInsert = typeof customerHealthScores.$inferInsert;
type RevenueRecordInsert = typeof revenueRecords.$inferInsert;
let _db: DrizzleInstance | null = null;
/** Strip `sslmode=` from a postgres URL and pin the Supabase pooler CA when the
 *  host is a Supabase Transaction Mode pooler (*.pooler.supabase.com). */
function buildPoolerConfig(url: string): ConstructorParameters<typeof Pool>[0] {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".pooler.supabase.com")) {
      parsed.searchParams.delete("sslmode");
      const extra = ENV.supabasePoolerCa || SUPABASE_POOLER_CA_DEFAULT;
      const ca = [...tls.rootCertificates, extra];
      return { connectionString: parsed.toString(), ssl: { ca } };
    }
  } catch {
    // URL parsing failed — fall through to plain config
  }
  return { connectionString: url };
}

/** Certificate-verification failures are a configuration problem with a known
 *  remedy, but pg surfaces them as a bare OpenSSL code nested two `cause`
 *  levels down inside a DrizzleQueryError. Surface the remedy instead. */
const TLS_ERROR_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
]);

export function describeDbTlsError(error: unknown): string | null {
  let cursor: unknown = error;
  for (let depth = 0; cursor && depth < 5; depth++) {
    const code = (cursor as { code?: unknown }).code;
    if (typeof code === "string" && TLS_ERROR_CODES.has(code)) {
      return `Database TLS verification failed (${code}). The Supabase pooler is ` +
        `presenting a certificate chain that neither Node's trust store nor the ` +
        `configured SUPABASE_POOLER_CA can verify. Copy the certificate from ` +
        `Supabase → Project Settings → Database → SSL configuration into the ` +
        `SUPABASE_POOLER_CA secret. Do not work around this by disabling ` +
        `certificate verification: the connection carries the database password.`;
    }
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return null;
}

export async function getDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    const pool = new Pool(buildPoolerConfig(process.env.DATABASE_URL));
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
      values[field] = normalized;
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

export async function createStakingPosition(data: FlexibleInsert<StakingPositionInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(stakingPositions).values(data).returning();
  return { id: result.id, ...data };
}

export async function updateStakingPosition(id: number, userId: number, data: FlexibleUpdate<StakingPositionInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stakingPositions).set(data).where(and(eq(stakingPositions.id, id), eq(stakingPositions.userId, userId)));
}

// ─── Product Helpers ─────────────────────────────────────────────────────────
export async function createProduct(data: Omit<InsertProduct, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(products).values(data).returning();
  return { id: result.id };
}

export async function getRecentActivity(limit = 20) {
  const d = await getDb();
  return d.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function getRecentDecisions(limit = 10) {
  const d = await getDb();
  return d.select().from(autopilotDecisions).orderBy(desc(autopilotDecisions.createdAt)).limit(limit);
}

export async function logActivity(actionOrData: string | ActivityPayload, details?: string) {
  const d = await getDb();
  if (typeof actionOrData === "string") {
    await d.insert(activityLog).values({ action: actionOrData, details: details ? { text: details } : undefined });
  } else {
    await d.insert(activityLog).values({
      userId: actionOrData.userId ?? undefined,
      action: actionOrData.action,
      entityType: actionOrData.entityType,
      entityId: actionOrData.entityId == null ? undefined : String(actionOrData.entityId),
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
}

export async function createLead(data: FlexibleInsert<Pick<LeadInsert, "email"> & Partial<Omit<LeadInsert, "email">>>) {
  const d = await getDb();
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
  const [result] = await d.insert(leads).values(values).returning();
  return result;
}

export async function getLeadByEmail(email: string) {
  const d = await getDb();
  const rows = await d.select().from(leads).where(eq(leads.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function updateLead(id: number, data: FlexibleUpdate<LeadInsert>) {
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

export async function updateLeadStatus(id: number, status: NonNullable<LeadInsert["status"]>) {
  const d = await getDb();
  await d.update(leads).set({ status }).where(eq(leads.id, id));
}

// ─────────────────────────────────────────────────────────────
// SERVICE ORDERS (used by service-orders router)
// ─────────────────────────────────────────────────────────────

export async function getServiceOrderById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateServiceOrderStatus(
  id: number,
  status: NonNullable<ServiceOrderInsert["status"]>,
  extra?: FlexibleUpdate<ServiceOrderInsert>,
) {
  const d = await getDb();
  await d.update(serviceOrders).set({ status, ...(extra ?? {}), updatedAt: new Date() }).where(eq(serviceOrders.id, id));
}

export async function createServiceOrder(data: FlexibleInsert<ServiceOrderInsert>) {
  const d = await getDb();
  const [result] = await d.insert(serviceOrders).values(data).returning();
  const id = result.id;
  return { id, ...data };
}

export async function getServiceOrderBySessionId(sessionId: string) {
  const d = await getDb();
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
}

// ─────────────────────────────────────────────────────────────
// BUDGET & TASKS
// ─────────────────────────────────────────────────────────────

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

export async function markTaskDone(id: string, result?: MissionTaskInsert["result"]) {
  const d = await getDb();
  // WHERE status='in_progress' preserves 'waiting_human' if an agent set it during execution
  await d.update(missionTasks).set({ status: "completed", result, updatedAt: new Date() }).where(and(eq(missionTasks.id, id), eq(missionTasks.status, "in_progress")));
}

export async function markTaskFailed(id: string, error: string) {
  const d = await getDb();
  await d.update(missionTasks).set({ status: "failed", error, updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function enqueueTask(
  missionId: string,
  kind: string,
  payload: MissionTaskInsert["payload"],
  scheduledAt?: Date,
) {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(missionTasks).values({
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
  pilotPriceUsd?: number;
}): Promise<string> {
  const d = await getDb();
  const id = randomUUID();
  await d.insert(proposals).values({ id, ...data });
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

export async function listHighScanUsers(_unused_minScans_575 = 10) {
  const d = await getDb();
  return d.select().from(users).orderBy(desc(users.lastSignedIn)).limit(50);
}

export async function listInactiveUsersNoRecentScans(daysSinceLastScan = 30) {
  const d = await getDb();
  const cutoff = new Date(Date.now() - daysSinceLastScan * 86400000);
  return d.select().from(users).where(lte(users.lastSignedIn, cutoff)).limit(500);
}

export async function listUsersForOnboardingStep(_unused_step_586: string | number) {
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
      sql`${activityLog.details}->>'text' LIKE ${'%sub:' + subscriptionId + '%'}`
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

  import type { MissionStatus,MissionType } from "./missions/types";
  import { MISSION_STATUS_TO_DB } from "./missions/types";

export async function getMissions(statusFilter?: NonNullable<MissionInsert["status"]>) {
  const d = await getDb();
  if (statusFilter) {
    return d.select().from(missions).where(eq(missions.status, statusFilter));
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

export async function createTask(
  data: FlexibleInsert<Pick<MissionTaskInsert, "missionId" | "kind"> & Partial<Omit<MissionTaskInsert, "id" | "missionId" | "kind">>>,
) {
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
  await d.update(missions).set({ status: MISSION_STATUS_TO_DB[status] }).where(eq(missions.id, id));
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

export async function getProductById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function updateProduct(id: string, data: FlexibleUpdate<ProductInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

// ─── Authentication Helpers ──────────────────────────────────────────────────
export async function createAuthentication(data: FlexibleInsert<AuthenticationInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(authentications).values(data).returning();
  return { id: result.id };
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

export async function updateAuthenticationSharing(id: string, userId: number, isPublic: boolean, shareToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(authentications).set({ isPublic: isPublic ? 1 : 0, shareToken }).where(and(eq(authentications.id, id), eq(authentications.userId, userId)));
}

export async function incrementShareCount(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(authentications).set({ shareCount: sql`${authentications.shareCount} + 1` }).where(eq(authentications.id, id));
}

// ─── Certificate Helpers ─────────────────────────────────────────────────────
export async function createCertificate(data: FlexibleInsert<CertificateInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(certificates).values(data).returning();
  return result;
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
export async function createQrCode(data: FlexibleInsert<QrCodeInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(qrCodes).values(data).returning();
  return { id: result.id };
}

export async function getProductQrCodes(productId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(qrCodes).where(eq(qrCodes.productId, productId));
}

export async function incrementScanCount(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(qrCodes).set({ scanCount: sql`${qrCodes.scanCount} + 1`, lastScannedAt: new Date() }).where(eq(qrCodes.id, id));
}

// Node-singleton counterpart of identity-db-helpers.ts's Db-parameterized
// recordReputationEvent — same two-statement event-log-then-upsert, using
// getDb() internally like every other function in this file.
export async function recordReputationEvent(userId: number, eventType: string, pointsDelta: number) {
  const db = await getDb();
  if (!db) return;
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

export async function logScanEvent(data: { qrCodeId: string; productId: string; isAuthentic?: boolean; userAgent?: string; userId?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(qrScanEvents).values({
    qrCodeId: data.qrCodeId,
    productId: data.productId,
    isAuthentic: data.isAuthentic,
    userAgent: data.userAgent,
  });

  if (data.userId && data.isAuthentic) {
    await recordReputationEvent(data.userId, "scan_authenticity_confirmed", 1);
  }
}

export async function getRecentScanEvents(productId: string, limit = 20) {
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

export async function getNftById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(nfts).where(eq(nfts.id, id)).limit(1);
  return result[0];
}

export async function createNft(data: FlexibleInsert<NftInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(nfts).values(data).returning();
  return result;
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

export async function createCollection(data: FlexibleInsert<NftCollectionInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(nftCollections).values(data).returning();
  return { id: result.id };
}

// ─── Auction Helpers ─────────────────────────────────────────────────────────
export async function createAuction(data: FlexibleInsert<AuctionInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(auctions).values(data).returning();
  return { id: result.id };
}

export async function getActiveAuctions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auctions).where(eq(auctions.status, "active")).orderBy(desc(auctions.createdAt));
}

export async function getAuctionById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  return result[0];
}

export async function placeBid(auctionId: string, bidderId: number, amount: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(auctionBids).values({ auctionId, bidderId, amount });
  await db.update(auctions).set({
    currentBid: amount,
    highestBidderId: bidderId,
    bidCount: sql`${auctions.bidCount} + 1`,
  }).where(eq(auctions.id, auctionId));
}

export async function getAuctionBids(auctionId: string) {
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

export async function createSubscription(data: FlexibleInsert<SubscriptionInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(subscriptions).values(data).returning();
  return { id: result.id };
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

export async function recordUsage(data: FlexibleInsert<UsageRecordInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(usageRecords).values(data);
}

// ─── Invoice Helpers ─────────────────────────────────────────────────────────
export async function createInvoice(data: FlexibleInsert<InvoiceInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(invoices).values(data).returning();
  return { id: result.id };
}

export async function getUserInvoices(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
}

// ─── Payment Helpers ─────────────────────────────────────────────────────────
export async function createPayment(data: FlexibleInsert<PaymentInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(payments).values(data).returning();
  return { id: result.id };
}

export async function getUserPayments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
}

export async function updatePaymentStatus(id: string, status: NonNullable<PaymentInsert["status"]>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set({ status }).where(eq(payments.id, id));
}

// ─── Email Campaign Helpers ──────────────────────────────────────────────────
export async function createEmailCampaign(data: FlexibleInsert<EmailCampaignInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(emailCampaigns).values(data).returning();
  return { id: result.id };
}

export async function getUserEmailCampaigns(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailCampaigns).where(eq(emailCampaigns.userId, userId)).orderBy(desc(emailCampaigns.createdAt));
}

export async function updateEmailCampaign(id: string, data: FlexibleUpdate<EmailCampaignInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailCampaigns).set(data).where(eq(emailCampaigns.id, id));
}

// ─── Email Draft Helpers ─────────────────────────────────────────────────────
export async function createEmailDraft(data: FlexibleInsert<EmailDraftInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(emailDrafts).values(data).returning();
  return { id: result.id };
}

export async function getPendingDrafts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailDrafts).where(eq(emailDrafts.status, "pending")).orderBy(desc(emailDrafts.createdAt)).limit(200);
}

export async function updateDraftStatus(id: string, status: NonNullable<EmailDraftInsert["status"]>, approvedBy?: number) {
  const db = await getDb();
  if (!db) return;
  const updateData: Pick<EmailDraftInsert, "status" | "approvedBy" | "approvedAt" | "sentAt"> = { status };
  if (approvedBy) { updateData.approvedBy = approvedBy; updateData.approvedAt = new Date(); }
  if (status === "sent") updateData.sentAt = new Date();
  await db.update(emailDrafts).set(updateData).where(eq(emailDrafts.id, id));
}

// ─── Supply Chain Helpers ────────────────────────────────────────────────────
export async function createSupplyChainEvent(data: FlexibleInsert<SupplyChainEventInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(supplyChainEvents).values(data).returning();
  return { id: result.id };
}

export async function getProductSupplyChain(productId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(supplyChainEvents).where(eq(supplyChainEvents.productId, productId)).orderBy(supplyChainEvents.createdAt);
}

// ─── Referral Helpers ────────────────────────────────────────────────────────
export async function createReferral(data: FlexibleInsert<ReferralInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(referrals).values(data).returning();
  return { id: result.id };
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

export async function createAffiliate(data: FlexibleInsert<AffiliateInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(affiliates).values(data).returning();
  return { id: result.id };
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

export async function upsertAutopilotConfig(data: FlexibleInsert<AutopilotConfigInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(autopilotConfig).values(data).onConflictDoUpdate({ target: autopilotConfig.tenantId, set: data }).returning();
  return result?.id;
}

export async function createAutopilotDecision(data: FlexibleInsert<AutopilotDecisionInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
}

// ─── A/B Test Helpers ────────────────────────────────────────────────────────
export async function createAbTest(data: FlexibleInsert<AbTestInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(abTests).values(data).returning();
  return { id: result.id };
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
export async function createWhiteLabelClient(data: FlexibleInsert<WhiteLabelClientInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(whiteLabelClients).values(data).returning();
  return { id: result.id };
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
export async function createFraudAlert(data: FlexibleInsert<FraudAlertInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(fraudAlerts).values(data).returning();
  return { id: result.id };
}

export async function getOpenFraudAlerts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fraudAlerts).where(eq(fraudAlerts.status, "open")).orderBy(desc(fraudAlerts.createdAt));
}

// ─── Customer Health Helpers ─────────────────────────────────────────────────
export async function upsertHealthScore(
  userId: number,
  score: number,
  factors: CustomerHealthScoreInsert["factors"],
  trend: NonNullable<CustomerHealthScoreInsert["trend"]>,
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(customerHealthScores)
    .values({ userId, score, factors, trend })
    .onConflictDoUpdate({ target: customerHealthScores.userId, set: { score, factors, trend, lastCalculatedAt: new Date() } });
}

export async function getAllHealthScores() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(customerHealthScores).orderBy(desc(customerHealthScores.score)).limit(500);
}

// ─── Revenue Helpers ─────────────────────────────────────────────────────────
export async function recordRevenue(data: FlexibleInsert<RevenueRecordInsert>) {
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
  const [result] = await db.insert(notifications).values(data).returning();
  return { id: result.id };
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
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result?.count || 0;
}

export async function markNotificationRead(id: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteNotification(id: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function createSystemNotification(userId: number, title: string, message: string, type: InsertNotification["type"], actionUrl?: string) {
  return createNotification({ userId, type, title, message, isRead: false, actionUrl });
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
    .where(sql`${activityLog.details}->>'eventId' = ${eventId}`);
  return (row?.count ?? 0) > 0;
}

// ─── Paddle Subscription Helpers ──────────────────────────────────────────────

export async function upsertPaddleSubscription(data: {
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

export async function getAcceptanceCriteriaStatus() {
  return { total: 0, passed: 0, failed: 0, pending: 0 };
}

export async function getFunnelBySegmentAndChannel() {
  return [] as Array<{ segment: string; channel: string; leads: number; converted: number }>;
}

export async function getLeadCohorts() {
  return [] as Array<{ cohort: string; count: number; conversionRate: number }>;
}

// ─── QRON Helpers (backed by qr_codes + metadata) ────────────────────────────

export async function getQronList() {
  const d = await getDb();
  return d.select().from(qrCodes).orderBy(desc(qrCodes.createdAt)).limit(200);
}

export async function createQron(data: {
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
  const d = await getDb();
  return d.insert(qrCodes).values({
    userId: data.userId,
    productId: data.productId,
    shortCode: data.id,
    mode: data.mode ?? 'standard',
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

export async function getQronById(qronId: string) {
  const d = await getDb();
  const rows = await d.select().from(qrCodes).where(eq(qrCodes.shortCode, qronId)).limit(1);
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

export async function createQronScanVerdict(data: {
  qronId: string;
  scannedImageUrl: string;
  similarityScore: number;
  verdict: string;
  details: unknown;
}) {
  const d = await getDb();
  const rows = await d.select({ id: qrCodes.id, productId: qrCodes.productId })
    .from(qrCodes).where(eq(qrCodes.shortCode, data.qronId)).limit(1);
  const qr = rows[0];
  // qr_scan_events.productId is NOT NULL. The old code passed `?? 0`, inventing a
  // product that does not exist; with uuid keys that fails outright. If the QR is
  // not bound to a product there is no scan event to record.
  if (!qr || !qr.productId) return;
  await d.insert(qrScanEvents).values({
    qrCodeId: qr.id,
    productId: qr.productId,
    isAuthentic: data.verdict === 'authentic',
    userAgent: JSON.stringify({
      verdict: data.verdict,
      similarity: data.similarityScore,
      details: data.details,
      scannedImageUrl: data.scannedImageUrl,
    }),
  });
}

export async function updateQron(
  qronId: string,
  data: { verifiedScanCount?: number; fakeFlagCount?: number; trustScore?: number },
) {
  const d = await getDb();
  const rows = await d.select({ id: qrCodes.id, metadata: qrCodes.metadata })
    .from(qrCodes).where(eq(qrCodes.shortCode, qronId)).limit(1);
  const row = rows[0];
  if (!row) return;
  const merged = { ...(row.metadata as Record<string, unknown> ?? {}), ...data };
  await d.update(qrCodes)
    .set({ metadata: merged, updatedAt: new Date() })
    .where(eq(qrCodes.id, row.id));
}


// ============================================================================
// Hyperdrive-backed DB accessor for Workers runtime
// ============================================================================
// Per-request factory for Cloudflare Workers environment where Hyperdrive
// connection pooling is available via env.HYPERDRIVE binding.
// Unlike getDb() above (async, module-level singleton for Node.js),
// this factory creates a fresh drizzle client for each Workers request.
//
// Usage (in Workers handler / tRPC context):
//   const db = getHyperdriveDb(env);
//   const users = await db.query.users.findMany();

export function getHyperdriveDb(env: { HYPERDRIVE: { connectionString: string } }): ReturnType<typeof drizzle> {
  const workersPool = new Pool({ connectionString: env.HYPERDRIVE.connectionString });
  return drizzle(workersPool);
}

// Node-singleton counterpart of server/_core/db-helpers.ts's Db-parameterized
// getOpsSummary — same job-run aggregation, using getDb() internally like
// every other function in this file.
export async function getOpsSummary(windowHours = 24) {
  const db = await getDb();
  const since = new Date(Date.now() - windowHours * 3600_000);
  const runs = await db
    .select()
    .from(scheduledJobRuns)
    .where(gte(scheduledJobRuns.startedAt, since))
    .orderBy(desc(scheduledJobRuns.startedAt))
    .limit(500);

  const toUiStatus = (s: string) => (s === 'completed' ? 'success' : s === 'failed' ? 'failure' : s);

  type SummaryEntry = { success: number; failure: number; lastSeen: Date; lastError: string | null };
  const byJob = new Map<string, SummaryEntry>();
  for (const r of runs) {
    const entry = byJob.get(r.jobName) ?? { success: 0, failure: 0, lastSeen: r.startedAt, lastError: null };
    if (r.status === 'completed') entry.success++;
    if (r.status === 'failed') {
      entry.failure++;
      entry.lastError ??= r.error || '(no message)';
    }
    if (r.startedAt > entry.lastSeen) entry.lastSeen = r.startedAt;
    byJob.set(r.jobName, entry);
  }

  const summary = Array.from(byJob.entries())
    .map(([name, v]) => ({
      workflow: name,
      success: v.success,
      failure: v.failure,
      last_seen: v.lastSeen.toISOString(),
      last_error: v.lastError,
    }))
    .sort((a, b) => b.failure - a.failure || b.success - a.success);

  const failures = runs
    .filter(r => r.status === 'failed')
    .slice(0, 50)
    .map(r => ({
      workflow: r.jobName,
      error: r.error,
      payload: r.result ? JSON.stringify(r.result) : null,
      at: r.startedAt.toISOString(),
    }));

  const recent = runs.slice(0, 50).map(r => ({
    workflow: r.jobName,
    status: toUiStatus(r.status),
    at: r.startedAt.toISOString(),
  }));

  return {
    window_hours: windowHours,
    generated_at: new Date().toISOString(),
    totals: {
      success: runs.filter(r => r.status === 'completed').length,
      failure: runs.filter(r => r.status === 'failed').length,
    },
    summary,
    failures,
    recent,
  };
}
