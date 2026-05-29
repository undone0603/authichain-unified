import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  getAcceptanceCriteriaStatus,
  getAdminDashboardMetrics,
  getBudgetStatus,
  getFunnelBySegmentAndChannel,
  getLeadCohorts,
  getQuarterlyValueReport,
  getRevenueAnalytics,
  getWeeklyRevenueDigest,
  logActivity,
} from "../db";

function startOfNDaysAgo(days: number) {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function runAnalyticsSnapshot() {
  const now = new Date();
  const [metrics, weeklyDigest, budgetStatus, acceptanceStatus, funnel, cohorts, quarterly, revenue30d] =
    await Promise.all([
      getAdminDashboardMetrics(),
      getWeeklyRevenueDigest(),
      getBudgetStatus(),
      getAcceptanceCriteriaStatus(),
      getFunnelBySegmentAndChannel(),
      getLeadCohorts(),
      getQuarterlyValueReport(),
      getRevenueAnalytics(startOfNDaysAgo(30), now),
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

  await logActivity({
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
  runAnalyticsSnapshot()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Analytics snapshot failed:", err);
      process.exit(1);
    });
}
