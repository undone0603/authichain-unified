import { router, protectedProcedure } from "../../_core/trpc";
import { enqueueTask } from "../../db";
import { z } from "zod";

export const devTeamRouter = router({
  writeCode: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      prompt: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const taskId = await enqueueTask(input.missionId, 'PLAN_SPRINT', {
        feature: input.prompt,
        context: `Requested by user ${ctx.user.id}`,
      });
      return { success: true, taskId, message: "Sprint planning queued" };
    }),

  runTests: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      branch: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const taskId = await enqueueTask(input.missionId, 'RUN_TESTS', {
        branch: input.branch ?? `agentz/${input.missionId}`,
      });
      return { success: true, taskId, message: "Tests queued" };
    }),

  managePR: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      title: z.string(),
      branch: z.string().optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const taskId = await enqueueTask(input.missionId, 'OPEN_PR', {
        branch: input.branch ?? `agentz/${input.missionId}`,
        title: input.title,
        body: input.body ?? '',
      });
      return { success: true, taskId, message: "PR creation queued" };
    }),
});
