export interface IAdminRepository {
  getAdminDashboardMetrics(): Promise<any>;
  getAllUsers(): Promise<any[]>;
  getRevenueAnalytics(startDate?: Date, endDate?: Date): Promise<any[]>;
  getSubscriptionAnalytics(): Promise<any[]>;
  getOpenFraudAlerts(): Promise<any[]>;
  getAllHealthScores(): Promise<any[]>;
  getRecentActivity(limit: number): Promise<any[]>;
}
