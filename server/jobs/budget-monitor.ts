import "dotenv/config";
import { pathToFileURL } from "node:url";
import { getDb } from "../db";
import { createSystemNotification, getAllUsers, getBudgetStatus, getRecentActivity, logActivity, type Db } from "./db-helpers";

type Threshold = 70 | 90;

function alertAction(metric: string, threshold: Threshold, periodKey: string) {
  return `budget_alert_${metric}_${threshold}_${periodKey}`;
}

async function alreadyAlerted(db: Db, action: string) {
  const recent = await getRecentActivity(db, 2000);
  return recent.some(a => a.action === action);
}

async function notifyAdmins(db: Db, title: string, message: string, details: any) {
  const admins = (await getAllUsers(db)).filter(u => u.role === "admin");
  for (const admin of admins) {
    await createSystemNotification(db, admin.id, title, message, "alert", "/admin");
    await logActivity(db, {
      userId: admin.id,
      action: "budget_alert_dispatched",
      entityType: "budget",
      entityId: admin.id,
      details,
    });
  }
  return admins.length;
}

export async function runBudgetMonitor(db: Db) {
  const status = await getBudgetStatus(db);
  let alerts = 0;
  let recipients = 0;

  const checks: Array<{ metric: "llm" | "ads" | "enrichment"; pct: number; period: string }> = [
    { metric: "llm", pct: status.llm.pct, period: status.period.month },
    { metric: "ads", pct: status.ads.pct, period: status.period.day },
    { metric: "enrichment", pct: status.enrichment.pct, period: status.period.month },
  ];

  for (const c of checks) {
    for (const t of [90, 70] as const) {
      if (c.pct < t) continue;
      const action = alertAction(c.metric, t, c.period);
      if (await alreadyAlerted(db, action)) continue;

      const count = await notifyAdmins(
        db,
        `Budget Alert: ${c.metric.toUpperCase()} ${t}%`,
        `${c.metric} spend reached ${c.pct}% for period ${c.period}.`,
        { metric: c.metric, threshold: t, pct: c.pct, period: c.period },
      );
      await logActivity(db, {
        userId: null,
        action,
        entityType: "budget",
        entityId: 0,
        details: { metric: c.metric, threshold: t, pct: c.pct, period: c.period },
      });
      alerts++;
      recipients += count;
      break; // if 90 triggered, skip 70
    }
  }

  return { status, alerts, recipients };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // Documented bridge: standalone CLI entry point (`node budget-monitor.ts`)
  // has no caller to thread a db instance from, so it obtains one from the
  // legacy Node singleton itself.
  getDb()
    .then(db => runBudgetMonitor(db))
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Budget monitor failed:", err);
      process.exit(1);
    });
}
