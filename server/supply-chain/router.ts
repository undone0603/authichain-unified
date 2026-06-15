import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

async function getOwnedProduct(productId: number, userId: number) {
  const product = await db.getProductById(productId);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
  if (product.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return product;
}

export const supplyChainRouter = router({
  getEvents: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ ctx, input }) => {
    await getOwnedProduct(input.productId, ctx.user.id);
    return await db.getProductSupplyChain(input.productId);
  }),
  addEvent: protectedProcedure.input(z.object({
    productId: z.number(),
    eventType: z.enum(["manufactured", "shipped", "in_transit", "customs", "delivered", "verified", "recalled"]),
    location: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    temperature: z.string().optional(),
    humidity: z.string().optional(),
    handler: z.string().optional(),
    notes: z.string().optional(),
    iotDeviceId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await getOwnedProduct(input.productId, ctx.user.id);
    const result = await db.createSupplyChainEvent(input);
    await db.logActivity({ userId: ctx.user.id, action: "supply_chain_event", entityType: "supply_chain", entityId: result.id });
    return result;
  }),
});
