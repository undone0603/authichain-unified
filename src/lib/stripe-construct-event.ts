import type Stripe from "stripe";

/**
 * Verify a Stripe webhook payload against one or more endpoint secrets.
 *
 * Cloudflare Workers (and any SubtleCrypto runtime) cannot HMAC in a
 * synchronous context. `constructEvent(...)` throws:
 *   SubtleCryptoProvider cannot be used in a synchronous context.
 *   Use await constructEventAsync(...) instead of constructEvent(...)
 *
 * `constructEventAsync` is also valid on Node, so this is the single
 * verification path for the apex Worker and the Next mirror.
 *
 * Payload is always HMAC'd as UTF-8 text (the raw JSON Stripe posted).
 * Secrets are trimmed: `echo | wrangler secret put` stores a trailing
 * newline that otherwise fails every Dashboard signature.
 */
export function normalizeWebhookSecrets(
  secrets: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of secrets) {
    const secret = raw.trim();
    if (!secret || seen.has(secret)) continue;
    seen.add(secret);
    out.push(secret);
  }
  return out;
}

export function webhookPayloadUtf8(payload: string | Buffer): string {
  return typeof payload === "string" ? payload : payload.toString("utf8");
}

export async function constructStripeEventAsync(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  secrets: readonly string[]
): Promise<Stripe.Event> {
  const candidates = normalizeWebhookSecrets(secrets);
  if (candidates.length === 0) {
    throw new Error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
  }

  const raw = webhookPayloadUtf8(payload);
  let lastError: unknown;
  for (const secret of candidates) {
    try {
      return await stripe.webhooks.constructEventAsync(
        raw,
        signature,
        secret
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("[stripe-webhook] Signature verification failed");
}
