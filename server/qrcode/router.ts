import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { invokeLLM } from "../_core/llm";

export const qrcodeRouter = router({
  generate: protectedProcedure.input(z.object({
    productId: z.number(),
    size: z.number().optional().default(300),
  })).mutation(async ({ ctx, input }) => {
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    if (product.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
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
  listForProduct: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ ctx, input }) => {
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    if (product.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    return await db.getProductQrCodes(input.productId);
  }),
  generateStorymode: protectedProcedure.input(z.object({
    productId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    if (product.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

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
      storyData = JSON.parse(response.choices[0].message.content as string);
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse story response" });
    }
    const metadata = { ...(product.metadata as any || {}), storymode: storyData };
    await db.updateProduct(product.id, { metadata });

    return { success: true, storymode: storyData };
  }),
});
