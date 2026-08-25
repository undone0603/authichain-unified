import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getAllAbTests, createAbTest } from "../content-db-helpers";
import { z } from "zod";

export const abTestingRouter = router({
  list: adminProcedure.query(async () => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getAllAbTests(db);
  }),
  create: adminProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.string(),
    variants: z.any(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    return await createAbTest(db, { ...input, status: "draft" });
  }),
});
