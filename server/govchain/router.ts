import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { issueSovereignPassport, verifySovereignPassport } from "./vc-service";
import * as db from "../db";
import { getDb } from "../db";
import { activityLog } from "../../drizzle/schema";
import { eq, count, countDistinct } from "drizzle-orm";
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
   * GovChain Stats: Real-time metrics for the government vertical
   */
  stats: publicProcedure.query(async () => {
    const d = await getDb();
    if (!d) {
      return { activeAgencies: 0, passportsIssued: 0, complianceScore: 100, network: "GovChain Federal Hub (FIPS 140-2)" };
    }
    const [issuedRow] = await d.select({ total: count() }).from(activityLog)
      .where(eq(activityLog.action, "govchain_passport_issued"));
    const [agenciesRow] = await d.select({ total: countDistinct(activityLog.userId) }).from(activityLog)
      .where(eq(activityLog.action, "govchain_passport_issued"));
    const [verifiedRow] = await d.select({ total: count() }).from(activityLog)
      .where(eq(activityLog.action, "govchain_passport_verified"));
    const [failedRow] = await d.select({ total: count() }).from(activityLog)
      .where(eq(activityLog.action, "govchain_passport_verification_failed"));
    const verified = verifiedRow?.total ?? 0;
    const failed = failedRow?.total ?? 0;
    const totalVerifications = verified + failed;
    const complianceScore = totalVerifications > 0 ? Math.round((verified / totalVerifications) * 1000) / 10 : 100;
    return {
      activeAgencies: agenciesRow?.total ?? 0,
      passportsIssued: issuedRow?.total ?? 0,
      complianceScore,
      network: "GovChain Federal Hub (FIPS 140-2)"
    };
  }),
});
