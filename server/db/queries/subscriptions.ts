import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { subscriptions } from "../../../drizzle/schema";

/**
 * Returns all subscriptions currently flagged as past due.
 */
export async function listPastDueSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptions).where(eq(subscriptions.status, "past_due"));
}

/**
 * Looks up a local subscription record by its Stripe subscription id.
 */
export async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return result[0];
}

/**
 * Updates the status of a subscription identified by its Stripe subscription id.
 */
export async function setSubscriptionStatusByStripeId(
  stripeSubscriptionId: string,
  status: string,
  cancelledAt?: Date,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(subscriptions)
    .set({ status, updatedAt: new Date(), ...(cancelledAt ? { cancelledAt } : {}) })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}
