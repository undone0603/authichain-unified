import "dotenv/config";
import { pathToFileURL } from "node:url";
import {
  createSystemNotification,
  hasDunningStepLogged,
  listPastDueSubscriptions,
  logActivity,
  getUserById,
} from "../db";
import { sendEmail } from "../email-service";

function daysSince(date: Date | null | undefined) {
  if (!date) return 0;
  const then = new Date(date).getTime();
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

type Step = "day_3" | "day_7" | "day_14";

const EMAIL_SUBJECTS: Record<Step, string> = {
  day_3: "Action required: Your AuthiChain payment failed",
  day_7: "Reminder: Your AuthiChain account is past due",
  day_14: "Final notice: AuthiChain account at risk of suspension",
};

const EMAIL_BODY: Record<Step, (name: string, plan: string) => string> = {
  day_3: (name, plan) =>
    `Hi ${name},\n\nWe were unable to process your payment for AuthiChain ${plan}. Please update your payment method to keep your account active.\n\nUpdate billing: https://authichain.com/subscriptions\n\nThe AuthiChain Team`,
  day_7: (name, plan) =>
    `Hi ${name},\n\nYour AuthiChain ${plan} subscription payment is still outstanding. Your account will be suspended if payment is not received within 7 days.\n\nUpdate billing: https://authichain.com/subscriptions\n\nThe AuthiChain Team`,
  day_14: (name, plan) =>
    `Hi ${name},\n\nThis is a final notice. Your AuthiChain ${plan} subscription payment is 14 days overdue. Please update your billing details immediately to avoid account suspension.\n\nUpdate billing: https://authichain.com/subscriptions\n\nThe AuthiChain Team`,
};

async function runStep(subscription: any, step: Step, message: string) {
  const alreadyLogged = await hasDunningStepLogged(subscription.id, step);
  if (alreadyLogged) return false;

  await createSystemNotification(
    subscription.userId,
    "Billing Reminder",
    message,
    "alert",
    "/subscriptions",
  );

  if (subscription.userId) {
    try {
      const user = await getUserById(subscription.userId);
      if (user?.email) {
        const planLabel = (subscription.plan || "starter");
        const planDisplay = planLabel.charAt(0).toUpperCase() + planLabel.slice(1);
        await sendEmail({
          to: user.email,
          subject: EMAIL_SUBJECTS[step],
          body: EMAIL_BODY[step](user.name || "there", planDisplay),
          fromName: "AuthiChain Billing",
        });
      }
    } catch {
      // Email failure must not abort the dunning step log
    }
  }

  await logActivity({
    userId: subscription.userId,
    action: `billing_dunning_${step}`,
    entityType: "subscription",
    entityId: subscription.id,
    details: {
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
    },
  });
  return true;
}

export async function runDunningEscalation() {
  const pastDue = await listPastDueSubscriptions();
  let sent = 0;

  for (const sub of pastDue) {
    const ageDays = daysSince(sub.updatedAt || sub.currentPeriodEnd || sub.createdAt);

    if (ageDays >= 14) {
      const didSend = await runStep(
        sub,
        "day_14",
        "Final billing reminder: update payment details to avoid service downgrade.",
      );
      if (didSend) sent++;
      continue;
    }

    if (ageDays >= 7) {
      const didSend = await runStep(
        sub,
        "day_7",
        "Billing reminder: payment is still overdue. Please update billing details.",
      );
      if (didSend) sent++;
      continue;
    }

    if (ageDays >= 3) {
      const didSend = await runStep(
        sub,
        "day_3",
        "Billing reminder: we could not process your payment. Please update your card.",
      );
      if (didSend) sent++;
    }
  }

  return { checked: pastDue.length, remindersSent: sent };
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runDunningEscalation()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Dunning job failed:", err);
      process.exit(1);
    });
}
