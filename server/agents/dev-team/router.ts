import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import * as db from "../../db";

export const devTeamRouter = router({
  sprintTasks: protectedProcedure
    .input(z.object({ missionId: z.string().optional() }))
    .query(async ({ input }) => {
      const d = await db.getDb();
      const { missionTasks } = await import("../../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      let query = d.select().from(missionTasks);
      if (input.missionId) {
        query = query.where(eq(missionTasks.missionId, input.missionId)) as any;
      }

      return await query.orderBy(missionTasks.order);
    }),

  retryTask: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      const d = await db.getDb();
      const { missionTasks } = await import("../../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await d.update(missionTasks)
        .set({ status: "pending", error: null })
        .where(eq(missionTasks.id, input.taskId));

      return { success: true };
    }),

  stats: protectedProcedure.query(async () => {
    const d = await db.getDb();
    const { missionTasks } = await import("../../../drizzle/schema");
    const { sql } = await import("drizzle-orm");

    const [all] = await d.select({ count: sql<number>`count(*)` }).from(missionTasks);
    const [pending] = await d.select({ count: sql<number>`count(*)` }).from(missionTasks).where(sql`status = 'pending'`);
    const [completed] = await d.select({ count: sql<number>`count(*)` }).from(missionTasks).where(sql`status = 'completed'`);
    const [failed] = await d.select({ count: sql<number>`count(*)` }).from(missionTasks).where(sql`status = 'failed'`);

    return {
      total: Number(all?.count || 0),
      pending: Number(pending?.count || 0),
      completed: Number(completed?.count || 0),
      failed: Number(failed?.count || 0),
    };
  }),

  // Sprint list (consumed by the BuildLoop dashboard).
  sprints: protectedProcedure.query(async (): Promise<any[]> => {
    const d = await db.getDb();
    const { missions } = await import("../../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return await d.select().from(missions).where(eq(missions.type, "TECH_SPRINT"));
  }),

  // Queue a PLAN_SPRINT task for AgentZ; picked up on the next scheduler tick.
  createSprint: protectedProcedure
    .input(z.any())
    .mutation(async ({ input }): Promise<{ success: boolean }> => {
      const missionId = await db.createMission("TECH_SPRINT");
      await db.enqueueTask(missionId, "PLAN_SPRINT", input ?? {});
      return { success: true };
    }),

  // Approve a pending merge; AgentZ performs the merge on its next tick.
  approveMerge: protectedProcedure
    .input(z.any())
    .mutation(async ({ input }): Promise<{ success: boolean }> => {
      const taskId = (input && (input.taskId as string)) || undefined;
      if (taskId) {
        const d = await db.getDb();
        const { missionTasks } = await import("../../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await d.update(missionTasks).set({ status: "approved" }).where(eq(missionTasks.id, taskId));
      }
      return { success: true };
    }),
});
