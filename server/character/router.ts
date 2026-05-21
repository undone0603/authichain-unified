import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as service from "../character-service";

export const characterRouter = router({
  generate: protectedProcedure.input(z.object({
    archetype: z.enum(["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"]),
    context: z.object({
      brand: z.string().optional(),
      object: z.string().optional(),
      colorway: z.string().optional(),
      mood: z.string().optional(),
    }).optional(),
  })).mutation(async ({ ctx, input }) => {
    return await service.startCharacterGeneration(ctx.user.id, input.archetype, input.context);
  }),
  generationStatus: protectedProcedure.input(z.object({
    generationId: z.number(),
  })).query(async ({ input }) => {
    return await service.getGenerationStatus(input.generationId);
  }),
  myGenerations: protectedProcedure.query(async ({ ctx }) => {
    return await service.getUserGenerations(ctx.user.id);
  }),
  myAssets: protectedProcedure.query(async ({ ctx }) => {
    return await service.getUserCharacterAssets(ctx.user.id);
  }),
  select: protectedProcedure.input(z.object({
    characterAssetId: z.number(),
    assetId: z.number().optional(), // Support legacy frontend field
  })).mutation(async ({ ctx, input }) => {
    return await service.selectCharacterAsset(ctx.user.id, input.characterAssetId || input.assetId || 0);
  }),
  createAgent: protectedProcedure.input(z.object({
    characterAssetId: z.number(),
    agentName: z.string().min(1),
    agentType: z.enum(["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"]),
    name: z.string().optional(), // Support legacy frontend field
  })).mutation(async ({ ctx, input }) => {
    return await service.createProtocolAgent(
      ctx.user.id, 
      input.characterAssetId, 
      input.agentName || input.name || "",
      input.agentType
    );
  }),
  myAgent: protectedProcedure.query(async ({ ctx }) => {
    return await service.getAgentByUser(ctx.user.id);
  }),
  getAgent: protectedProcedure.query(async ({ ctx }) => {
    return await service.getAgentByUser(ctx.user.id);
  }),
  agentRewards: protectedProcedure.input(z.object({
    agentId: z.number(),
    limit: z.number().optional().default(50),
  })).query(async ({ input }) => {
    return await service.getAgentRewards(input.agentId, input.limit);
  }),
  networkStats: publicProcedure.query(async () => {
    return await service.getNetworkStats();
  }),
  leaderboard: publicProcedure.input(z.object({
    limit: z.number().optional().default(20),
  })).query(async ({ input }) => {
    return await service.getAgentLeaderboard(input.limit);
  }),
  submitClaim: protectedProcedure.input(z.object({
    agentId: z.number(),
    productId: z.number(),
    authenticationId: z.number().nullable(),
    claimType: z.enum(["authentic", "counterfeit", "inconclusive", "needs_review"]),
    confidence: z.number(),
    evidence: z.record(z.string(), z.any()).optional(),
    reasoning: z.string().optional(),
  })).mutation(async ({ input }) => {
    return await service.submitVerificationClaim(
      input.agentId,
      input.productId,
      input.authenticationId,
      input.claimType,
      input.confidence,
      input.evidence,
      input.reasoning
    );
  }),
});
