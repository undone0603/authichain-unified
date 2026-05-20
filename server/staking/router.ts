import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const stakingRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserStakingPositions(ctx.user.id);
  }),
  stake: protectedProcedure
    .input(z.object({
      amount: z.string(),
      agentId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const position = await db.createStakingPosition({
        userId: ctx.user.id,
        agentId: input.agentId,
        amount: input.amount,
        status: "active",
        multiplier: "1.50",
        apy: "12.50"
      });

      await db.logActivity({
        userId: ctx.user.id,
        action: "qron_staked",
        entityType: "staking",
        entityId: position.id,
        details: { amount: input.amount }
      });

      return position;
    }),
  unstake: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateStakingPosition(input.id, { status: "unstaking" });
      return { success: true };
    }),
});
