import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const certificatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserCertificates(ctx.user.id);
  }),
  verify: publicProcedure.input(z.object({ certificateNumber: z.string() })).query(async ({ input }) => {
    const cert = await db.getCertificateByNumber(input.certificateNumber);
    if (!cert) return { valid: false, message: "Certificate not found" };
    if (cert.status === "revoked") return { valid: false, message: "Certificate has been revoked" };
    if (cert.expiresAt && cert.expiresAt < new Date()) return { valid: false, message: "Certificate has expired" };
    const product = await db.getProductById(cert.productId);
    return { valid: true, certificate: cert, product };
  }),
  makePublic: protectedProcedure.input(z.object({ authenticationId: z.number() })).mutation(async ({ input }) => {
    const crypto = await import("crypto");
    const shareToken = crypto.randomBytes(32).toString("hex");
    await db.updateAuthenticationSharing(input.authenticationId, true, shareToken);
    return { shareToken, shareUrl: `/certificate/${shareToken}` };
  }),
  getPublic: publicProcedure.input(z.object({ shareToken: z.string() })).query(async ({ input }) => {
    const auth = await db.getAuthenticationByShareToken(input.shareToken);
    if (!auth || !auth.isPublic) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
    const product = await db.getProductById(auth.productId);
    await db.incrementShareCount(auth.id);
    return { authentication: auth, product };
  }),
});
