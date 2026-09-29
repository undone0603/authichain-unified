/**
 * Wire existing src/lib/checkout-gate.ts onto the Cloudflare worker.
 *
 * GET/HEAD never creates a Stripe session (scanner / preview protection).
 * POST with a valid work email creates the session via tryHandleGatedCheckout.
 */
import type { Context } from "hono";
import { tryHandleGatedCheckout } from "../src/lib/checkout-gate";

export async function renderGatedCheckout(c: Context): Promise<Response> {
  const env = c.env as { STRIPE_SECRET_KEY?: string };
  const handled = await tryHandleGatedCheckout(c.req.raw, env);
  if (handled) return handled;
  return c.notFound();
}
