import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateProductAssets, retryFailedAssets } from "../asset-service";

async function getOwnedProduct(productId: number, userId: number) {
  const product = await db.getProductById(productId);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
  if (product.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return product;
}

export const productsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserProducts(ctx.user.id);
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    return await getOwnedProduct(input.id, ctx.user.id);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    brand: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    serialNumber: z.string().optional(),
    batchNumber: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const result = await db.createProduct({ ...input, userId: ctx.user.id });
    await db.logActivity({ userId: ctx.user.id, action: "product_created", entityType: "product", entityId: result.id });
    return result;
  }),

  generateAssets: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getOwnedProduct(input.productId, ctx.user.id);
      await generateProductAssets(input.productId);
      return { success: true };
    }),

  retryFailedTasks: adminProcedure
    .mutation(async () => {
      await retryFailedAssets();
      return { success: true };
    }),
});
