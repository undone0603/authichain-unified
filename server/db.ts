import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc } from "drizzle-orm";
import {
  users,
  sessions,
  authenticatorDevices,
  verificationTokens,
  organizations,
  memberships,
  invitations,
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
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from './core/env';

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
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
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
