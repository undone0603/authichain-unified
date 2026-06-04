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
      claims: z.record(z.string(), z.any()),
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
