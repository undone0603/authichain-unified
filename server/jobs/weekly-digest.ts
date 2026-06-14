import "dotenv/config";
import { pathToFileURL } from "node:url";
import {
  createSystemNotification,
  getAllUsers,
  getWeeklyRevenueDigest,
  hasActionLogged,
  logActivity,
} from "../db";
import { sendEmail } from "../email-service";

export async function runWeeklyDigestDispatch() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(dayOfYear / 7) + 1;
  const periodKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  const periodAction = `report_generated_weekly_kpi_digest_${periodKey}`;
  if (await hasActionLogged(periodAction)) {
    return { admins: 0, delivered: 0, skipped: true, periodKey };
  }

  const digest = await getWeeklyRevenueDigest();
  const users = await getAllUsers();
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
    await createSystemNotification(admin.id, "Weekly KPI Digest", message, "system", "/admin");
    try {
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          subject: `AuthiChain Weekly KPI — ${periodKey}`,
          body: `Weekly KPI Digest\n\n${message.replace(/ \| /g, "\n")}\n\nFull dashboard: https://authichain.com/admin`,
          fromName: "AuthiChain Analytics",
        });
      }
    } catch { /* email failure must not block activity log */ }
    await logActivity({
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
  runWeeklyDigestDispatch()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Weekly digest job failed:", err);
      process.exit(1);
    });
}
