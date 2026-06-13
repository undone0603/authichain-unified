import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  preparePayouts,
  dryRunReport,
  approvePayouts,
  executeApprovedPayouts,
  listPayouts,
} from "./service";
import { logActivity } from "../db";

/**
 * Admin-only payout controls. The flow is deliberately multi-step so funds
 * never move without a human in the loop:
 *   dryRun  → see exactly what would pay, no writes
 *   prepare → queue source rows as pending_approval (no money moves)
 *   approve → a human approves specific payout ids
 *   execute → sends ONLY approved rows, and ONLY if PAYOUTS_ENABLED=true
 */
export const payoutsRouter = router({
  // Read-only preview. Safe to call anytime.
  dryRun: adminProcedure.query(async () => {
    return await dryRunReport();
  }),

  // List queued/approved/recent payouts for the admin panel.
  list: adminProcedure
    .input(z.object({ statuses: z.array(z.string()).optional(), limit: z.number().int().positive().max(500).optional() }).optional())
    .query(async ({ input }) => {
      return await listPayouts(input ?? {});
    }),

  // Enqueue eligible payouts for review. Moves no funds.
  prepare: adminProcedure.mutation(async ({ ctx }) => {
    const res = await preparePayouts();
    await logActivity({
      userId: ctx.user.id,
      action: "payouts_prepared",
      entityType: "payout",
      details: res,
    });
    return res;
  }),

  // Approve a specific batch of queued payouts.
  approve: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const approved = await approvePayouts(input.ids, ctx.user.id);
      await logActivity({
        userId: ctx.user.id,
        action: "payouts_approved",
        entityType: "payout",
        details: { requested: input.ids.length, approved },
      });
      return { approved };
    }),

  // Execute approved payouts. Hard-gated on PAYOUTS_ENABLED and per-run caps.
  execute: adminProcedure.mutation(async ({ ctx }) => {
    const summary = await executeApprovedPayouts();
    await logActivity({
      userId: ctx.user.id,
      action: "payouts_executed",
      entityType: "payout",
      details: summary,
    });
    return summary;
  }),
});
