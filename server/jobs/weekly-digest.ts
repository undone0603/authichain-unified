import "dotenv/config";
import { pathToFileURL } from "node:url";
import { getDb } from "../db";
import {
  createSystemNotification,
  getAllUsers,
  getWeeklyRevenueDigest,
  hasActionLogged,
  logActivity,
  type Db,
} from "./db-helpers";

export async function runWeeklyDigestDispatch(db: Db) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(dayOfYear / 7) + 1;
  const periodKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  const periodAction = `report_generated_weekly_kpi_digest_${periodKey}`;
  if (await hasActionLogged(db, periodAction)) {
    return { admins: 0, delivered: 0, skipped: true, periodKey };
  }

  const digest = await getWeeklyRevenueDigest(db);
  const users = await getAllUsers(db);
  const admins = users.filter(u => u.role === "admin");
  const message = [
    `Leads: ${digest.leads}`,
    `MQL->SQL: ${digest.mqlToSql}`,
    `Demos booked: ${digest.demosBooked}`,
    `Trial->Paid: ${digest.trialToPaid}`,
    `Churn: ${digest.churn}`,
    `MRR: ${digest.mrr}`,
    `ARPA: ${digest.arpa}`,
  ].join(" | ");

  let delivered = 0;
  for (const admin of admins) {
    await createSystemNotification(db, admin.id, "Weekly KPI Digest", message, "system", "/admin");
    await logActivity(db, {
      userId: admin.id,
      action: periodAction,
      entityType: "reporting",
      entityId: admin.id,
      details: { periodKey, digest },
    });
    delivered++;
  }

  return { admins: admins.length, delivered, periodKey, digest };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // Documented bridge: standalone CLI entry point has no caller to thread a
  // db instance from, so it obtains one from the legacy Node singleton itself.
  getDb()
    .then(db => runWeeklyDigestDispatch(db))
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Weekly digest job failed:", err);
      process.exit(1);
    });
}
