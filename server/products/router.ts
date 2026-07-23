import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getProductById, getUserProducts, createProduct, logActivity } from "../identity-db-helpers";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateProductAssets, retryFailedAssets } from "../asset-service";
import type { Product } from "../../src/db/schema";

async function getOwnedProduct(db: Awaited<ReturnType<typeof getDb>>, productId: number, userId: number): Promise<Product> {
  const product = await getProductById(db, productId);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
  if (product.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return product;
}

export const productsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getUserProducts(db, ctx.user.id);
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb(); // see list() above
    return await getOwnedProduct(db, input.id, ctx.user.id);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    brand: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    serialNumber: z.string().optional(),
    batchNumber: z.string().optional(),
    manufacturer: z.string().optional(),
    modelNumber: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see list() above
    const result = await createProduct(db, { ...input, userId: ctx.user.id });
    await logActivity(db, { userId: ctx.user.id, action: "product_created", entityType: "product", entityId: result.id });
    return result;
  }),

  generateAssets: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb(); // see list() above
      await generateProductAssets(db, input.productId);
      return { success: true };
    }),

  retryFailedTasks: adminProcedure
    .mutation(async () => {
      const db = await getDb(); // see list() above
      await retryFailedAssets(db);
      return { success: true };
    }),
});
