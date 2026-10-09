  import { z } from "zod";
  import { adminProcedure,publicProcedure,router } from "../_core/trpc";
  import * as db from "../db";
  import { issueSovereignPassport,verifySovereignPassport } from "./vc-service";

export const govchainRouter = router({
  /**
   * Government Issuer: Issue a Sovereign Document Passport
   */
  issuePassport: adminProcedure
    .input(z.object({
      documentId: z.string(),
      claims: z.record(z.any()),
      recipientEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
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
   * GovChain Stats: no figures are published. The previous values were hard-coded,
   * not measured. Same keys as before, all null, so existing callers keep a
   * safe shape.
   */
  stats: publicProcedure.query(async (): Promise<{
    activeAgencies: number | null;
    passportsIssued: number | null;
    complianceScore: number | null;
    network: string | null;
  }> => {
    return {
      activeAgencies: null,
      passportsIssued: null,
      complianceScore: null,
      network: null,
    };
  }),
});
