/**
 * Zero-Cost Voucher Service
 * (c) 2026 AuthiChain Inc.
 * 
 * Allows users to claim $0 "Gas Vouchers" for their first 5 mints.
 * Sponsored by the AuthiChain Treasury for global scaling.
 */
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export async function claimVoucher(userId: number) {
  const d = await getDb();
  
  // Logic: check if user has already claimed max vouchers
  const [user] = await d.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user) throw new Error("User not found");
  
  // Simulated voucher tracking in user metadata for $0 infra
  const metadata = (user.metadata as any) || {};
  const claimed = metadata.vouchersClaimed || 0;
  
  if (claimed >= 5) {
    return { success: false, reason: "Voucher limit reached for $0 scaling tier." };
  }
  
  const newMetadata = { ...metadata, vouchersClaimed: claimed + 1 };
  await d.update(users).set({ metadata: newMetadata }).where(eq(users.id, userId));
  
  return { 
    success: true, 
    voucherCode: `AC-ZERO-${Math.random().toString(36).substring(7).toUpperCase()}`,
    remaining: 5 - (claimed + 1)
  };
}
