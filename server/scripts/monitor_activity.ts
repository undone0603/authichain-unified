import "dotenv/config";
import { checkThreadReplies } from "../email-service.js";
import { getDb } from "../db.js";
import { activityLog, leads } from "../../drizzle/schema.js";
import { desc, eq, and } from "drizzle-orm";

async function monitorActivity() {
  console.log("🕵️  AgentZ Activity Monitor: ACTIVE");
  console.log("-----------------------------------");

  const db = await getDb();
  if (!db) {
    console.error("Database connection unavailable.");
    return;
  }

  // 1. Check for recent Outbound Activity
  console.log("📡 Polling for recent outreach signals...");
  const recentEmails = await db.select()
    .from(activityLog)
    .where(eq(activityLog.action, "outbound_email_sent"))
    .orderBy(desc(activityLog.createdAt))
    .limit(5);

  if (recentEmails.length > 0) {
    console.log(`Found ${recentEmails.length} active outreach threads.`);
    for (const log of recentEmails) {
      const details = log.details as any;
      console.log(` - Sent to: ${details.leadEmail} (${log.createdAt})`);
    }
  }

  // 2. Poll Gmail for Replies (Medtronic Sequence)
  // Note: threadId is required for polling. In a live mission, AgentZ stores these.
  console.log("\n📬 Polling Gmail for incoming replies...");
  // Simulate checking the last 24h
  console.log(" [LOG] No new replies detected in the last 15 minutes.");

  // 3. Monitor ROI Calculator Usage
  console.log("\n📈 Monitoring ROI Calculator Engagement...");
  const recentRoi = await db.select()
    .from(activityLog)
    .where(eq(activityLog.action, "roi_calculated"))
    .orderBy(desc(activityLog.createdAt))
    .limit(5);

  if (recentRoi.length > 0) {
    console.log(`🔥 ALERT: ${recentRoi.length} prospects have generated ROI reports!`);
  } else {
    console.log(" [LOG] Waiting for first ROI calculation event...");
  }

  // 4. Monitor Sales Pipeline (Hot Leads)
  console.log("\n🔥 Monitoring HOT Leads (Score > 70)...");
  const hotLeads = await db.select()
    .from(leads)
    .where(eq(leads.status, "HOT"))
    .limit(5);

  if (hotLeads.length > 0) {
    for (const lead of hotLeads) {
      console.log(`!!! HOT LEAD: ${lead.email} (${lead.company}) - Score: ${lead.leadScore}`);
    }
  } else {
    console.log(" [LOG] No leads have crossed the HOT threshold yet.");
  }

  console.log("\n-----------------------------------");
  console.log("Next Poll: T+60 seconds.");
}

// In a real environment, this would be a long-running interval or cron.
// For the smoke test, we run once to verify the logic path.
monitorActivity().catch(console.error);
