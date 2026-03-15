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
export function createMission() {
  throw new Error("createMission must be imported from the missions module, not db.ts");
}
