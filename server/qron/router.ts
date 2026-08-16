import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { generateProductQRON, verifyVisualFingerprint, computeTrustScore } from "../qron-service";

export const qronRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getQronList();
  }),

  generate: protectedProcedure
    .input(z.object({
      productId: z.number(),
      productName: z.string(),
      brand: z.string().optional(),
      category: z.enum(["luxury_fashion", "pharma", "electronics", "automotive", "food_bev", "other"]).optional(),
      tier: z.enum(["standard", "premium", "enterprise", "pharma"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const product = await db.getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      const verifyUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "https://authichain.com"}/verify/${product.id}`;
      
      const qron = await generateProductQRON({
        ...input,
        serialNumber: product.serialNumber ?? undefined,
        nftTokenId: product.nftTokenId ?? undefined,
        verifyUrl,
      });

      const [record] = await db.createQron({
        id: qron.qronId,
        productId: input.productId,
        userId: ctx.user.id,
        productName: input.productName,
        brand: input.brand,
        category: input.category,
        mode: qron.mode,
        seed: qron.seed,
        imageUrl: qron.imageUrl,
        thumbnailUrl: qron.thumbnailUrl,
        fingerprintHash: qron.fingerprintHash,
        nftTokenId: qron.nftTokenId,
        openartUrl: qron.openartUrl,
        trustScore: 100,
      });

      return record;
    }),

  verify: publicProcedure
    .input(z.object({
      qronId: z.string(),
      scannedImageUrl: z.string(),
    }))
    .mutation(async ({ input }) => {
      const qron = await db.getQronById(input.qronId);
      if (!qron) throw new TRPCError({ code: "NOT_FOUND", message: "QRON not found" });

      const visualResult = await verifyVisualFingerprint({
        scannedImageUrl: input.scannedImageUrl,
        registeredImageUrl: qron.imageUrl ?? "",
        registeredFingerprintHash: qron.fingerprintHash ?? undefined,
      });

      const trust = computeTrustScore({
        qrDecodePass: true, // Assuming QR decoded to get here
        blockchainCertExists: !!qron.nftTokenId,
        visualFingerprint: visualResult,
        communityVerified: qron.verifiedScanCount ?? 0,
        communityFlagged: qron.fakeFlagCount ?? 0,
        openArtRegistered: !!qron.openartRegistered,
      });

      await db.createQronScanVerdict({
        qronId: qron.id,
        scannedImageUrl: input.scannedImageUrl,
        similarityScore: visualResult.similarity,
        verdict: visualResult.verdict,
        details: visualResult.details,
      });

      // Update aggregate counts
      if (visualResult.verdict === "authentic") {
        await db.updateQron(qron.id, { 
          verifiedScanCount: (qron.verifiedScanCount ?? 0) + 1,
          trustScore: trust.score,
        });
      } else if (visualResult.verdict === "fake") {
        await db.updateQron(qron.id, { 
          fakeFlagCount: (qron.fakeFlagCount ?? 0) + 1,
          trustScore: trust.score,
        });
      }

      return { trust, visualResult };
    }),
});
