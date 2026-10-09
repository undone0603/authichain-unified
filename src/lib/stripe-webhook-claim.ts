/**
 * Once-only claim for Stripe webhook events (CFD-251 F1).
 *
 * The apex `authichain-edge-router` Worker has no DATABASE_URL, so the Drizzle
 * idempotency check fails open and a Stripe retry / Resend of the same event
 * ran again. This claims each event id once in `public.stripe_events`
 * (PRIMARY KEY event_id) through the Supabase service client the Worker
 * already has, BEFORE any fulfillment or email:
 *
 *   insert ... on conflict (event_id) do nothing
 *   - 1 row inserted                 -> "claimed"
 *   - 0 rows (row exists)            -> re-claim only if the earlier delivery
 *                                       ended status=error, or is stuck at
 *                                       status=received for >10 min (crashed
 *                                       Worker); otherwise "duplicate"
 *   - any other error / no client    -> "unavailable" (fail open, as before)
 *
 * The handler's existing delivery log then upserts status=success / error on
 * the same row, so no separate finish step is needed.
 */

type SupabaseError = { code?: string; message?: string } | null;

// Deliberately loose: the real client's builder types are generic-heavy, and
// tests pass a hand-rolled fake.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export type StripeEventClaim = "claimed" | "duplicate" | "unavailable";

export const STRIPE_CLAIM_STALE_MS = 10 * 60 * 1000;

export async function claimStripeEvent(
  supabase: SupabaseLike | null | undefined,
  eventId: string,
  eventType: string,
  now: Date = new Date()
): Promise<StripeEventClaim> {
  if (!supabase || !eventId) return "unavailable";
  try {
    const at = now.toISOString();
    const { data, error } = (await supabase
      .from("stripe_events")
      .upsert(
        {
          event_id: eventId,
          event_type: eventType,
          processed_at: at,
          status: "received",
        },
        { onConflict: "event_id", ignoreDuplicates: true }
      )
      .select("event_id")) as { data: unknown[] | null; error: SupabaseError };
    if (error) {
      console.warn(
        `[stripe-webhook] claim skipped (${error.code ?? "error"}: ${error.message ?? ""})`
      );
      return "unavailable";
    }
    if (Array.isArray(data) && data.length > 0) return "claimed";

    // Row already existed. Let Stripe's retry of a failed delivery through.
    const staleBefore = new Date(
      now.getTime() - STRIPE_CLAIM_STALE_MS
    ).toISOString();
    const { data: re, error: reErr } = (await supabase
      .from("stripe_events")
      .update({ status: "received", processed_at: at })
      .eq("event_id", eventId)
      .or(
        `status.eq.error,and(status.eq.received,processed_at.lt."${staleBefore}")`
      )
      .select("event_id")) as { data: unknown[] | null; error: SupabaseError };
    if (reErr) {
      console.warn(
        `[stripe-webhook] re-claim check failed (${reErr.code ?? "error"}); treating as duplicate`
      );
      return "duplicate";
    }
    return Array.isArray(re) && re.length > 0 ? "claimed" : "duplicate";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[stripe-webhook] claim skipped (${msg})`);
    return "unavailable";
  }
}
