import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getProductById, getProductSupplyChain, createSupplyChainEvent, logActivity } from "../identity-db-helpers";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

async function getOwnedProduct(db: Awaited<ReturnType<typeof getDb>>, productId: number, userId: number) {
  const product = await getProductById(db, productId);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
  if (product.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return product;
}

export const supplyChainRouter = router({
  getEvents: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ ctx, input }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    await getOwnedProduct(db, input.productId, ctx.user.id);
    return await getProductSupplyChain(db, input.productId);
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
    const db = await getDb(); // see getEvents() above
    await getOwnedProduct(db, input.productId, ctx.user.id);
    const result = await createSupplyChainEvent(db, input);
    await logActivity(db, { userId: ctx.user.id, action: "supply_chain_event", entityType: "supply_chain", entityId: result.id });
    return result;
  }),
});
