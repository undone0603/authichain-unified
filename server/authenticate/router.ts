import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM, parseLLMContent } from "../_core/llm";
import { nanoid } from "nanoid";
import { triggerMacrohardEvent } from "../macrohard/service";
import { rewardAgentForVerification } from "../character-service";

export const authenticateRouter = router({
  analyze: protectedProcedure.input(z.object({
    productId: z.number(),
    imageUrl: z.string().url().refine(u => u.startsWith("https://"), { message: "imageUrl must use HTTPS" }),
  })).mutation(async ({ ctx, input }) => {
    const quotaResult = await db.consumeSubscriptionQuota(ctx.user.id);
    if (quotaResult === "exceeded") throw new TRPCError({ code: "FORBIDDEN", message: "Monthly quota exceeded. Please upgrade your plan." });
    const sub = await db.getUserSubscription(ctx.user.id);
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    if (product.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert luxury product authenticator with blockchain verification capabilities. Analyze the provided product image and determine if it is authentic or counterfeit. Provide detailed reasoning, a confidence score (0-100), red flags, and authentic markers." },
        { role: "user", content: [
          { type: "text" as const, text: `Authenticate this ${product.brand || ""} ${product.name}. Serial: ${product.serialNumber || "N/A"}. Category: ${product.category || "general"}` },
          { type: "image_url" as const, image_url: { url: input.imageUrl } }
        ]}
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "authentication_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              result: { type: "string", enum: ["authentic", "counterfeit", "uncertain"] },
              confidence: { type: "integer" },
              analysis: { type: "string" },
              redFlags: { type: "array", items: { type: "string" } },
              authenticMarkers: { type: "array", items: { type: "string" } },
              recommendation: { type: "string" }
            },
            required: ["result", "confidence", "analysis", "redFlags", "authenticMarkers", "recommendation"],
            additionalProperties: false
          }
        }
      }
    });
    const aiResult = parseLLMContent<{
      result: "authentic" | "counterfeit" | "uncertain";
      confidence: number;
      analysis: string;
      redFlags: string[];
      authenticMarkers: string[];
      recommendation: string;
    }>(response.choices[0].message.content);
    const authResult = await db.createAuthentication({
      productId: input.productId, userId: ctx.user.id, aiAnalysis: aiResult,
      confidenceScore: aiResult.confidence, result: aiResult.result, imageUrl: input.imageUrl,
    });

    // Reward protocol agent
    await rewardAgentForVerification(ctx.user.id, aiResult.result === "authentic");

    // Trigger MACROHARD Webhook: product_authenticated
    await triggerMacrohardEvent("product_authenticated", {
      authId: authResult.id,
      productId: input.productId,
      result: aiResult.result,
      confidence: aiResult.confidence,
      userId: ctx.user.id
    });

    if (aiResult.result === "authentic" && aiResult.confidence >= 80) {
      const certNumber = `AC-${Date.now()}-${nanoid(8).toUpperCase()}`;
      const cert = await db.createCertificate({
        productId: input.productId, authenticationId: authResult.id, userId: ctx.user.id,
        certificateNumber: certNumber, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // Trigger MACROHARD Webhook: certificate_issued
      await triggerMacrohardEvent("certificate_issued", {
        certificateId: cert.id,
        certificateNumber: cert.certificateNumber,
        productId: input.productId,
        userId: ctx.user.id
      });
    }
    await db.recordUsage({ userId: ctx.user.id, subscriptionId: sub?.id, type: "authentication", quantity: 1 });
    await db.logActivity({ userId: ctx.user.id, action: "product_authenticated", entityType: "authentication", entityId: authResult.id });
    try {
      const emoji = aiResult.result === "authentic" ? "Verified" : aiResult.result === "counterfeit" ? "Alert" : "Review Needed";
      await db.createSystemNotification(
        ctx.user.id,
        `Authentication ${emoji}: ${product.name}`,
        `${product.brand || "Product"} ${product.name} scored ${aiResult.confidence}% confidence as ${aiResult.result}. ${aiResult.recommendation}`,
        aiResult.result === "counterfeit" ? "alert" : "authentication",
        "/authenticate"
      );
    } catch (notifErr) { console.warn("[Notification] Failed:", notifErr); }
    return aiResult;
  }),
  history: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserAuthentications(ctx.user.id);
  }),
});

