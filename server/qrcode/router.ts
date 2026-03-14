import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";

export const qrcodeRouter = router({
  generate: protectedProcedure.input(z.object({
    productId: z.number(),
    size: z.number().optional().default(300),
  })).mutation(async ({ ctx, input }) => {
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    const verifyUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "https://authichain.com"}/verify/${product.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: input.size, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
    await db.createQrCode({ productId: input.productId, userId: ctx.user.id, qrData: verifyUrl, qrImageUrl: qrDataUrl });
    return { qrCodeDataUrl: qrDataUrl, verifyUrl };
  }),
  scan: publicProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    const qrCodes = await db.getProductQrCodes(input.productId);
    if (qrCodes.length > 0) await db.incrementScanCount(qrCodes[0].id);
    return { product, scanCount: (qrCodes[0]?.scanCount || 0) + 1 };
  }),
  listForProduct: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
    return await db.getProductQrCodes(input.productId);
  }),
});
