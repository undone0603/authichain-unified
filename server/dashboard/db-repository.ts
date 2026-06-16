import * as db from "../db";
import { IDashboardRepository } from "./types";

export class DbDashboardRepository implements IDashboardRepository {
  async getDashboardMetrics(userId: number): Promise<any> {
    return await db.getDashboardMetrics(userId);
  }
  async getRecentActivity(limit: number): Promise<any[]> {
    return await db.getRecentActivity(limit);
  }
}
