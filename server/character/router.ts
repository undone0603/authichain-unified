import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import * as service from "../character-service";

// TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
// context does. server/character/router.ts is not in Task 2b-6's directory
// scope, but server/character-service.ts (which it calls) is, and that
// service now takes an explicit `db` instead of resolving getDb() itself.
// Bridge via getDb() here until this router has a ctx.db to use.
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
    const db = await getDb();
    return await service.startCharacterGeneration(db, ctx.user.id, input.archetype, input.context);
  }),
  generationStatus: protectedProcedure.input(z.object({
    generationId: z.number(),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    const gen = await service.getGenerationStatus(db, input.generationId);
    if (gen && gen.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    return gen;
  }),
  myGenerations: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return await service.getUserGenerations(db, ctx.user.id);
  }),
  myAssets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return await service.getUserCharacterAssets(db, ctx.user.id);
  }),
  select: protectedProcedure.input(z.object({
    characterAssetId: z.number(),
    assetId: z.number().optional(), // Support legacy frontend field
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    return await service.selectCharacterAsset(db, ctx.user.id, input.characterAssetId || input.assetId || 0);
  }),
  createAgent: protectedProcedure.input(z.object({
    characterAssetId: z.number(),
    agentName: z.string().min(1),
    agentType: z.enum(["guardian", "archivist", "sentinel", "scout", "arbiter", "merchant", "explorer"]),
    name: z.string().optional(), // Support legacy frontend field
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    return await service.createProtocolAgent(
      db,
      ctx.user.id,
      input.characterAssetId,
      input.agentName || input.name || "",
      input.agentType
    );
  }),
  myAgent: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return await service.getAgentByUser(db, ctx.user.id);
  }),
  getAgent: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return await service.getAgentByUser(db, ctx.user.id);
  }),
  agentRewards: protectedProcedure.input(z.object({
    agentId: z.number(),
    limit: z.number().optional().default(50),
  })).query(async ({ input }) => {
    const db = await getDb();
    return await service.getAgentRewards(db, input.agentId, input.limit);
  }),
  networkStats: publicProcedure.query(async () => {
    const db = await getDb();
    return await service.getNetworkStats(db);
  }),
  leaderboard: publicProcedure.input(z.object({
    limit: z.number().optional().default(20),
  })).query(async ({ input }) => {
    const db = await getDb();
    return await service.getAgentLeaderboard(db, input.limit);
  }),
  submitClaim: protectedProcedure.input(z.object({
    agentId: z.number(),
    productId: z.number(),
    authenticationId: z.number().nullable(),
    claimType: z.enum(["authentic", "counterfeit", "inconclusive", "needs_review"]),
    confidence: z.number(),
    evidence: z.record(z.string(), z.any()).optional(),
    reasoning: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const myAgent = await service.getAgentByUser(db, ctx.user.id);
    if (!myAgent || myAgent.id !== input.agentId) throw new TRPCError({ code: "FORBIDDEN", message: "Agent not owned by user" });
    return await service.submitVerificationClaim(
      db,
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
