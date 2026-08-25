import "dotenv/config";
import { pathToFileURL } from "node:url";
import { getDb } from "../db";
import {
  createSystemNotification,
  hasUserActionLogged,
  listHighScanUsers,
  listInactiveUsersNoRecentScans,
  listUsersForOnboardingStep,
  logActivity,
  type Db,
} from "./db-helpers";

type OnboardingStep = 0 | 2 | 5 | 10;

async function sendOnboarding(db: Db, step: OnboardingStep, message: string) {
  const users = await listUsersForOnboardingStep(db, step);
  let sent = 0;
  for (const u of users) {
    const action = `retention_onboarding_day_${step}`;
    if (await hasUserActionLogged(db, u.id, action)) continue;
    await createSystemNotification(db, u.id, "Onboarding Tip", message, "system", "/dashboard");
    await logActivity(db, {
      userId: u.id,
      action,
      entityType: "retention",
      entityId: u.id,
      details: { step },
    });
    sent++;
  }
  return { checked: users.length, sent };
}

async function sendNoScanNudges(db: Db) {
  const users = await listInactiveUsersNoRecentScans(db, 7);
  let sent = 0;
  for (const u of users) {
    const action = "retention_no_scans_7d_nudge";
    if (await hasUserActionLogged(db, u.id, action)) continue;
    await createSystemNotification(
      db,
      u.id,
      "Activation Nudge",
      "No scans detected in 7 days. Publish a QR portal to reactivate usage.",
      "alert",
      "/qrcodes",
    );
    await logActivity(db, {
      userId: u.id,
      action,
      entityType: "retention",
      entityId: u.id,
      details: { daysWithoutScans: 7 },
    });
    sent++;
  }
  return { checked: users.length, sent };
}

async function sendUpsellPrompts(db: Db) {
  const users = await listHighScanUsers(db, 100);
  let sent = 0;
  for (const u of users) {
    const action = "retention_high_scan_upsell_prompt";
    if (await hasUserActionLogged(db, u.id, action)) continue;
    await createSystemNotification(
      db,
      u.id,
      "Usage Milestone",
      "High scan volume detected. Consider upgrading for higher limits and advanced analytics.",
      "subscription",
      "/subscriptions",
    );
    await logActivity(db, {
      userId: u.id,
      action,
      entityType: "retention",
      entityId: u.id,
      details: { threshold: 100 },
    });
    sent++;
  }
  return { checked: users.length, sent };
}

export async function runRetentionAutomation(db: Db) {
  const d0 = await sendOnboarding(db, 0, "Welcome. Complete your activation checklist to go live faster.");
  const d2 = await sendOnboarding(db, 2, "Day 2 tip: connect CRM and Stripe to unlock autonomous revenue workflows.");
  const d5 = await sendOnboarding(db, 5, "Day 5 tip: optimize lead routing by segment and improve conversion quality.");
  const d10 = await sendOnboarding(db, 10, "Day 10 tip: review churn and retention triggers to increase LTV.");
  const noScans = await sendNoScanNudges(db);
  const upsell = await sendUpsellPrompts(db);

  return {
    onboarding: { day0: d0, day2: d2, day5: d5, day10: d10 },
    triggers: { noScans7d: noScans, highScanUpsell: upsell },
  };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // Documented bridge: standalone CLI entry point has no caller to thread a
  // db instance from, so it obtains one from the legacy Node singleton itself.
  getDb()
    .then(db => runRetentionAutomation(db))
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Retention job failed:", err);
      process.exit(1);
    });
}
