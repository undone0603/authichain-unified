import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getDb } from "../db";
import {
  getAdminDashboardMetrics,
  getBudgetStatus,
  getQuarterlyValueReport,
  getRevenueAnalytics,
  getWeeklyRevenueDigest,
  logActivity,
  type Db,
} from "./db-helpers";

// These three don't touch the database at all (stubs pending real
// implementations) — ported inline rather than through db-helpers.ts, which
// only carries functions that actually need a `db` instance.
async function getAcceptanceCriteriaStatus() {
  return { total: 0, passed: 0, failed: 0, pending: 0 };
}

async function getFunnelBySegmentAndChannel() {
  return [] as Array<{ segment: string; channel: string; leads: number; converted: number }>;
}

async function getLeadCohorts() {
  return [] as Array<{ cohort: string; count: number; conversionRate: number }>;
}

function startOfNDaysAgo(days: number) {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function runAnalyticsSnapshot(db: Db) {
  const now = new Date();
  const [metrics, weeklyDigest, budgetStatus, acceptanceStatus, funnel, cohorts, quarterly, revenue30d] =
    await Promise.all([
      getAdminDashboardMetrics(db),
      getWeeklyRevenueDigest(db),
      getBudgetStatus(db),
      getAcceptanceCriteriaStatus(),
      getFunnelBySegmentAndChannel(),
      getLeadCohorts(),
      getQuarterlyValueReport(db),
      getRevenueAnalytics(db, startOfNDaysAgo(30), now),
    ]);

  const payload = {
    timestamp: now.toISOString(),
    metrics,
    weeklyDigest,
    budgetStatus,
    acceptanceStatus,
    funnelTop10: funnel.slice(0, 10),
    cohortsTop10: cohorts.slice(0, 10),
    quarterly,
    revenueLast30Days: revenue30d,
  };

  const outputDir = resolve(process.cwd(), "orchestration");
  await mkdir(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "analytics-latest.json");
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");

  await logActivity(db, {
    userId: null,
    action: "report_generated_analytics_snapshot",
    entityType: "reporting",
    entityId: 0,
    details: {
      outputPath,
      generatedAt: payload.timestamp,
      totals: {
        totalRevenue: metrics.totalRevenue,
        totalLeads: metrics.totalLeads,
      },
    },
  });

  return { ...payload, outputPath };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // Documented bridge: standalone CLI entry point has no caller to thread a
  // db instance from, so it obtains one from the legacy Node singleton itself.
  getDb()
    .then(db => runAnalyticsSnapshot(db))
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Analytics snapshot failed:", err);
      process.exit(1);
    });
}
