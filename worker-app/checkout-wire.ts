/**
 * Wire existing src/lib/checkout-gate.ts onto the Cloudflare worker.
 *
 * GET/HEAD never creates a Stripe session (scanner / preview protection).
 * POST with a valid work email creates the session via tryHandleGatedCheckout.
 *
 * Growth-loop events (LOOP-03 contract, docs/growth/2026-09-28-first-dollar-loops.md)
 * are delivered here rather than inside the gate: waitUntil keeps the Supabase
 * round-trip off the checkout's critical path, so instrumentation can never slow
 * down or fail a sale. The gate hands over a raw email; only a digest is sent.
 */
import type { Context } from "hono";
import { tryHandleGatedCheckout } from "../src/lib/checkout-gate";
import { reportGrowthEvent } from "./growth-record";

export async function renderGatedCheckout(c: Context): Promise<Response> {
  const handled = await tryHandleGatedCheckout(c.req.raw, c.env as { STRIPE_SECRET_KEY?: string }, {
    onEvent: event => reportGrowthEvent(c, event),
  });
  if (handled) return handled;
  return c.notFound();
}
