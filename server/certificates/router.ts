import { randomBytes } from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  getUserCertificates,
  getCertificateByNumber,
  getProductById,
  updateAuthenticationSharing,
  getAuthenticationByShareToken,
  incrementShareCount,
} from "../identity-db-helpers";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const certificatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getUserCertificates(db, ctx.user.id);
  }),
  verify: publicProcedure.input(z.object({ certificateNumber: z.string() })).query(async ({ input }) => {
    const db = await getDb(); // see list() above
    const cert = await getCertificateByNumber(db, input.certificateNumber);
    if (!cert) return { valid: false, message: "Certificate not found" };
    if (cert.status === "revoked") return { valid: false, message: "Certificate has been revoked" };
    if (cert.expiresAt && cert.expiresAt < new Date()) return { valid: false, message: "Certificate has expired" };
    const product = await getProductById(db, cert.productId);
    return { valid: true, certificate: cert, product };
  }),
  makePublic: protectedProcedure.input(z.object({ authenticationId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see list() above
    const shareToken = randomBytes(32).toString("hex");
    await updateAuthenticationSharing(db, input.authenticationId, ctx.user.id, true, shareToken);
    return { shareToken, shareUrl: `/certificate/${shareToken}` };
  }),
  getPublic: publicProcedure.input(z.object({ shareToken: z.string() })).query(async ({ input }) => {
    const db = await getDb(); // see list() above
    const auth = await getAuthenticationByShareToken(db, input.shareToken);
    if (!auth || !auth.isPublic) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
    const product = await getProductById(db, auth.productId);
    await incrementShareCount(db, auth.id);
    return { authentication: auth, product };
  }),
});
