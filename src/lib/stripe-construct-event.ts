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
 */
export async function constructStripeEventAsync(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  secrets: readonly string[]
): Promise<Stripe.Event> {
  if (secrets.length === 0) {
    throw new Error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
  }

  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(
        payload,
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
