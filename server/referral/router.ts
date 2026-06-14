import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import {
  createReferralCode,
  trackReferralClick,
  completeReferral,
  getReferralStats,
} from "./core";

export const referralRouter = router({
  generateCode: protectedProcedure.mutation(async ({ ctx }) => {
    return await createReferralCode(ctx.user.id);
  }),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return await getReferralStats(ctx.user.id);
  }),
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserReferrals(ctx.user.id);
  }),
  trackClick: publicProcedure.input(z.object({
    referralCode: z.string(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    referer: z.string().optional(),
    landingPage: z.string().optional(),
  })).mutation(async ({ input }) => {
    await trackReferralClick(input);
    return { success: true };
  }),
  validate: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
    const referral = await db.getReferralByCode(input.code);
    return { valid: !!referral, referral };
  }),
  complete: protectedProcedure.input(z.object({
    referralCode: z.string(),
    referredEmail: z.string().email(),
    tier: z.enum(["starter", "professional", "enterprise", "agency"]).optional().default("starter"),
  })).mutation(async ({ ctx, input }) => {
    await completeReferral({
      referralCode: input.referralCode,
      referredId: ctx.user.id,
      referredEmail: input.referredEmail,
      tier: input.tier,
    });
    
    // Viral Rewards: Award referral points to the referrer
    const { awardReferralPoints } = await import("../loyalty-service");
    const referral = await db.getReferralByCode(input.referralCode);
    if (referral) {
       await awardReferralPoints(referral.referrerId, input.referredEmail);
    }

    return { success: true };
  }),

  inviteBrand: protectedProcedure.input(z.object({
    email: z.string().email(),
    company: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // 1. Capture as a lead for AgentZ outreach
    const { ingestLeadAndRoute } = await import("../revenue-orchestrator");
    await ingestLeadAndRoute({
      email: input.email,
      company: input.company,
      source: "viral_referral_invite",
      metadata: { invitedBy: ctx.user.id }
    });

    // 2. Award instant bounty points to the user for the lead
    const { awardReferralPoints } = await import("../loyalty-service");
    const reward = await awardReferralPoints(ctx.user.id, input.email);

    return { 
      success: true, 
      message: "Invitation sent. Truth Points awarded.",
      reward 
    };
  }),
});
