import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const adminRouter = router({
  metrics: adminProcedure.query(async () => {
    return await db.getAdminDashboardMetrics();
  }),
  users: adminProcedure.query(async () => {
    return await db.getAllUsers();
  }),
  revenue: adminProcedure.input(z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    return await db.getRevenueAnalytics(
      input?.startDate ? new Date(input.startDate) : undefined,
      input?.endDate ? new Date(input.endDate) : undefined,
    );
  }),
  fraudAlerts: adminProcedure.query(async () => {
    return await db.getOpenFraudAlerts();
  }),
  healthScores: adminProcedure.query(async () => {
    return await db.getAllHealthScores();
  }),
  activity: adminProcedure.input(z.object({ limit: z.number().optional().default(50) })).query(async ({ input }) => {
    return await db.getRecentActivity(input.limit);
  }),
  subscriptions: adminProcedure.query(async () => {
    return await db.getSubscriptionAnalytics();
  }),
});
