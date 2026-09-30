/**
 * Wire existing src/lib/checkout-gate.ts onto the Cloudflare worker.
 *
 * GET/HEAD never creates a Stripe session (scanner / preview protection).
 * POST with a valid work email creates the session via tryHandleGatedCheckout.
 *
 * Growth-loop events (LOOP-03 contract, docs/growth/2026-09-28-first-dollar-loops.md)
 * are delivered here rather than inside the gate, for two reasons:
 *   - waitUntil keeps the Supabase round-trip off the checkout's critical path,
 *     so instrumentation can never slow down or fail a sale;
 *   - only the Worker knows its Supabase binding.
 * The gate hands us a raw email; hashing happens here so nothing but a digest
 * is ever sent.
 */
import type { Context } from "hono";
import { tryHandleGatedCheckout, type CheckoutGateEvent } from "../src/lib/checkout-gate";
import { hashEmail, loopForEvent } from "../src/lib/growth/emit";
import { isFounderEmail } from "../src/lib/billing/live-catalog";

type GrowthEnv = {
  STRIPE_SECRET_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

/**
 * Append one event via public.growth_record_event. The RPC is SECURITY DEFINER
 * and anon-executable, so the anon key is enough — the edge router has no
 * guaranteed service-role binding (see worker-app/wrangler.toml).
 */
async function recordGrowthEvent(env: GrowthEnv, event: CheckoutGateEvent): Promise<void> {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) return; // Unbound: stay silent rather than throw.

  const loop = loopForEvent(event.event, event.sku);
  if (!loop) return;

  const email = (event.email || "").trim();
  const body: Record<string, unknown> = {
    p_event: event.event,
    p_loop: loop,
    p_sku: event.sku,
    p_founder: email.length > 0 && isFounderEmail(email),
    p_occurred_at: new Date().toISOString(),
  };
  if (email.length > 0) body.p_email_hash = await hashEmail(email);

  const res = await fetch(`${url}/rest/v1/rpc/growth_record_event`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Log loudly on failure: a silently dropped event is what made "$0 revenue"
  // indistinguishable from "never measured" in the first place.
  if (!res.ok) {
    console.error(
      `[growth] ${event.event}/${event.sku} not recorded: ${res.status} ${await res.text()}`,
    );
  }
}

export async function renderGatedCheckout(c: Context): Promise<Response> {
  const env = c.env as GrowthEnv;

  const handled = await tryHandleGatedCheckout(c.req.raw, env, {
    onEvent: (event) => {
      // Never await, never throw into the gate: waitUntil lets the response
      // return immediately while the write finishes.
      try {
        c.executionCtx.waitUntil(
          recordGrowthEvent(env, event).catch(err => {
            console.error("[growth] record failed:", err instanceof Error ? err.message : err);
          }),
        );
      } catch {
        /* no executionCtx (tests / non-Worker host) — drop the event */
      }
    },
  });

  if (handled) return handled;
  return c.notFound();
}
