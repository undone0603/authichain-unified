import "dotenv/config";
import { pathToFileURL } from "node:url";
import {
  createSystemNotification,
  getAllUsers,
  getQuarterlyValueReport,
  hasActionLogged,
  logActivity,
} from "../db";

export async function runQuarterlyValueReportDispatch() {
  const report = await getQuarterlyValueReport();
  const periodAction = `report_generated_quarterly_value_${report.period}`;
  if (await hasActionLogged(periodAction)) {
    return { admins: 0, delivered: 0, skipped: true, period: report.period };
  }
  const users = await getAllUsers();
  const admins = users.filter(u => u.role === "admin");

  let delivered = 0;
  for (const admin of admins) {
    await createSystemNotification(
      admin.id,
      "Quarterly Value Report",
      report.roiSummary,
      "system",
      "/admin",
    );
    await logActivity({
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
  runQuarterlyValueReportDispatch()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Quarterly value job failed:", err);
      process.exit(1);
    });
}
