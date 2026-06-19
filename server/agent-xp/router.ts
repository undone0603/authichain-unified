import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getLeaderboard, getAgentXp } from "../agent-xp-service";

export const agentXpRouter = router({
  leaderboard: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        season: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const records = await getLeaderboard(input.limit, input.season);
      return {
        leaderboard: records.map((r) => ({
          agentId: r.agentId,
          agentName: r.agentName,
          level: r.level,
          xp: r.xp,
          totalTasksCompleted: r.totalTasksCompleted,
          successRate: r.successRate,
          dealsClosedCount: r.dealsClosedCount,
          revenueGeneratedUsd: r.revenueGeneratedUsd,
        })),
        season: input.season ?? 1,
      };
    }),

  myStats: protectedProcedure
    .input(
      z.object({
        agentId: z.string().optional(),
        season: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const agentId = input.agentId ?? "autonomous-agent";
      const record = await getAgentXp(agentId, undefined, input.season);
      return {
        agent: record
          ? {
              agentId: record.agentId,
              agentName: record.agentName,
              level: record.level,
              xp: record.xp,
              totalTasksCompleted: record.totalTasksCompleted,
              successRate: record.successRate,
              dealsClosedCount: record.dealsClosedCount,
              revenueGeneratedUsd: record.revenueGeneratedUsd,
            }
          : null,
        season: input.season ?? 1,
      };
    }),
});
