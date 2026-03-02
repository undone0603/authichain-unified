import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const supplyChainRouter = router({
  getEvents: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
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
    const result = await db.createSupplyChainEvent(input);
    await db.logActivity({ userId: ctx.user.id, action: "supply_chain_event", entityType: "supply_chain", entityId: result.id });
    return result;
  }),
});
