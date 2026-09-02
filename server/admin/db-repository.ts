// server/admin/db-repository.ts
// Real database-backed implementation of IAdminRepository.
// Thin wrapper over the shared db module so it can be swapped for a mock in
// tests (see server/routers.test.ts admin repository-injection coverage).
import * as db from "../db";
import type { IAdminRepository } from "./types";

export class DbAdminRepository implements IAdminRepository {
  getAdminDashboardMetrics(): ReturnType<IAdminRepository["getAdminDashboardMetrics"]> {
    return db.getAdminDashboardMetrics();
  }

  getAllUsers(): ReturnType<IAdminRepository["getAllUsers"]> {
    return db.getAllUsers();
  }

  getRevenueAnalytics(startDate?: Date, endDate?: Date): ReturnType<IAdminRepository["getRevenueAnalytics"]> {
    return db.getRevenueAnalytics(startDate, endDate);
  }

  getSubscriptionAnalytics(): ReturnType<IAdminRepository["getSubscriptionAnalytics"]> {
    return db.getSubscriptionAnalytics();
  }

  getOpenFraudAlerts(): ReturnType<IAdminRepository["getOpenFraudAlerts"]> {
    return db.getOpenFraudAlerts();
  }

  getAllHealthScores(): ReturnType<IAdminRepository["getAllHealthScores"]> {
    return db.getAllHealthScores();
  }

  getRecentActivity(limit: number): ReturnType<IAdminRepository["getRecentActivity"]> {
    return db.getRecentActivity(limit);
  }

  getPastDueSubscriptions(): ReturnType<IAdminRepository["getPastDueSubscriptions"]> {
    return db.listPastDueSubscriptions();
  }

  getInactiveUsers(daysSinceLastScan?: number): ReturnType<IAdminRepository["getInactiveUsers"]> {
    return db.listInactiveUsersNoRecentScans(daysSinceLastScan || 7);
  }
}
