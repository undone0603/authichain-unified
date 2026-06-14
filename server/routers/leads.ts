import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { ingestLeadAndRoute, IncomingLead } from "../revenue-orchestrator";

export const leadsRouter = router({
  capture: publicProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      company: z.string().optional(),
      title: z.string().optional(),
      phone: z.string().optional(),
      source: z.string().optional(),
      industry: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await ingestLeadAndRoute(input as IncomingLead);
      return result;
    }),

  list: protectedProcedure.query(async () => {
    return await db.getLeads();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getLeadById(input.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateLeadStatus(input.id, input.status);
      return { success: true };
    }),
});
