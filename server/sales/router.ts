import { z } from "zod";
import { router, rateLimitedPublicProcedure, protectedProcedure } from "../_core/trpc";
import { calculateROI } from "./roi-service";
import { calculateLeadScore } from "./scoring-service";
import * as db from "../db";

const KNOWN_INDUSTRIES = [
  // Values sent by the ROI calculator UI
  "medtech", "timepieces", "pharma", "luxury", "cannabis", "electronics",
  // Additional verticals used by other callers / tests
  "retail", "food_beverage", "automotive", "cosmetics", "supply_chain", "other",
] as const;

export const salesRouter = router({
  /**
   * Public: Calculate ROI for a potential customer
   */
  calculateRoi: rateLimitedPublicProcedure
    .input(z.object({
      numProducts: z.number().int().min(1).max(10_000_000),
      complianceHoursPerMonth: z.number().min(0).max(10_000),
      hourlyRate: z.number().min(0).max(100_000),
      existingTechCosts: z.number().min(0).max(1_000_000_000),
      industry: z.enum(KNOWN_INDUSTRIES),
      userEmail: z.string().email().optional(),
      // Honeypot: real browsers leave this absent; bots often fill it
      _hp: z.string().max(0).optional(),
    }))
    .mutation(async ({ input }) => {
      // Reject if honeypot field was filled
      if (input._hp) return { blocked: true } as any;

      const results = calculateROI(input);

      // Track lead if email provided
      if (input.userEmail) {
        let lead = await db.getLeadByEmail(input.userEmail);
        if (!lead) {
          lead = await db.createLead({
            email: input.userEmail,
            industry: input.industry,
            source: "roi_calculator"
          });
        }

        await db.updateLead(lead.id, {
          roiCalculated: true,
          numProducts: input.numProducts,
          roiSavings: results.year1Savings
        });

        await calculateLeadScore(lead.id);
      }

      return results;
    }),

  /**
   * Track interactive demo engagement
   */
  trackDemoActivity: rateLimitedPublicProcedure
    .input(z.object({
      email: z.string().email(),
      event: z.enum(["demo_start", "demo_complete", "demo_interaction", "demo_feature_view"]),
    }))
    .mutation(async ({ input }) => {
      const lead = await db.getLeadByEmail(input.email);
      if (lead) {
        await db.incrementInteractionCount(lead.id);
        if (input.event === "demo_start") {
          await db.updateLead(lead.id, { demoStarted: true });
        }
        await calculateLeadScore(lead.id);
      }
      return { success: true };
    }),

  /**
   * Get current lead status
   */
  getLeadStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return await db.getLeadByEmail(ctx.user.email ?? "");
    }),
});
