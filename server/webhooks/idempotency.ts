/**
 * Webhook Idempotency Helper
 * Prevents duplicate webhook processing by tracking event IDs
 */

import * as db from "../db";
import { webhookEvents } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface WebhookEventKey {
  provider: "stripe" | "paddle" | "instantly" | "docusign";
  eventId: string;
  eventType: string;
}

/**
 * Check if webhook event has been processed before
 * @returns true if this is a duplicate (already processed)
 */
export async function isWebhookDuplicate(key: WebhookEventKey): Promise<boolean> {
  try {
    const database = await db.getDb();
    if (!database) return false;

    const existing = await database
      .select()
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, key.provider),
          eq(webhookEvents.eventId, key.eventId)
        )
      )
      .limit(1);

    return existing.length > 0;
  } catch {
    // On error, allow processing (fail-open) rather than silently dropping webhooks
    return false;
  }
}

/**
 * Record that a webhook event was received
 * The unique constraint on (provider, eventId) makes this idempotent itself
 */
export async function recordWebhookEvent(key: WebhookEventKey): Promise<boolean> {
  try {
    const database = await db.getDb();
    if (!database) return false;

    await database
      .insert(webhookEvents)
      .values({
        provider: key.provider,
        eventId: key.eventId,
        eventType: key.eventType,
      })
      .onConflictDoNothing();

    return true;
  } catch {
    // Non-fatal: if recording fails, continue processing
    return false;
  }
}

/**
 * Mark a webhook as processed
 * Used to track completion time for monitoring/debugging
 */
export async function markWebhookProcessed(key: WebhookEventKey): Promise<void> {
  try {
    const database = await db.getDb();
    if (!database) return;

    await database
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(
        and(
          eq(webhookEvents.provider, key.provider),
          eq(webhookEvents.eventId, key.eventId)
        )
      );
  } catch {
    // Non-fatal: logging failures don't block webhook processing
  }
}
