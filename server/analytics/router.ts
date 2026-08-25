import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authentications } from "../../drizzle/schema";
import { aggregateAuthentications } from "./aggregate";

// TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
// context does. This router runs its own drizzle query directly (not
// through server/db.ts's named helpers), so there's nothing to
// re-implement in content-db-helpers.ts here -- just a documented getDb()
// bridge until this router has a ctx.db to use.
export const analyticsRouter = router({
  myStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const rows = await db
      .select({ result: authentications.result, createdAt: authentications.createdAt })
      .from(authentications)
      .where(eq(authentications.userId, ctx.user.id))
      .orderBy(desc(authentications.createdAt))
      .limit(10000);
    return aggregateAuthentications(rows);
  }),
});
