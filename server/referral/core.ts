import { nanoid } from "nanoid";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { referrals, referralClicks, affiliates } from "../../drizzle/schema";

export const COMMISSION_RATES: Record<string, number> = {
  starter: 0.10,      // 10%
  professional: 0.15, // 15%
  enterprise: 0.20,   // 20%
  agency: 0.25,       // 25%
};

export const AFFILIATE_BONUS_TIERS = [
  { threshold: 5,  bonus: 1000,  tier: "silver" },   // $10 bonus at 5 referrals
  { threshold: 10, bonus: 2500,  tier: "gold" },     // $25 bonus at 10 referrals
  { threshold: 25, bonus: 7500,  tier: "platinum" }, // $75 bonus at 25 referrals
];

export function generateReferralCode(userId: number): string {
  return `REF-${userId}-${nanoid(6).toUpperCase()}`;
}

export function generateAffiliateCode(userId: number): string {
  return `AFF-${userId}-${nanoid(6).toUpperCase()}`;
}

export async function createReferralCode(referrerId: number): Promise<{ id: number; referralCode: string }> {
  const code = generateReferralCode(referrerId);
  const [result] = await db.insert(referrals).values({
    referrerId,
    referralCode: code,
    status: "pending",
  }).returning();
  return { id: result.id, referralCode: code };
}

export async function trackReferralClick(params: {
  referralCode: string;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  landingPage?: string;
}): Promise<void> {
  await db.insert(referralClicks).values(params);
}

export async function completeReferral(params: {
  referralCode: string;
  referredId: number;
  referredEmail: string;
  tier: string;
}): Promise<void> {
  const rate = COMMISSION_RATES[params.tier] || COMMISSION_RATES.starter;
  await db.update(referrals)
    .set({
      referredId: params.referredId,
      referredEmail: params.referredEmail,
      status: "converted",
      tier: params.tier as any,
      convertedAt: new Date(),
    })
    .where(eq(referrals.referralCode, params.referralCode));
}

export async function getReferralStats(referrerId: number) {
  const all = await db.select().from(referrals).where(eq(referrals.referrerId, referrerId));
  const converted = all.filter((r: typeof all[number]) => r.status === "converted");
  const totalCommission = converted.reduce((sum: number, r: typeof all[number]) => sum + parseFloat(r.commissionPaid || "0"), 0);
  return {
    totalReferrals: all.length,
    convertedReferrals: converted.length,
    pendingReferrals: all.filter((r: typeof all[number]) => r.status === "pending").length,
    totalCommission,
    conversionRate: all.length > 0 ? Math.round((converted.length / all.length) * 100) : 0,
  };
}
