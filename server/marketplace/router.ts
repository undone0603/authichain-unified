import { protectedProcedure, publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as marketplaceDb from "./db";

export const marketplaceRouter = router({
  listModels: publicProcedure.input(z.object({
    category: z.string().optional(),
    limit: z.number().optional().default(50),
  })).query(async ({ input }) => {
    return await marketplaceDb.listModels({ ...input, status: "active" });
  }),
  getModel: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return await marketplaceDb.getModelById(input.id);
  }),
  createModel: adminProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    price: z.number().min(0),
  })).mutation(async ({ ctx, input }) => {
    return await marketplaceDb.createModel({ ...input, creatorId: ctx.user.id });
  }),
  purchaseModel: protectedProcedure.input(z.object({
    modelId: z.number(),
    purchaseType: z.enum(["purchase", "subscription", "rental"]).optional().default("purchase"),
  })).mutation(async ({ ctx, input }) => {
    const model = await marketplaceDb.getModelById(input.modelId);
    if (!model) throw new Error("Model not found");
    return await marketplaceDb.purchaseModel({
      userId: ctx.user.id,
      modelId: input.modelId,
      pricePaid: model.price,
      purchaseType: input.purchaseType,
    });
  }),
  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    return await marketplaceDb.getUserPurchases(ctx.user.id);
  }),
  addReview: protectedProcedure.input(z.object({
    modelId: z.number(),
    rating: z.number().min(1).max(5),
    review: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    return await marketplaceDb.addReview({ ...input, userId: ctx.user.id });
  }),
  getReviews: publicProcedure.input(z.object({ modelId: z.number() })).query(async ({ input }) => {
    return await marketplaceDb.getModelReviews(input.modelId);
  }),
});
