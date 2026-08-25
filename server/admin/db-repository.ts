// server/admin/db-repository.ts
// Real database-backed implementation of IAdminRepository.
// Thin wrapper over server/db-helpers.ts (db-parameterized) so it can be
// swapped for a mock in tests (see server/routers.test.ts admin
// repository-injection coverage).
import * as dbHelpers from "../db-helpers";
import { getDb, type getHyperdriveDb } from "../db";
import type { IAdminRepository } from "./types";

type Db = ReturnType<typeof getHyperdriveDb>;

export class DbAdminRepository implements IAdminRepository {
  // Optional: callers that already have a threaded `db` (e.g. a future
  // ctx.db-aware caller, or server/_core/context.workers.ts — Task 2b-4)
  // can inject it directly. server/_core/context.ts (out of scope for this
  // migration — Task 1/2 territory) still instantiates this with zero args,
  // so the constructor — and therefore resolveDb() below — must keep
  // working without one. Until context.ts is wired up to pass a real
  // per-request db, this falls back to the legacy getDb() singleton as a
  // documented bridge.
  constructor(private readonly injectedDb?: Db) {}

  private async resolveDb(): Promise<Db> {
    if (this.injectedDb) return this.injectedDb;
    return getDb();
  }

  async getAdminDashboardMetrics(): Promise<any> {
    const db = await this.resolveDb();
    return dbHelpers.getAdminDashboardMetrics(db);
  }

  async getAllUsers(): Promise<any[]> {
    const db = await this.resolveDb();
    return dbHelpers.getAllUsers(db);
  }

  async getRevenueAnalytics(startDate?: Date, endDate?: Date): Promise<any[]> {
    const db = await this.resolveDb();
    return dbHelpers.getRevenueAnalytics(db, startDate, endDate);
  }

  async getSubscriptionAnalytics(): Promise<any[]> {
    const db = await this.resolveDb();
    return dbHelpers.getSubscriptionAnalytics(db);
  }

  async getOpenFraudAlerts(): Promise<any[]> {
    const db = await this.resolveDb();
    return dbHelpers.getOpenFraudAlerts(db);
  }

  async getAllHealthScores(): Promise<any[]> {
    const db = await this.resolveDb();
    return dbHelpers.getAllHealthScores(db);
  }

  async getRecentActivity(limit: number): Promise<any[]> {
    const db = await this.resolveDb();
    return dbHelpers.getRecentActivity(db, limit);
  }
}
