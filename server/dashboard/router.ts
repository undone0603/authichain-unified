import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const dashboardRouter = router({
  metrics: protectedProcedure.query(async ({ ctx }) => {
    return await db.getDashboardMetrics(ctx.user.id);
  }),
});
