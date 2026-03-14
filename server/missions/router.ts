import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getMissions,
  getMissionById,
  createMission,
  updateMissionStatus,
  getTasksByMission,
  retryTask,
} from "../db";
import type { MissionType, MissionStatus } from "./types";

export const missionsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ input }) => {
      return getMissions(input.status);
    }),

  create: protectedProcedure
    .input(z.object({ type: z.custom<MissionType>() }))
    .mutation(async ({ input }) => {
      const id = await createMission(input.type);
      return { id };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getMissionById(input.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.custom<MissionStatus>() }))
    .mutation(async ({ input }) => {
      await updateMissionStatus(input.id, input.status);
      return { ok: true };
    }),
});

export const tasksRouter = router({
  list: protectedProcedure
    .input(z.object({ missionId: z.string() }))
    .query(async ({ input }) => {
      return getTasksByMission(input.missionId);
    }),

  retry: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await retryTask(input.id);
      return { ok: true };
    }),
});
