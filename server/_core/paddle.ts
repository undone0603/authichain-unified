/**
 * Paddle webhook signature verification utility.
 *
 * Used by server/paddle/webhook.ts to verify incoming Paddle webhooks.
 */

import crypto from "node:crypto";

interface PaddleEvent {
  eventType: string;
  notificationId: string;
  data: Record<string, unknown>;
}

/**
 * Verify a Paddle webhook signature and return the parsed event data.
 * Returns null if verification fails.
 */
export async function verifyPaddleWebhook(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): Promise<PaddleEvent | null> {
  try {
    // Paddle signatures are in the format: ts=<timestamp>;h1=<hash>
    const parts: Record<string, string> = {};
    for (const part of signature.split(";")) {
      const [key, value] = part.split("=");
      if (key && value) parts[key] = value;
    }

    const ts = parts.ts;
    const h1 = parts.h1;
    if (!ts || !h1) return null;

    const payload = `${ts}:${rawBody}`;
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(h1), Buffer.from(expectedSig))) {
      return null;
    }

    const body = JSON.parse(rawBody);
    return {
      eventType: body.event_type ?? body.eventType ?? "",
      // Paddle sends a unique notification_id per delivery; retries reuse
      // the same id, so it's the right key for dedup. Falls back to event_id
      // for older payload shapes.
      notificationId: body.notification_id ?? body.notificationId ?? body.event_id ?? body.eventId ?? "",
      data: body.data ?? body,
    };
  } catch {
    return null;
  }
}
