/**
 * Persist Stripe webhook deliveries to public.stripe_events (Supabase).
 *
 * Live table today is event_id + event_type + processed_at only — that is
 * enough to prove a delivery reached the apex handler. Optional columns
 * (session_id, status, http_status, error) land via migration; if they are
 * missing the write falls back to the three base columns so observability
 * does not wait on `supabase db push`.
 *
 * A row here is NOT a fulfill lock. DPP replay must still run
 * fulfillDppPaidSession (idempotent via session-id dedupe).
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

export function checkoutSessionIdFromEvent(event: {
  type?: string;
  data?: { object?: { id?: string } };
}): string | null {
  const type = event.type || "";
  if (!type.startsWith("checkout.session.")) return null;
  const id = event.data?.object?.id;
  return typeof id === "string" ? id : null;
}
