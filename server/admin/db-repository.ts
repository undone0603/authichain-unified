import * as db from "../db";
import { IAdminRepository } from "./types";

export class DbAdminRepository implements IAdminRepository {
  async getAdminDashboardMetrics(): Promise<any> {
    return await db.getAdminDashboardMetrics();
  }

  async getAllUsers(): Promise<any[]> {
    return await db.getAllUsers();
  }

  async getRevenueAnalytics(startDate?: Date, endDate?: Date): Promise<any[]> {
    return await db.getRevenueAnalytics(startDate, endDate);
  }

  async getSubscriptionAnalytics(): Promise<any[]> {
    return await db.getSubscriptionAnalytics();
  }

  async getOpenFraudAlerts(): Promise<any[]> {
    return await db.getOpenFraudAlerts();
  }

  async getAllHealthScores(): Promise<any[]> {
    return await db.getAllHealthScores();
  }

  async getRecentActivity(limit: number): Promise<any[]> {
    return await db.getRecentActivity(limit);
  }
}
