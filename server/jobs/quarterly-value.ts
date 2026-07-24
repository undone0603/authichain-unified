import "dotenv/config";
import { pathToFileURL } from "node:url";
import { getDb } from "../db";
import {
  createSystemNotification,
  getAllUsers,
  getQuarterlyValueReport,
  hasActionLogged,
  logActivity,
  type Db,
} from "./db-helpers";

export async function runQuarterlyValueReportDispatch(db: Db) {
  const report = await getQuarterlyValueReport(db);
  const periodAction = `report_generated_quarterly_value_${report.period}`;
  if (await hasActionLogged(db, periodAction)) {
    return { admins: 0, delivered: 0, skipped: true, period: report.period };
  }
  const users = await getAllUsers(db);
  const admins = users.filter(u => u.role === "admin");

  let delivered = 0;
  for (const admin of admins) {
    await createSystemNotification(
      db,
      admin.id,
      "Quarterly Value Report",
      report.roiSummary,
      "system",
      "/admin",
    );
    await logActivity(db, {
      userId: admin.id,
      action: periodAction,
      entityType: "reporting",
      entityId: admin.id,
      details: report,
    });
    delivered++;
  }

  return { admins: admins.length, delivered, period: report.period, report };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // Documented bridge: standalone CLI entry point has no caller to thread a
  // db instance from, so it obtains one from the legacy Node singleton itself.
  getDb()
    .then(db => runQuarterlyValueReportDispatch(db))
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Quarterly value job failed:", err);
      process.exit(1);
    });
}
