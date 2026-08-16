// server/admin/db-repository.ts
// Real database-backed implementation of IAdminRepository.
// Thin wrapper over the shared db module so it can be swapped for a mock in
// tests (see server/routers.test.ts admin repository-injection coverage).
import * as db from "../db";
import type { IAdminRepository } from "./types";

export class DbAdminRepository implements IAdminRepository {
  getAdminDashboardMetrics(): Promise<any> {
    return db.getAdminDashboardMetrics();
  }

  getAllUsers(): Promise<any[]> {
    return db.getAllUsers();
  }

  getRevenueAnalytics(startDate?: Date, endDate?: Date): Promise<any[]> {
    return db.getRevenueAnalytics(startDate, endDate);
  }

  getSubscriptionAnalytics(): Promise<any[]> {
    return db.getSubscriptionAnalytics();
  }

  getOpenFraudAlerts(): Promise<any[]> {
    return db.getOpenFraudAlerts();
  }

  getAllHealthScores(): Promise<any[]> {
    return db.getAllHealthScores();
  }

  getRecentActivity(limit: number): Promise<any[]> {
    return db.getRecentActivity(limit);
  }
}
