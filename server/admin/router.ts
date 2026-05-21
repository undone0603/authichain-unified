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
  revenueStats: adminProcedure.query(async () => {
    const [allRevenue, allSubs] = await Promise.all([
      db.getRevenueAnalytics(),
      db.getSubscriptionAnalytics(),
    ]);

    // Revenue aggregations
    const totalRevenue = allRevenue.reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentRevenue = allRevenue.filter((r: any) => new Date(r.createdAt) >= last30Days);
    const revenue30d = recentRevenue.reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);

    // Revenue by source
    const bySource: Record<string, number> = {};
    for (const r of allRevenue) {
      const src = r.source || "unknown";
      bySource[src] = (bySource[src] || 0) + parseFloat(r.amount || "0");
    }

    // Revenue by type
    const byType: Record<string, number> = {};
    for (const r of allRevenue) {
      const t = r.type || "unknown";
      byType[t] = (byType[t] || 0) + parseFloat(r.amount || "0");
    }

    // Subscription counts by plan and status
    const subsByPlan: Record<string, number> = {};
    const subsByStatus: Record<string, number> = {};
    const planPrices: Record<string, number> = { starter: 49, professional: 199, enterprise: 799 };
    let mrr = 0;

    for (const s of allSubs) {
      const plan = s.plan || "starter";
      const status = s.status || "unknown";
      subsByPlan[plan] = (subsByPlan[plan] || 0) + 1;
      subsByStatus[status] = (subsByStatus[status] || 0) + 1;
      if (status === "active") {
        const monthly = s.billingCycle === "annual"
          ? (planPrices[plan] || 0) * 0.8
          : (planPrices[plan] || 0);
        mrr += monthly;
      }
    }

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      revenue30d: parseFloat(revenue30d.toFixed(2)),
      mrr: parseFloat(mrr.toFixed(2)),
      arr: parseFloat((mrr * 12).toFixed(2)),
      bySource,
      byType,
      subsByPlan,
      subsByStatus,
      totalSubs: allSubs.length,
      activeSubs: subsByStatus["active"] || 0,
      pastDueSubs: subsByStatus["past_due"] || 0,
    };
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
  platformStaking: adminProcedure.query(async () => {
    // stakingPositions schema table is scaffolded but not yet migrated;
    // return safe zeros until the staking feature is fully deployed.
    return { totalStaked: 0, activeStakers: 0, totalRewardsDistributed: 0, avgApy: 0 };
  }),
  createSovereignDeal: adminProcedure.input(z.object({
    manufacturerName: z.string().min(1),
    dealType: z.enum(['pilot', 'enterprise', 'government', 'partnership']),
    value: z.number().min(0),
    description: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await db.logActivity({
      userId: ctx.user.id,
      action: 'sovereign_deal_created',
      entityType: 'deal',
      entityId: 0,
      details: input,
    });
    return { success: true, dealId: `SDeal-${Date.now()}`, ...input };
  }),
});
