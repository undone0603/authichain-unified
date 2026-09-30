/**
 * Deliver growth-loop events from the Worker.
 *
 * Extracted from checkout-wire.ts so the checkout gate, the /generate surface
 * and any future loop surface all write through one rail.
 *
 * Why an RPC and not a table insert: public.growth_loop_events has RLS enabled
 * with no policies, and authichain-edge-router holds only SUPABASE_ANON_KEY as
 * a var (its service-role key is an optional secret that may not be bound). A
 * direct insert would be rejected and swallowed — the failure that left
 * white_label_clients at 0 rows before migration 20260925180000.
 * public.growth_record_event is SECURITY DEFINER and anon-executable.
 */
import { hashEmail, loopForEvent, type GrowthSku } from "../src/lib/growth/emit";
import { isFounderEmail } from "../src/lib/billing/live-catalog";
import type { GrowthEvent } from "../src/lib/growth/loops";

export type GrowthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export async function recordGrowthEvent(
  env: GrowthEnv,
  input: { event: GrowthEvent; sku: GrowthSku; email?: string | null },
): Promise<void> {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return; // Unbound: stay silent rather than throw.

  const loop = loopForEvent(input.event, input.sku);
  if (!loop) return;

  const email = (input.email || "").trim();
  const body: Record<string, unknown> = {
    p_event: input.event,
    p_loop: loop,
    p_sku: input.sku,
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

  // Log loudly: a silently dropped event is what made "$0 revenue"
  // indistinguishable from "never measured" in the first place.
  if (!res.ok) {
    console.error(
      `[growth] ${input.event}/${input.sku} not recorded: ${res.status} ${await res.text()}`,
    );
  }
}

/**
 * Fire-and-forget from a Hono handler. Returns immediately; the write finishes
 * under waitUntil so no loop surface ever pays analytics latency. Safe to call
 * where there is no executionCtx (tests) — the event is simply dropped.
 */
export function reportGrowthEvent(
  c: { env: unknown; executionCtx?: { waitUntil(p: Promise<unknown>): void } },
  input: { event: GrowthEvent; sku: GrowthSku; email?: string | null },
): void {
  try {
    const p = recordGrowthEvent(c.env as GrowthEnv, input).catch(err => {
      console.error("[growth] record failed:", err instanceof Error ? err.message : err);
    });
    c.executionCtx?.waitUntil(p);
  } catch {
    /* no executionCtx or env — drop the event, never break the page */
  }
}
