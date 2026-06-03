import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { qronRewardLedger, protocolAgents, products } from "../../src/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

export const qronRouter = router({
  verifyPhoto: protectedProcedure
    .input(z.object({
      productId: z.number(),
      imageUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      // 1. Vision Verification via GPT-4o
      const visionResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are the AuthiChain Community Proof Validator. Your job is to verify if a user-submitted photo contains the specified product and shows it in a real-world environment (home, store, street). Be strict but fair. If the image is just a screenshot, stock photo, or unrelated, reject it."
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Verify if this photo shows a real-world instance of: ${product.brand} ${product.name}.` },
              { type: "image_url", image_url: { url: input.imageUrl } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "vision_verification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                isVerified: { type: "boolean" },
                reasoning: { type: "string" },
                confidence: { type: "integer" }
              },
              required: ["isVerified", "reasoning", "confidence"],
              additionalProperties: false
            }
          }
        }
      });

      const verification = JSON.parse(visionResult.choices[0].message.content as string);

      if (!verification.isVerified || verification.confidence < 70) {
        return { success: false, message: verification.reasoning };
      }

      // 2. Award Reward if verified
      const [agent] = await db.select()
        .from(protocolAgents)
        .where(and(eq(protocolAgents.userId, ctx.user.id), eq(protocolAgents.status, "active")))
        .limit(1);

      if (!agent) return { success: true, verified: true, message: "Verified! Initialize an agent to claim the QRON bonus." };

      // Record reward
      await db.insert(qronRewardLedger).values({
        agentId: agent.id,
        userId: ctx.user.id,
        amount: "20.00",
        reason: "community_quest",
        referenceType: "photo_proof",
        referenceId: input.productId,
        status: "pending",
      });

      await db.update(protocolAgents)
        .set({
          qronPending: sql`${protocolAgents.qronPending} + 20.00`,
          xp: sql`${protocolAgents.xp} + 50`,
        })
        .where(eq(protocolAgents.id, agent.id));

      return { success: true, verified: true, message: "Photo verified! 20 QRON bonus awarded." };
    }),

  burnForDiscount: protectedProcedure
    .input(z.object({
      amount: z.number(), // Amount of QRON to burn
      brandId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Validate Balance
      const [agent] = await db.select()
        .from(protocolAgents)
        .where(and(eq(protocolAgents.userId, ctx.user.id), eq(protocolAgents.status, "active")))
        .limit(1);

      if (!agent || parseFloat(agent.qronPending || "0") < input.amount) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient QRON balance." });
      }

      // 2. Generate Stripe Discount Code (L2 Siphon)
      // For the pilot, we use a default 20% off coupon
      // In production, this would be linked to the brand's own Stripe coupons
      const STRIPE_COUPON_ID = process.env.STRIPE_PILOT_COUPON_ID || "20_OFF_PILOT";
      
      let promo;
      try {
        const { createRedemptionCode } = await import("../stripe-service");
        promo = await createRedemptionCode({ couponId: STRIPE_COUPON_ID });
      } catch (err) {
        console.error("[Burn] Stripe failed:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate discount code." });
      }

      // 3. Record the Burn (Negative amount in ledger)
      await db.insert(qronRewardLedger).values({
        agentId: agent.id,
        userId: ctx.user.id,
        amount: `-${input.amount.toFixed(2)}`,
        reason: "burn_redemption",
        referenceType: "stripe_promo",
        referenceId: 0, // Placeholder
        status: "completed",
      });

      // 4. Deduct from agent balance
      await db.update(protocolAgents)
        .set({
          qronPending: sql`${protocolAgents.qronPending} - ${input.amount.toFixed(2)}`,
          totalClaims: sql`${protocolAgents.totalClaims} + 1`,
        })
        .where(eq(protocolAgents.id, agent.id));

      return {
        success: true,
        discountCode: promo.code,
        amountBurned: input.amount,
        message: `Success! ${input.amount} QRON burned for a unique discount code.`
      };
    }),

  claimReward: protectedProcedure
    .input(z.object({
      productId: z.number(),
      rewardType: z.enum(["standard_scan", "chapter_completion", "community_quest"]),
      amount: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Get user's active agent
      const [agent] = await db.select()
        .from(protocolAgents)
        .where(and(eq(protocolAgents.userId, ctx.user.id), eq(protocolAgents.status, "active")))
        .limit(1);

      if (!agent) {
        throw new TRPCError({ 
          code: "PRECONDITION_FAILED", 
          message: "You must initialize a Character Agent before claiming rewards." 
        });
      }

      // 2. Check for duplicate claims (idempotency)
      const [existing] = await db.select()
        .from(qronRewardLedger)
        .where(and(
          eq(qronRewardLedger.userId, ctx.user.id),
          eq(qronRewardLedger.referenceType, "product_scan"),
          eq(qronRewardLedger.referenceId, input.productId),
          eq(qronRewardLedger.reason, input.rewardType)
        ))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Reward already claimed for this product scan." });
      }

      // 3. Record the reward in the ledger
      await db.insert(qronRewardLedger).values({
        agentId: agent.id,
        userId: ctx.user.id,
        amount: input.amount.toString(),
        reason: input.rewardType,
        referenceType: "product_scan",
        referenceId: input.productId,
        status: "pending",
      });

      // 4. Update agent's pending balance
      await db.update(protocolAgents)
        .set({
          qronPending: sql`${protocolAgents.qronPending} + ${input.amount.toString()}`,
          xp: sql`${protocolAgents.xp} + 10`,
          totalVerifications: sql`${protocolAgents.totalVerifications} + 1`,
        })
        .where(eq(protocolAgents.id, agent.id));

      return { 
        success: true, 
        claimedAmount: input.amount,
        agentName: agent.name,
        newPendingBalance: (parseFloat(agent.qronPending || "0") + input.amount).toFixed(2)
      };
    }),

  getRewardHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return await db.select()
      .from(qronRewardLedger)
      .where(eq(qronRewardLedger.userId, ctx.user.id))
      .orderBy(sql`${qronRewardLedger.createdAt} DESC`)
      .limit(20);
  }),
});
