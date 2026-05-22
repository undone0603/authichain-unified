import { router, protectedProcedure, adminProcedure } from "../../_core/trpc";
import * as db from "../../db";
import { z } from "zod";

export const devTeamRouter = router({
  writeCode: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      prompt: z.string(),
      filesToModify: z.array(z.string()).optional().default([]),
      filesToCreate: z.array(z.string()).optional().default([]),
      branch: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const taskId = await db.createTask({
        missionId: input.missionId,
        kind: "WRITE_CODE",
        title: input.prompt.slice(0, 80),
        description: input.prompt,
        payload: {
          feature: input.prompt,
          branch: input.branch ?? `agentz/write-${Date.now()}`,
          filesToModify: input.filesToModify,
          filesToCreate: input.filesToCreate,
          context: input.context,
        },
      });
      await db.logActivity({
        userId: ctx.user.id,
        action: "write_code_enqueued",
        entityType: "mission_task",
        details: { missionId: input.missionId, prompt: input.prompt, taskId },
      });
      return { taskId };
    }),

  runTests: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      branch: z.string(),
      prNumber: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const taskId = await db.createTask({
        missionId: input.missionId,
        kind: "RUN_TESTS",
        title: `Run tests on ${input.branch}`,
        description: `CI test run for branch ${input.branch}`,
        payload: { branch: input.branch, prNumber: input.prNumber },
      });
      await db.logActivity({
        userId: ctx.user.id,
        action: "run_tests_enqueued",
        entityType: "mission_task",
        details: { missionId: input.missionId, branch: input.branch, taskId },
      });
      return { taskId };
    }),

  managePR: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      branch: z.string(),
      title: z.string(),
      body: z.string().optional().default(""),
      action: z.enum(["open", "merge"]).optional().default("open"),
      prNumber: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const kind = input.action === "merge" ? "MERGE_PR" : "OPEN_PR";
      const taskId = await db.createTask({
        missionId: input.missionId,
        kind,
        title: input.title,
        description: input.body,
        payload: {
          branch: input.branch,
          title: input.title,
          body: input.body,
          prNumber: input.prNumber,
        },
      });
      await db.logActivity({
        userId: ctx.user.id,
        action: `${kind.toLowerCase()}_enqueued`,
        entityType: "mission_task",
        details: { missionId: input.missionId, branch: input.branch, title: input.title, taskId },
      });
      return { taskId };
    }),

  tasks: adminProcedure
    .input(z.object({ missionId: z.string() }))
    .query(async ({ input }) => {
      return db.getTasksByMission(input.missionId);
    }),
});
