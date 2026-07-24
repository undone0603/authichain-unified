import { sql } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

export const reputationRouter = router({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const dbInstance = await getDb();

    const result = await dbInstance.execute(
      sql`SELECT points, trust_level FROM user_reputation WHERE user_id = ${ctx.user.id}`
    );
    const rows = (result as { rows?: Record<string, unknown>[] }).rows ?? [];

    return rows[0] ?? { points: 0, trust_level: "novice" };
  }),
});
