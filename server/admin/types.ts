// server/admin/types.ts
// Repository contract for the admin dashboard. Implemented by DbAdminRepository
// (real DB) and injectable for tests (see server/routers.test.ts admin coverage).
import type * as db from "../db";

type AdminDashboardMetrics = Awaited<ReturnType<typeof db.getAdminDashboardMetrics>>;
type AdminUsers = Awaited<ReturnType<typeof db.getAllUsers>>;
type RevenueAnalytics = Awaited<ReturnType<typeof db.getRevenueAnalytics>>;
type SubscriptionAnalytics = Awaited<ReturnType<typeof db.getSubscriptionAnalytics>>;
type FraudAlerts = Awaited<ReturnType<typeof db.getOpenFraudAlerts>>;
type HealthScores = Awaited<ReturnType<typeof db.getAllHealthScores>>;
type RecentActivity = Awaited<ReturnType<typeof db.getRecentActivity>>;
type PastDueSubscriptions = Awaited<ReturnType<typeof db.listPastDueSubscriptions>>;
type InactiveUsers = Awaited<ReturnType<typeof db.listInactiveUsersNoRecentScans>>;

export interface IAdminRepository {
  getAdminDashboardMetrics(): Promise<AdminDashboardMetrics>;
  getAllUsers(): Promise<AdminUsers>;
  getRevenueAnalytics(startDate?: Date, endDate?: Date): Promise<RevenueAnalytics>;
  getSubscriptionAnalytics(): Promise<SubscriptionAnalytics>;
  getOpenFraudAlerts(): Promise<FraudAlerts>;
  getAllHealthScores(): Promise<HealthScores>;
  getRecentActivity(limit: number): Promise<RecentActivity>;
  getPastDueSubscriptions(): Promise<PastDueSubscriptions>;
  getInactiveUsers(daysSinceLastScan?: number): Promise<InactiveUsers>;
}
