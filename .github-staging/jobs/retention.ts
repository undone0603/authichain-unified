import "dotenv/config";
import { pathToFileURL } from "node:url";
import {
  createSystemNotification,
  hasUserActionLogged,
  listHighScanUsers,
  listInactiveUsersNoRecentScans,
  listUsersForOnboardingStep,
  logActivity,
} from "../db";

type OnboardingStep = 0 | 2 | 5 | 10;

async function sendOnboarding(step: OnboardingStep, message: string) {
  const users = await listUsersForOnboardingStep(step);
  let sent = 0;
  for (const u of users) {
    const action = `retention_onboarding_day_${step}`;
    if (await hasUserActionLogged(u.id, action)) continue;
    await createSystemNotification(u.id, "Onboarding Tip", message, "system", "/dashboard");
    await logActivity({
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

async function sendNoScanNudges() {
  const users = await listInactiveUsersNoRecentScans(7);
  let sent = 0;
  for (const u of users) {
    const action = "retention_no_scans_7d_nudge";
    if (await hasUserActionLogged(u.id, action)) continue;
    await createSystemNotification(
      u.id,
      "Activation Nudge",
      "No scans detected in 7 days. Publish a QR portal to reactivate usage.",
      "alert",
      "/qrcodes",
    );
    await logActivity({
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

async function sendUpsellPrompts() {
  const users = await listHighScanUsers(100);
  let sent = 0;
  for (const u of users) {
    const action = "retention_high_scan_upsell_prompt";
    if (await hasUserActionLogged(u.id, action)) continue;
    await createSystemNotification(
      u.id,
      "Usage Milestone",
      "High scan volume detected. Consider upgrading for higher limits and advanced analytics.",
      "subscription",
      "/subscriptions",
    );
    await logActivity({
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

export async function runRetentionAutomation() {
  const d0 = await sendOnboarding(0, "Welcome. Complete your activation checklist to go live faster.");
  const d2 = await sendOnboarding(2, "Day 2 tip: connect CRM and Stripe to unlock autonomous revenue workflows.");
  const d5 = await sendOnboarding(5, "Day 5 tip: optimize lead routing by segment and improve conversion quality.");
  const d10 = await sendOnboarding(10, "Day 10 tip: review churn and retention triggers to increase LTV.");
  const noScans = await sendNoScanNudges();
  const upsell = await sendUpsellPrompts();

  return {
    onboarding: { day0: d0, day2: d2, day5: d5, day10: d10 },
    triggers: { noScans7d: noScans, highScanUpsell: upsell },
  };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runRetentionAutomation()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Retention job failed:", err);
      process.exit(1);
    });
}
