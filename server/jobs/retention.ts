import "dotenv/config";
import { pathToFileURL } from "node:url";
import {
  createSystemNotification,
  hasUserActionLogged,
  listHighScanUsers,
  listInactiveUsersNoRecentScans,
  listUsersForOnboardingStep,
  logActivity,
  getUserById,
} from "../db";
import { sendEmail } from "../email-service";

const ONBOARDING_EMAILS: Record<number, { subject: string; body: (name: string) => string }> = {
  0: {
    subject: "Welcome to AuthiChain — your activation checklist",
    body: (n) => `Hi ${n},\n\nWelcome to AuthiChain. Complete your activation checklist at https://authichain.com/dashboard to go live faster.\n\nThe AuthiChain Team`,
  },
  2: {
    subject: "Day 2: Connect CRM & Stripe to unlock autonomous revenue",
    body: (n) => `Hi ${n},\n\nConnect your CRM and Stripe at https://authichain.com/dashboard to unlock autonomous revenue workflows.\n\nThe AuthiChain Team`,
  },
  5: {
    subject: "Day 5: Optimize lead routing for higher conversions",
    body: (n) => `Hi ${n},\n\nOptimize lead routing by segment at https://authichain.com/growth to improve conversion quality.\n\nThe AuthiChain Team`,
  },
  10: {
    subject: "Day 10: Review churn triggers to increase LTV",
    body: (n) => `Hi ${n},\n\nReview your churn and retention triggers at https://authichain.com/dashboard to increase lifetime value.\n\nThe AuthiChain Team`,
  },
};

type OnboardingStep = 0 | 2 | 5 | 10;

async function sendOnboarding(step: OnboardingStep, message: string) {
  const users = await listUsersForOnboardingStep(step);
  let sent = 0;
  for (const u of users) {
    const action = `retention_onboarding_day_${step}`;
    if (await hasUserActionLogged(u.id, action)) continue;
    await createSystemNotification(u.id, "Onboarding Tip", message, "system", "/dashboard");
    try {
      const user = await getUserById(u.id);
      const tpl = ONBOARDING_EMAILS[step];
      if (user?.email && tpl) {
        await sendEmail({ to: user.email, subject: tpl.subject, body: tpl.body(user.name || "there"), fromName: "AuthiChain" });
      }
    } catch { /* email failure must not abort activity log */ }
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
    await createSystemNotification(u.id, "Activation Nudge", "No scans detected in 7 days. Publish a QR portal to reactivate usage.", "alert", "/qrcodes");
    try {
      const user = await getUserById(u.id);
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: "Your AuthiChain QR portal hasn't been scanned in 7 days",
          body: `Hi ${user.name || "there"},\n\nNo scans detected in 7 days. Publish a new QR portal to re-engage your audience: https://authichain.com/qr-codes\n\nThe AuthiChain Team`,
          fromName: "AuthiChain",
        });
      }
    } catch { /* email failure must not abort activity log */ }
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
    await createSystemNotification(u.id, "Usage Milestone", "High scan volume detected. Consider upgrading for higher limits and advanced analytics.", "subscription", "/subscriptions");
    try {
      const user = await getUserById(u.id);
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: "You've hit 100 scans — time to upgrade?",
          body: `Hi ${user.name || "there"},\n\nYou've hit high scan volume on AuthiChain. Upgrade to unlock higher limits and advanced analytics: https://authichain.com/subscriptions\n\nThe AuthiChain Team`,
          fromName: "AuthiChain",
        });
      }
    } catch { /* email failure must not abort activity log */ }
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
