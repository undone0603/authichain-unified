import { protectedProcedure, publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import * as marketplaceDb from "./db";

export const marketplaceRouter = router({
  listModels: publicProcedure.input(z.object({
    category: z.string().optional(),
    limit: z.number().optional().default(50),
  })).query(async ({ input }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await marketplaceDb.listModels(db, { ...input, status: "active" });
  }),
  getModel: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb(); // see listModels() above
    return await marketplaceDb.getModelById(db, input.id);
  }),
  createModel: adminProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    price: z.number().min(0),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see listModels() above
    return await marketplaceDb.createModel(db, { ...input, creatorId: ctx.user.id });
  }),
  purchaseModel: protectedProcedure.input(z.object({
    modelId: z.number(),
    purchaseType: z.enum(["purchase", "subscription", "rental"]).optional().default("purchase"),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see listModels() above
    const model = await marketplaceDb.getModelById(db, input.modelId);
    if (!model) throw new Error("Model not found");
    return await marketplaceDb.purchaseModel(db, {
      userId: ctx.user.id,
      modelId: input.modelId,
      pricePaid: model.price,
      purchaseType: input.purchaseType,
    });
  }),
  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); // see listModels() above
    return await marketplaceDb.getUserPurchases(db, ctx.user.id);
  }),
  addReview: protectedProcedure.input(z.object({
    modelId: z.number(),
    rating: z.number().min(1).max(5),
    review: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see listModels() above
    return await marketplaceDb.addReview(db, { ...input, userId: ctx.user.id });
  }),
  getReviews: publicProcedure.input(z.object({ modelId: z.number() })).query(async ({ input }) => {
    const db = await getDb(); // see listModels() above
    return await marketplaceDb.getModelReviews(db, input.modelId);
  }),
});
