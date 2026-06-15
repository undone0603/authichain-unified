import { router, protectedProcedure } from "../../_core/trpc";
import { createTask } from "../../db";
import { z } from "zod";

export const devTeamRouter = router({
  writeCode: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      prompt: z.string(),
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/add-agentz-editable
    }),

  runTests: protectedProcedure
    .input(z.object({
      missionId: z.string(),
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/add-agentz-editable
    }),

  managePR: protectedProcedure
    .input(z.object({
      missionId: z.string(),
      branch: z.string(),
      title: z.string(),
<<<<<<< HEAD
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
=======
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

  tasks: protectedProcedure
    .input(z.object({ missionId: z.string() }))
    .query(async ({ input }) => {
      return db.getTasksByMission(input.missionId);
>>>>>>> origin/add-agentz-editable
    }),
});
