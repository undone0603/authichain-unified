import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getUserStakingPositions,
  getActiveStakingPositions,
  createStakingPosition,
  calculateRewards,
  withdrawStaking,
  getUserStakingStats,
  createTransaction,
  createPlatformFee,
} from "./db";

export const stakingRouter = router({
  /**
   * Get user's staking positions
   */
  myPositions: protectedProcedure.query(async ({ ctx }) => {
    return await getUserStakingPositions(ctx.user.id);
  }),

  /**
   * Get active staking positions
   */
  activePositions: protectedProcedure.query(async ({ ctx }) => {
    return await getActiveStakingPositions(ctx.user.id);
  }),

  /**
   * Get staking statistics
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    return await getUserStakingStats(ctx.user.id);
  }),

  /**
   * Create new staking position
   */
  stake: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(1000, "Minimum stake is $10"), // Amount in cents
        apy: z.number().min(100).max(5000), // APY in basis points (100-5000 = 1%-50%)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, apy } = input;

      // Create staking position
      const positionId = await createStakingPosition({
        userId: ctx.user.id,
        amount,
        apy,
      });

      // Create transaction record
      await createTransaction({
        userId: ctx.user.id,
        type: "staking_deposit",
        amount,
        status: "completed",
        stakingId: positionId,
        metadata: JSON.stringify({ apy }),
      });

      return {
        success: true,
        positionId,
        message: "Staking position created successfully",
      };
    }),

  /**
   * Withdraw from staking position
   */
  withdraw: protectedProcedure
    .input(
      z.object({
        positionId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { positionId } = input;

      // Withdraw staking
      const result = await withdrawStaking(positionId, ctx.user.id);

      // Create withdrawal transaction
      await createTransaction({
        userId: ctx.user.id,
        type: "staking_withdrawal",
        amount: result.total,
        status: "completed",
        stakingId: positionId,
        metadata: JSON.stringify({
          principal: result.principal,
          rewards: result.rewards,
        }),
      });

      // Collect platform fee on rewards (5%)
      if (result.rewards > 0) {
        const feePercentage = 500; // 5%
        const feeAmount = Math.floor((result.rewards * feePercentage) / 10000);

        await createPlatformFee({
          feeType: "staking_reward",
          percentage: feePercentage,
          amount: feeAmount,
          description: `Fee collected on staking rewards for position #${positionId}`,
        });
      }

      return {
        success: true,
        ...result,
        message: "Withdrawal successful",
      };
    }),

  /**
   * Calculate current rewards for a position
   */
  calculateRewards: protectedProcedure
    .input(
      z.object({
        positionId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const rewards = await calculateRewards(input.positionId);
      return { rewards };
    }),
});
