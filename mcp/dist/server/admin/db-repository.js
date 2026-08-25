// server/admin/db-repository.ts
// Real database-backed implementation of IAdminRepository.
// Thin wrapper over the shared db module so it can be swapped for a mock in
// tests (see server/routers.test.ts admin repository-injection coverage).
import * as db from "../db";
export class DbAdminRepository {
    getAdminDashboardMetrics() {
        return db.getAdminDashboardMetrics();
    }
    getAllUsers() {
        return db.getAllUsers();
    }
    getRevenueAnalytics(startDate, endDate) {
        return db.getRevenueAnalytics(startDate, endDate);
    }
    getSubscriptionAnalytics() {
        return db.getSubscriptionAnalytics();
    }
    getOpenFraudAlerts() {
        return db.getOpenFraudAlerts();
    }
    getAllHealthScores() {
        return db.getAllHealthScores();
    }
    getRecentActivity(limit) {
        return db.getRecentActivity(limit);
    }
}
