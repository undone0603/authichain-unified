import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, type InsertUser } from "../../drizzle/schema";
import { ENV } from "../_core/env";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const db = await getDb();
    const values: InsertUser = {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role,
      lastSignedIn: user.lastSignedIn ?? new Date(),
    };

    const updateSet: Partial<InsertUser> = {};
    if (user.name !== undefined) updateSet.name = user.name ?? null;
    if (user.email !== undefined) updateSet.email = user.email ?? null;
    if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod ?? null;
    if (user.role !== undefined) updateSet.role = user.role;
    updateSet.lastSignedIn = user.lastSignedIn ?? new Date();

    if (!values.role && user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    await db.insert(users)
      .values(values)
      .onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
<<<<<<< HEAD
  if (!db) return null;
=======
>>>>>>> origin/add-agentz-editable
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: number) {
  const db = await getDb();
<<<<<<< HEAD
  if (!db) return null;
=======
>>>>>>> origin/add-agentz-editable
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
