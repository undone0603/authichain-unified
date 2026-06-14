import { router, protectedProcedure } from "../../_core/trpc";
import { createTask } from "../../db";
import { z } from "zod";

export const devTeamRouter = router({
  writeCode: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      prompt: z.string(),
      filesToModify: z.array(z.string()).optional(),
      filesToCreate: z.array(z.string()).optional(),
      branch: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const taskId = await createTask({
        missionId: input.missionId,
        kind: "WRITE_CODE",
        title: "Write Code",
        payload: {
          branch: input.branch ?? `agentz/feature-${Date.now()}`,
          feature: input.prompt,
          filesToModify: input.filesToModify ?? [],
          filesToCreate: input.filesToCreate ?? [],
        },
        status: "pending",
      });
      return { success: true, taskId };
    }),

  runTests: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      branch: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const taskId = await createTask({
        missionId: input.missionId,
        kind: "RUN_TESTS",
        title: "Run Tests",
        payload: { branch: input.branch ?? "main" },
        status: "pending",
      });
      return { success: true, taskId };
    }),

  managePR: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      title: z.string(),
      branch: z.string().optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const taskId = await createTask({
        missionId: input.missionId,
        kind: "OPEN_PR",
        title: "Open PR",
        payload: {
          branch: input.branch ?? "main",
          title: input.title,
          body: input.body ?? "",
        },
        status: "pending",
      });
      return { success: true, taskId };
    }),
});
