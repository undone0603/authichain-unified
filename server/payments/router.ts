import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getUserPayments, createPayment } from "../db-helpers";
import { z } from "zod";

export const paymentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // ctx.db does not exist on the live TrpcContext (server/_core/context.ts) —
    // only the separate Workers context has it. Documented bridge until this
    // router is wired up to a real per-request db.
    const db = await getDb();
    return await getUserPayments(db, ctx.user.id);
  }),
  createStripe: protectedProcedure.input(z.object({
    amount: z.string(),
    currency: z.string().optional().default("USD"),
    metadata: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Documented bridge — see list above.
    const db = await getDb();
    return await createPayment(db, { userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "stripe", status: "pending", metadata: input.metadata });
  }),
  createCrypto: protectedProcedure.input(z.object({
    amount: z.string(),
    currency: z.string().optional().default("BTC"),
    metadata: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Documented bridge — see list above.
    const db = await getDb();
    return await createPayment(db, { userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "crypto", status: "pending", metadata: input.metadata });
  }),
  createEscrow: protectedProcedure.input(z.object({
    amount: z.string(),
    releaseDate: z.string(),
    metadata: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Documented bridge — see list above.
    const db = await getDb();
    return await createPayment(db, {
      userId: ctx.user.id, amount: input.amount, method: "escrow", status: "escrowed",
      escrowReleaseDate: new Date(input.releaseDate), metadata: input.metadata,
    });
  }),
});
