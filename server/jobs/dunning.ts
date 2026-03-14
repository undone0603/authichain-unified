import "dotenv/config";
import { pathToFileURL } from "node:url";
import {
  createSystemNotification,
  hasDunningStepLogged,
  listPastDueSubscriptions,
  logActivity,
} from "../db";

function daysSince(date: Date | null | undefined) {
  if (!date) return 0;
  const then = new Date(date).getTime();
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

type Step = "day_3" | "day_7" | "day_14";

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
