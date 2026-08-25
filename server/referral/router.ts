import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getUserReferrals, getReferralByCode } from "../identity-db-helpers";
import { z } from "zod";
import {
  createReferralCode,
  trackReferralClick,
  completeReferral,
  getReferralStats,
} from "./core";

export const referralRouter = router({
  generateCode: protectedProcedure.mutation(async ({ ctx }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await createReferralCode(db, ctx.user.id);
  }),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); // see generateCode() above
    return await getReferralStats(db, ctx.user.id);
  }),
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); // see generateCode() above
    return await getUserReferrals(db, ctx.user.id);
  }),
  trackClick: publicProcedure.input(z.object({
    referralCode: z.string(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    referer: z.string().optional(),
    landingPage: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb(); // see generateCode() above
    await trackReferralClick(db, input);
    return { success: true };
  }),
  validate: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
    const db = await getDb(); // see generateCode() above
    const referral = await getReferralByCode(db, input.code);
    return { valid: !!referral, referral };
  }),
  complete: protectedProcedure.input(z.object({
    referralCode: z.string(),
    referredEmail: z.string().email(),
    tier: z.enum(["starter", "professional", "enterprise", "agency"]).optional().default("starter"),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see generateCode() above
    await completeReferral(db, {
      referralCode: input.referralCode,
      referredId: ctx.user.id,
      referredEmail: input.referredEmail,
      tier: input.tier,
    });
    return { success: true };
  }),
});
