/**
 * Vouch-to-Earn Loyalty Service
 * (c) 2026 AuthiChain Inc.
 * 
 * Rewards users with $QRON fractions for verifying physical products.
 * Drives global data acquisition and viral adoption.
 */
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export async function awardVouchPoints(userId: number, productId: number) {
  const d = await getDb();
  
  // Logic: Award 10 "Trust Points" (0.1 $QRON equivalent) per verified vouch
  const [user] = await d.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const metadata = (user.metadata as any) || {};
  const points = (metadata.trustPoints || 0) + 10;
  
  const newMetadata = { ...metadata, trustPoints: points };
  await d.update(users).set({ metadata: newMetadata }).where(eq(users.id, userId));
  
  return {
    success: true,
    pointsAwarded: 10,
    totalPoints: points,
    qronEquivalent: (points / 100).toFixed(2) + " $QRON"
  };
}

export async function awardReferralPoints(userId: number, referredEmail: string) {
  const d = await getDb();
  
  // Logic: Award 50 "Trust Points" (0.5 $QRON) for inviting a brand
  const [user] = await d.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const metadata = (user.metadata as any) || {};
  const points = (metadata.trustPoints || 0) + 50;
  
  const newMetadata = { ...metadata, trustPoints: points };
  await d.update(users).set({ metadata: newMetadata }).where(eq(users.id, userId));
  
  return {
    success: true,
    pointsAwarded: 50,
    totalPoints: points,
    qronEquivalent: (points / 100).toFixed(2) + " $QRON"
  };
}
