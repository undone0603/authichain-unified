import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { getUserStakingPositions, createStakingPosition, logActivity, updateStakingPosition } from "../identity-db-helpers";

export const stakingRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getUserStakingPositions(db, ctx.user.id);
  }),
  stake: protectedProcedure
    .input(z.object({
      amount: z.string(),
      agentId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); // see list() above
      const position = await createStakingPosition(db, {
        userId: ctx.user.id,
        agentId: input.agentId,
        amount: input.amount,
        status: "active",
        multiplier: "1.50",
        apy: "12.50"
      });

      await logActivity(db, {
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
      const db = await getDb(); // see list() above
      await updateStakingPosition(db, input.id, ctx.user.id, { status: "unstaking" });
      return { success: true };
    }),
});
