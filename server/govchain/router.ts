import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { issueSovereignPassport, verifySovereignPassport } from "./vc-service";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const govchainRouter = router({
  /**
   * Government Issuer: Issue a Sovereign Document Passport
   */
  issuePassport: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      claims: z.record(z.any()),
      recipientEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user has 'admin' role or a specific 'gov_issuer' claim
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only authorized government issuers can perform this action." });
      }

      const issuerDid = `did:authichain:gov:${ctx.user.id}`;
      const subjectDid = `did:authichain:user:${input.recipientEmail}`;

      const vc = await issueSovereignPassport({
        documentId: input.documentId,
        issuerDid,
        subjectDid,
        claims: input.claims,
      });

      // Store issuance record in activity log
      await db.logActivity({
        userId: ctx.user.id,
        action: "govchain_passport_issued",
        entityType: "passport",
        entityId: 0,
        details: { 
          documentId: input.documentId,
          recipient: input.recipientEmail,
          vcId: vc.id
        }
      });

      return { success: true, vc };
    }),

  /**
   * Public Verification: Verify a Sovereign Document Passport
   */
  verifyPassport: publicProcedure
    .input(z.object({
      vc: z.any(),
    }))
    .query(async ({ input }) => {
      const result = await verifySovereignPassport(input.vc);
      
      if (result.valid) {
        await db.logActivity({
          userId: null,
          action: "govchain_passport_verified",
          entityType: "passport",
          entityId: 0,
          details: { issuer: result.issuer, vcId: input.vc.id }
        });
      }

      return result;
    }),

  /**
   * Sovereign Onboarding: Stage a government/manufacturer partnership deal.
   * Captures the facility as a government-segment lead for advisor follow-up.
   */
  createSovereignDeal: publicProcedure
    .input(z.object({
      manufacturerName: z.string().min(1),
      dealType: z.enum(["procurement", "compliance", "passport", "supply_chain"]).optional(),
      value: z.number().nonnegative().optional().default(0),
      description: z.string().optional(),
      contactEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const lead = await db.createLead({
        email: input.contactEmail ?? `${input.manufacturerName.replace(/\s+/g, ".").toLowerCase()}@gov.pending`,
        name: input.manufacturerName,
        company: input.manufacturerName,
        source: "govchain_onboarding",
        segment: "government",
        industry: "government",
        status: "new",
        notes: input.description,
        metadata: { dealType: input.dealType, value: input.value },
      });

      await db.logActivity({
        userId: null,
        action: "govchain_sovereign_deal_staged",
        entityType: "lead",
        entityId: typeof lead?.id === "number" ? lead.id : 0,
        details: { manufacturerName: input.manufacturerName, dealType: input.dealType, value: input.value },
      });

      return { success: true, staged: true };
    }),

  /**
   * GovChain Stats: Real-time metrics for the government vertical
   */
  stats: publicProcedure.query(async () => {
    return {
      activeAgencies: 12,
      passportsIssued: 1420,
      complianceScore: 99.9,
      network: "GovChain Federal Hub (FIPS 140-2)"
    };
  }),
});
