/**
 * Persist Stripe webhook deliveries to public.stripe_events (Supabase).
 *
 * Live table today is event_id + event_type + processed_at only — that is
 * enough to prove a delivery reached the apex handler. Optional columns
 * (session_id, status, http_status, error) land via migration; if they are
 * missing the write falls back to the three base columns so observability
 * does not wait on `supabase db push`.
 *
 * Stripe event claims are the durable event-level lock; DPP fulfillment also
 * keeps its Checkout Session idempotency guard for cross-event retries.
 */

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type StripeWebhookDeliveryStatus =
  "received" | "success" | "error" | "duplicate";

export type StripeWebhookDelivery = {
  eventId: string;
  eventType: string;
  sessionId?: string | null;
  status: StripeWebhookDeliveryStatus;
  httpStatus?: number | null;
  error?: string | null;
};

export type StripeWebhookLogResult = {
  ok: boolean;
  detail?: string;
};

export type StripeWebhookClaim = {
  acquired: boolean;
  token?: string;
  error?: string;
};

function baseRow(delivery: StripeWebhookDelivery) {
  return {
    event_id: delivery.eventId,
    event_type: delivery.eventType,
    processed_at: new Date().toISOString(),
  };
}

function richRow(delivery: StripeWebhookDelivery) {
  return {
    ...baseRow(delivery),
    session_id: delivery.sessionId || null,
    status: delivery.status,
    http_status: delivery.httpStatus ?? null,
    error: delivery.error || null,
  };
}

export async function recordStripeWebhookDelivery(
  supabase: SupabaseLike | null | undefined,
  delivery: StripeWebhookDelivery
): Promise<StripeWebhookLogResult> {
  if (!supabase) return { ok: false, detail: "no_supabase" };
  if (!delivery.eventId) return { ok: false, detail: "no_event_id" };

  const { error: richErr } = await supabase
    .from("stripe_events")
    .upsert(richRow(delivery), { onConflict: "event_id" });
  if (!richErr) return { ok: true };

  const { error: baseErr } = await supabase
    .from("stripe_events")
    .upsert(baseRow(delivery), { onConflict: "event_id" });
  if (!baseErr) return { ok: true, detail: "base_columns_only" };

  console.error("[stripe-webhook] stripe_events write failed", baseErr);
  return { ok: false, detail: baseErr.message };
}

export async function claimStripeWebhookEvent(
  supabase: SupabaseLike | null | undefined,
  event: { eventId: string; eventType: string },
  now = new Date()
): Promise<StripeWebhookClaim> {
  if (!supabase) return { acquired: false, error: "no_supabase" };
  if (!event.eventId) return { acquired: false, error: "no_event_id" };

  const token = globalThis.crypto.randomUUID();
  const claimedAt = now.toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("stripe_webhook_claims")
    .upsert(
      {
        event_id: event.eventId,
        event_type: event.eventType,
        status: "processing",
        claim_token: token,
        claimed_at: claimedAt,
        completed_at: null,
      },
      { onConflict: "event_id", ignoreDuplicates: true }
    )
    .select("event_id");

  if (insertError) {
    return { acquired: false, error: insertError.message };
  }
  if (Array.isArray(inserted) && inserted.length > 0) {
    return { acquired: true, token };
  }

  const { data: existing, error: readError } = await supabase
    .from("stripe_webhook_claims")
    .select("status, claim_token, claimed_at")
    .eq("event_id", event.eventId)
    .maybeSingle();
  if (readError || !existing) {
    return {
      acquired: false,
      error: readError?.message || "claim_row_missing",
    };
  }
  if (existing.status === "completed") return { acquired: false };

  const leaseExpired =
    Date.parse(existing.claimed_at) <= now.getTime() - 5 * 60 * 1000;
  if (!leaseExpired) return { acquired: false };

  const { data: reclaimed, error: reclaimError } = await supabase
    .from("stripe_webhook_claims")
    .update({ claim_token: token, claimed_at: claimedAt })
    .eq("event_id", event.eventId)
    .eq("status", "processing")
    .eq("claim_token", existing.claim_token)
    .select("event_id");
  if (reclaimError) {
    return { acquired: false, error: reclaimError.message };
  }
  return Array.isArray(reclaimed) && reclaimed.length > 0
    ? { acquired: true, token }
    : { acquired: false };
}

export async function completeStripeWebhookEvent(
  supabase: SupabaseLike | null | undefined,
  eventId: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "no_supabase" };
  const { data, error } = await supabase
    .from("stripe_webhook_claims")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("status", "processing")
    .eq("claim_token", token)
    .select("event_id");
  if (error) return { ok: false, error: error.message };
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "claim_lost" };
  }
  return { ok: true };
}

export async function releaseStripeWebhookEvent(
  supabase: SupabaseLike | null | undefined,
  eventId: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "no_supabase" };
  const { error } = await supabase
    .from("stripe_webhook_claims")
    .delete()
    .eq("event_id", eventId)
    .eq("status", "processing")
    .eq("claim_token", token);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export function checkoutSessionIdFromEvent(event: {
  type?: string;
  data?: { object?: unknown };
}): string | null {
  const type = event.type || "";
  if (!type.startsWith("checkout.session.")) return null;
  const object = event.data?.object;
  if (!object || typeof object !== "object" || !("id" in object)) return null;
  const id = object.id;
  return typeof id === "string" ? id : null;
}
