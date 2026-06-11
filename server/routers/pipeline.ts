import { router, protectedProcedure } from "../_core/trpc";
import { runPipelineTick } from "../jobs/pipeline-tick";

export const pipelineRouter = router({
  status: protectedProcedure.query(async () => {
    const result = await runPipelineTick();
    return { ...result, ranAt: new Date().toISOString(), missionTasks: (result as any).missionTasks ?? ([] as any[]) };
  }),
  activity: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async ({ input }) => {
      const { getRecentAgentZActivity } = await import("../db");
      return await getRecentAgentZActivity(input.limit);
    }),

  commander: protectedProcedure
    .input(z.object({ text: z.string().min(5) }))
    .mutation(async ({ ctx, input }) => {
      const { processDirective } = await import("../agents/commander");
      return await processDirective({
        userId: ctx.user.id,
        text: input.text
      });
    }),
});
