import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const paymentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserPayments(ctx.user.id);
  }),
  createStripe: protectedProcedure.input(z.object({
    amount: z.string(),
    currency: z.string().optional().default("USD"),
    metadata: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    return await db.createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "stripe", status: "pending", metadata: input.metadata });
  }),
  createCrypto: protectedProcedure.input(z.object({
    amount: z.string(),
    currency: z.string().optional().default("BTC"),
    metadata: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    return await db.createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "crypto", status: "pending", metadata: input.metadata });
  }),
  createEscrow: protectedProcedure.input(z.object({
    amount: z.string(),
    releaseDate: z.string(),
    metadata: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    return await db.createPayment({
      userId: ctx.user.id, amount: input.amount, method: "escrow", status: "escrowed",
      escrowReleaseDate: new Date(input.releaseDate), metadata: input.metadata,
    });
  }),
});
