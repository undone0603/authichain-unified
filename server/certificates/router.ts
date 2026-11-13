import { randomBytes } from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createFeeCheckout,
  isFeeGateEnabled,
  requireFeePaid,
} from "./fee-gate";

async function assertOwnsCertificate(
  userId: number,
  certificateNumber: string
) {
  const cert = await db.getCertificateByNumber(certificateNumber);
  if (!cert || cert.userId !== userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Certificate not found",
    });
  }
  return cert;
}

export const certificatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserCertificates(ctx.user.id);
  }),
  // Truth is free: verification is public and must never sit behind a fee gate.
  verify: publicProcedure
    .input(z.object({ certificateNumber: z.string() }))
    .query(async ({ input }) => {
      const cert = await db.getCertificateByNumber(input.certificateNumber);
      if (!cert) return { valid: false, message: "Certificate not found" };
      if (cert.status === "revoked")
        return { valid: false, message: "Certificate has been revoked" };
      if (cert.expiresAt && cert.expiresAt < new Date())
        return { valid: false, message: "Certificate has expired" };
      const product = await db.getProductById(cert.productId);
      return { valid: true, certificate: cert, product };
    }),
  /** Start the one-time checkout for recording a receipt (shareable public certificate). */
  receiptCheckout: protectedProcedure
    .input(
      z.object({
        certificateNumber: z.string(),
        origin: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsCertificate(ctx.user.id, input.certificateNumber);
      return createFeeCheckout({
        kind: "receipt",
        certificateNumber: input.certificateNumber,
        user: ctx.user,
        origin: input.origin ?? "https://authichain.com",
      });
    }),
  /** Start the one-time checkout for the exportable evidence bundle. */
  evidenceCheckout: protectedProcedure
    .input(
      z.object({
        certificateNumber: z.string(),
        origin: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsCertificate(ctx.user.id, input.certificateNumber);
      return createFeeCheckout({
        kind: "evidence",
        certificateNumber: input.certificateNumber,
        user: ctx.user,
        origin: input.origin ?? "https://authichain.com",
      });
    }),
  /** Evidence is paid: certificate + chain anchors + product, gated on a paid evidence session. */
  evidence: protectedProcedure
    .input(
      z.object({
        certificateNumber: z.string(),
        sessionId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cert = await assertOwnsCertificate(
        ctx.user.id,
        input.certificateNumber
      );
      await requireFeePaid({
        kind: "evidence",
        certificateNumber: input.certificateNumber,
        userId: ctx.user.id,
        sessionId: input.sessionId,
      });
      const product = await db.getProductById(cert.productId);
      return {
        generatedAt: new Date().toISOString(),
        certificate: cert,
        product,
      };
    }),
  makePublic: protectedProcedure
    .input(
      z.object({
        authenticationId: z.string().uuid(),
        // Required only while CERT_FEE_GATE=on; ignored otherwise.
        certificateNumber: z.string().optional(),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (isFeeGateEnabled()) {
        if (!input.certificateNumber) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "certificateNumber required",
          });
        }
        await assertOwnsCertificate(ctx.user.id, input.certificateNumber);
        await requireFeePaid({
          kind: "receipt",
          certificateNumber: input.certificateNumber,
          userId: ctx.user.id,
          sessionId: input.sessionId,
        });
      }
      const shareToken = randomBytes(32).toString("hex");
      await db.updateAuthenticationSharing(
        input.authenticationId,
        ctx.user.id,
        true,
        shareToken
      );
      return { shareToken, shareUrl: `/certificate/${shareToken}` };
    }),
  getPublic: publicProcedure
    .input(z.object({ shareToken: z.string() }))
    .query(async ({ input }) => {
      const auth = await db.getAuthenticationByShareToken(input.shareToken);
      if (!auth || !auth.isPublic)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Certificate not found",
        });
      const product = await db.getProductById(auth.productId);
      await db.incrementShareCount(auth.id);
      return { authentication: auth, product };
    }),
});
