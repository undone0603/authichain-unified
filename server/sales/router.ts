import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { calculateROI } from "./roi-service";
import { calculateLeadScore } from "./scoring-service";
import * as db from "../db";

export const salesRouter = router({
  /**
   * Public: Calculate ROI for a potential customer
   */
  calculateRoi: publicProcedure
    .input(z.object({
      numProducts: z.number(),
      complianceHoursPerMonth: z.number(),
      hourlyRate: z.number(),
      existingTechCosts: z.number(),
      industry: z.string(),
      userEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
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
  trackDemoActivity: publicProcedure
    .input(z.object({
      email: z.string().email(),
      event: z.string(),
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
      // Assuming users can see their own lead status
      return await db.getLeadByEmail(ctx.user.email);
    }),
});
