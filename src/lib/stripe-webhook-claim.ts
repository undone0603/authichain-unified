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
 *                                       Worker); fresh received -> "in_flight"
 *                                       (HTTP 500 retry), completed -> "duplicate"
 *   - any other error / no client    -> "unavailable". The edge handler
 *                                       now FAILS CLOSED on this (PM-338):
 *                                       it throws StripeEventClaimUnavailableError
 *                                       and the route answers 500 so Stripe
 *                                       retries later instead of the event
 *                                       running without a duplicate guard.
 *
 * The handler's existing delivery log then upserts status=success / error on
 * the same row, so no separate finish step is needed.
 */

type SupabaseError = { code?: string; message?: string } | null;

// Deliberately loose: the real client's builder types are generic-heavy, and
// tests pass a hand-rolled fake.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export type StripeEventClaim = "claimed" | "duplicate" | "in_flight" | "unavailable";

/**
 * Thrown by the edge Stripe webhook handler when the once-only claim could
 * not be made (no Supabase client, or Supabase errored). Routes map it to
 * HTTP 500 so Stripe retries the delivery with backoff (PM-338).
 */
export class StripeEventClaimUnavailableError extends Error {
  readonly httpStatus = 500;
  constructor(eventId: string, reason: "unavailable" | "in_flight" = "unavailable") {
    super(
      reason === "in_flight"
        ? `[stripe-webhook] stripe_events delivery ${eventId} is still in flight; refusing to acknowledge an unverified outcome (Stripe will retry)`
        : `[stripe-webhook] stripe_events claim unavailable for ${eventId}; refusing to process without a duplicate guard (Stripe will retry)`
    );
    this.name = "StripeEventClaimUnavailableError";
  }
}

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
        `[stripe-webhook] re-claim check failed (${reErr.code ?? "error"}); failing closed`
      );
      return "unavailable";
    }
    if (Array.isArray(re) && re.length > 0) return "claimed";

    // A fresh 'received' row is NOT proof that its first delivery completed.
    // Returning 'duplicate' would acknowledge a payment whose first attempt
    // may have failed to persist fulfillment or a reconciliation hold.
    const { data: prior, error: priorErr } = (await supabase
      .from("stripe_events")
      .select("status")
      .eq("event_id", eventId)
      .maybeSingle()) as {
      data: { status: string | null } | null;
      error: SupabaseError;
    };
    if (priorErr || !prior) {
      console.warn("[stripe-webhook] prior claim status unavailable; failing closed");
      return "unavailable";
    }
    return prior.status === "received" ? "in_flight" : "duplicate";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[stripe-webhook] claim skipped (${msg})`);
    return "unavailable";
  }
}
