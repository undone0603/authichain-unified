import { z } from "zod";
import { router, rateLimitedPublicProcedure, protectedProcedure } from "../_core/trpc";
import { calculateROI } from "./roi-service";
import { calculateLeadScore } from "./scoring-service";
import * as db from "../db";
import { ENV } from "../_core/env";

const INDUSTRY_TO_SEGMENT: Record<string, string> = {
  medtech: "MEDTECH",
  pharma: "PHARMA",
  timepieces: "LUXURY",
  luxury: "LUXURY",
  cannabis: "RETAIL",
  electronics: "RETAIL",
  retail: "RETAIL",
  food_beverage: "RETAIL",
  automotive: "RETAIL",
  cosmetics: "LUXURY",
  supply_chain: "RETAIL",
  other: "RETAIL",
};

const INDUSTRY_TO_MISSION: Record<string, string> = {
  medtech: "MEDTECH_OUTREACH",
  pharma: "PHARMA_OUTREACH",
  timepieces: "TIMEPIECE_OUTREACH",
  luxury: "LUXURY_OUTREACH",
};

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
          }) as any;
        }

        await db.updateLead(lead.id, {
          roiCalculated: true,
          numProducts: input.numProducts,
          roiSavings: results.year1Savings
        });

        await calculateLeadScore(lead.id);

        // Immediately enqueue outreach when the pipeline is enabled.
        // New leads from the ROI calculator are warm (self-identified intent) —
        // don't wait for the daily job to pick them up.
        if (ENV.autonomousPipelineEnabled) {
          try {
            const segment = INDUSTRY_TO_SEGMENT[input.industry] ?? "RETAIL";
            const missionType = (INDUSTRY_TO_MISSION[input.industry] ?? "RETAIL_PILOT") as any;
            const missionId = await db.createMission(missionType);
            await db.enqueueTask(missionId, "DRAFT_OUTBOUND_EMAIL", {
              leadEmail: input.userEmail,
              segment,
              sequence: 1,
              roiSavings: results.year1Savings,
              industry: input.industry,
            });
          } catch {
            // Non-fatal — lead is still captured even if task enqueue fails
          }
        }
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
<<<<<<< HEAD
      // Assuming users can see their own lead status
=======
>>>>>>> origin/add-agentz-editable
      return await db.getLeadByEmail(ctx.user.email ?? "");
    }),
});
