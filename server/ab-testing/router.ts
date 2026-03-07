import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const abTestingRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllAbTests();
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.string(),
    variants: z.any(),
  })).mutation(async ({ input }) => {
    return await db.createAbTest({ ...input, status: "draft" });
  }),
});
