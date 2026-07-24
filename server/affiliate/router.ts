import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getAffiliateByUserId, getAffiliateCommissions, createAffiliate, getUserReferrals } from "../identity-db-helpers";
import { z } from "zod";
import { generateAffiliateCode, AFFILIATE_BONUS_TIERS, COMMISSION_RATES } from "../referral/core";

// Stored on the affiliate record as the BASE rate. Actual payout is per-plan and
// recurring via commissionForPlan() (starter 10% → agency 25%) — see the
// invoice.paid webhook. Override the base via AFFILIATE_BASE_RATE_PCT.
const AFFILIATE_BASE_RATE = (() => {
  const env = Number(process.env.AFFILIATE_BASE_RATE_PCT);
  const pct = Number.isFinite(env) && env > 0 && env <= 100 ? env : COMMISSION_RATES.starter * 100;
  return pct.toFixed(2);
})();

export const affiliateRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getAffiliateByUserId(db, ctx.user.id);
  }),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); // see getStatus() above
    const affiliate = await getAffiliateByUserId(db, ctx.user.id);
    if (!affiliate) return null;
    const commissions = await getAffiliateCommissions(db, affiliate.id);
    const totalEarned = parseFloat(affiliate.totalEarnings || "0");
    const pendingPayout = parseFloat(affiliate.pendingPayout || "0");
    const nextTier = AFFILIATE_BONUS_TIERS.find(t => (affiliate.totalReferrals || 0) < t.threshold);
    return {
      affiliate,
      commissions,
      totalEarned,
      pendingPayout,
      nextTierThreshold: nextTier?.threshold ?? null,
      nextTierBonus: nextTier?.bonus ?? null,
    };
  }),
  submitApplication: protectedProcedure.input(z.object({
    paypalEmail: z.string().email().optional(),
    payoutMethod: z.string().optional().default("paypal"),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see getStatus() above
    const existing = await getAffiliateByUserId(db, ctx.user.id);
    if (existing) return { success: false, message: "Already enrolled in affiliate program" };
    const code = generateAffiliateCode(ctx.user.id);
    const result = await createAffiliate(db, {
      userId: ctx.user.id,
      affiliateCode: code,
      status: "active",
      commissionRate: AFFILIATE_BASE_RATE,
      payoutMethod: input.payoutMethod,
      payoutDetails: input.paypalEmail ? { paypalEmail: input.paypalEmail } : null,
    });
    return { success: true, affiliateCode: code, id: result.id };
  }),
  getReferrals: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); // see getStatus() above
    return await getUserReferrals(db, ctx.user.id);
  }),
});
