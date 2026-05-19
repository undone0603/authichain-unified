import { eq } from "drizzle-orm";
import { db, getOne } from "../db";
import { users, type InsertUser } from "@db/schema";
import { ENV } from "../core/env";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  try {
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
      .onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  return getOne(db.select().from(users).where(eq(users.openId, openId)).limit(1));
}

export async function getUserById(id: number) {
  return getOne(db.select().from(users).where(eq(users.id, id)).limit(1));
}
