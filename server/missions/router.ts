import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getMissions,
  getMissionById,
  createMission,
  updateMissionStatus,
  getTasksByMission,
  retryTask,
} from "./missions.db";
import { MISSION_TYPES, MISSION_STATUSES } from "./types";

export const missionsRouter = router({
  list: adminProcedure
    .input(z.object({ status: z.enum(MISSION_STATUSES).optional() }))
    .query(async ({ input }) => {
      return getMissions(input.status);
    }),

  create: protectedProcedure
    .input(z.object({ type: z.enum(MISSION_TYPES) }))
    .mutation(async ({ input }) => {
      const id = await createMission(input.type);
      return { id };
    }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getMissionById(input.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(MISSION_STATUSES) }))
    .mutation(async ({ input }) => {
      await updateMissionStatus(input.id, input.status);
      return { ok: true };
    }),
});

export const tasksRouter = router({
  list: adminProcedure
    .input(z.object({ missionId: z.string() }))
    .query(async ({ input }) => {
      return getTasksByMission(input.missionId);
    }),

  retry: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await retryTask(input.id);
      return { ok: true };
    }),
});
