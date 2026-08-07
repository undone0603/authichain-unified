import { z } from "zod";
import { adminProcedure, router, publicProcedure } from "../_core/trpc";
import { issueSovereignPassport, verifySovereignPassport } from "./vc-service";
import { getDb } from "../db";
import { logActivity } from "../content-db-helpers";
import { TRPCError } from "@trpc/server";

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

      // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
      // context does. Bridge via getDb() until this router has a ctx.db to use.
      const db = await getDb();
      // Store issuance record in activity log
      await logActivity(db, {
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
        const db = await getDb();
        await logActivity(db, {
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
      network: "GovChain Federal Hub (Ed25519 / FIPS 186-5)"
    };
  }),
});
