// server/admin/types.ts
// Repository contract for the admin dashboard. Implemented by DbAdminRepository
// (real DB) and injectable for tests (see server/routers.test.ts admin coverage).
export interface IAdminRepository {
  getAdminDashboardMetrics(): Promise<any>;
  getAllUsers(): Promise<any[]>;
  getRevenueAnalytics(startDate?: Date, endDate?: Date): Promise<any[]>;
  getSubscriptionAnalytics(): Promise<any[]>;
  getOpenFraudAlerts(): Promise<any[]>;
  getAllHealthScores(): Promise<any[]>;
  getRecentActivity(limit: number): Promise<any[]>;
}
