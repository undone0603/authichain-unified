import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { DbMissionsRepository } from "./db-repository";
import { MISSION_TYPES, MISSION_STATUSES } from "./types";

export const missionsRouter = router({
  list: adminProcedure
    .input(z.object({ status: z.enum(MISSION_STATUSES).optional() }))
    .query(async ({ input, ctx }) => {
      const repo = ctx.missionsRepo ?? new DbMissionsRepository();
      return repo.getMissions(input.status);
    }),

  create: protectedProcedure
    .input(z.object({ type: z.enum(MISSION_TYPES) }))
    .mutation(async ({ input, ctx }) => {
      const repo = ctx.missionsRepo ?? new DbMissionsRepository();
      const id = await repo.createMission(input.type);
      return { id };
    }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const repo = ctx.missionsRepo ?? new DbMissionsRepository();
      return repo.getMissionById(input.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(MISSION_STATUSES) }))
    .mutation(async ({ input, ctx }) => {
      const repo = ctx.missionsRepo ?? new DbMissionsRepository();
      await repo.updateMissionStatus(input.id, input.status);
      return { ok: true };
    }),
});

export const tasksRouter = router({
  list: adminProcedure
    .input(z.object({ missionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const repo = ctx.missionsRepo ?? new DbMissionsRepository();
      return repo.getTasksByMission(input.missionId);
    }),

  retry: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const repo = ctx.missionsRepo ?? new DbMissionsRepository();
      await repo.retryTask(input.id);
      return { ok: true };
    }),
});
