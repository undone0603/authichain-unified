import { sql } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
export const reputationRouter = router({
    getMe: protectedProcedure.query(async ({ ctx }) => {
        const dbInstance = await db.getDb();
        if (!dbInstance)
            return null;
        const result = await dbInstance.execute(sql `SELECT points, trust_level FROM user_reputation WHERE user_id = ${ctx.user.id}`);
        const rows = result.rows ?? [];
        return rows[0] ?? { points: 0, trust_level: "novice" };
    }),
});
