import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { invokeLLM, parseLLMContent } from "../_core/llm";
import { verifyHash, type QRVerificationRecord } from "../_core/verification";
import type { Product } from "../../src/db/schema";

async function getOwnedProduct(productId: number, userId: number): Promise<Product> {
  const product = await db.getProductById(productId);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
  if (product.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return product;
}

export const qrcodeRouter = router({
  generate: protectedProcedure.input(z.object({
    productId: z.number(),
    size: z.number().optional().default(300),
    batchId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const product = await getOwnedProduct(input.productId, ctx.user.id);
    const verifyUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "https://authichain.com"}/verify/${product.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: input.size, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
    await db.createQrCode({ productId: input.productId, userId: ctx.user.id, qrData: verifyUrl, qrImageUrl: qrDataUrl });
    return { qrCodeDataUrl: qrDataUrl, verifyUrl };
  }),

  scan: publicProcedure.input(z.object({
    productId: z.number(),
    hash: z.string().optional(),  // present when scanning a hash-signed QR code
  })).query(async ({ input }) => {
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

    const qrCodes = await db.getProductQrCodes(input.productId);
    if (qrCodes.length > 0) {
      await db.incrementScanCount(qrCodes[0].id);
    }

    // Hash validation against the stored QR record (when hash is present)
    let hashResult: { valid: boolean; message: string } | null = null;
    if (input.hash && qrCodes.length > 0) {
      const meta = qrCodes[0].metadata as Record<string, unknown> | null;
      if (meta?.hash && meta?.expiresAt) {
        const storedRecord: QRVerificationRecord = {
          id:        (meta.verificationId as string) ?? '',
          hash:      meta.hash as string,
          productId: String(input.productId),
          issuedAt:  new Date(),
          expiresAt: new Date(meta.expiresAt as string),
          scanCount: qrCodes[0].scanCount ?? 0,
          revoked:   false,
        };
        const result = verifyHash(input.hash, storedRecord);
        hashResult = { valid: result.valid, message: result.message };
      }
    }

    // Fire-and-forget scan event log
    if (qrCodes.length > 0) {
      db.logScanEvent({
        qrCodeId: qrCodes[0].id,
        productId: input.productId,
        isAuthentic: hashResult?.valid ?? undefined,
      }).catch(() => {});
    }

    return {
      product,
      scanCount: (qrCodes[0]?.scanCount || 0) + 1,
      hashVerification: hashResult,
    };
  }),
  listForProduct: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ ctx, input }) => {
    await getOwnedProduct(input.productId, ctx.user.id);
    return await db.getProductQrCodes(input.productId);
  }),
  scanHistory: protectedProcedure.input(z.object({
    productId: z.number(),
    limit: z.number().min(1).max(100).default(20),
  })).query(async ({ ctx, input }) => {
    await getOwnedProduct(input.productId, ctx.user.id);
    return await db.getRecentScanEvents(input.productId, input.limit);
  }),
  generateStorymode: protectedProcedure.input(z.object({
    productId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const product = await getOwnedProduct(input.productId, ctx.user.id);

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a cinematic brand storyteller for AuthiChain. Create a 3-chapter 'Storymode' narrative for a product based on its metadata. Each chapter should have a title and a 2-3 sentence description. Tone: luxury, high-fidelity, futuristic, authoritative." },
        { role: "user", content: `Product: ${product.name}. Brand: ${product.brand}. Category: ${product.category}. Description: ${product.description}.` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "storymode_narrative",
          strict: true,
          schema: {
            type: "object",
            properties: {
              chapters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    content: { type: "string" }
                  },
                  required: ["title", "content"],
                  additionalProperties: false
                }
              }
            },
            required: ["chapters"],
            additionalProperties: false
          }
        }
      }
    });

    let storyData: { chapters: Array<{ title: string; content: string }> };
    try {
      storyData = parseLLMContent(response.choices[0].message.content);
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse story response" });
    }
    const metadata = { ...(product.metadata as Record<string, unknown> ?? {}), storymode: storyData };
    await db.updateProduct(product.id, { metadata });

    return { success: true, storymode: storyData };
  }),
});
