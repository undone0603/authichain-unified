import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authentications } from "../../drizzle/schema";
import { aggregateAuthentications } from "./aggregate";

export const analyticsRouter = router({
  myStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return aggregateAuthentications([]);
    const rows = await db
      .select({ result: authentications.result, createdAt: authentications.createdAt })
      .from(authentications)
      .where(eq(authentications.userId, ctx.user.id))
      .orderBy(desc(authentications.createdAt))
      .limit(10000);
    return aggregateAuthentications(rows);
  }),
});
