/**
 * Records a paid StorePilot Pro ($29 one-time) checkout session:
 * one `payments` row (PK session_id, so replays are no-ops) and one
 * `storepilot_entitlements` row (unique stripe_session_id) with tier=pro and
 * catalog_limit=200. Throws on any write error so the webhook marks the event
 * `error` and Stripe retries. Logs ids only, never email or secrets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STOREPILOT_PRO_OFFER,
  storePilotCatalogLimit,
} from "./billing/live-catalog";

export type StorePilotProSession = {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  customer?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type StorePilotProResult =
  | { unlocked: true; catalogLimit: number }
  | { unlocked: false; reason: "not_paid" | "no_email" };

export async function fulfillStorePilotPro(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  session: StorePilotProSession
): Promise<StorePilotProResult> {
  if (session.payment_status !== "paid") {
    return { unlocked: false, reason: "not_paid" };
  }
  const email = (
    session.customer_email ||
    session.customer_details?.email ||
    ""
  )
    .toLowerCase()
    .trim();
  if (!email) {
    throw new Error("storepilot_pro: paid session has no customer email");
  }
  const now = new Date().toISOString();
  const catalogLimit = storePilotCatalogLimit(session.metadata);

  const { error: payErr } = await supabase.from("payments").upsert(
    {
      session_id: session.id,
      customer_email: email,
      amount_cents: session.amount_total ?? STOREPILOT_PRO_OFFER.amountCents,
      currency: (session.currency || "usd").toLowerCase(),
      status: "paid",
      created_at: now,
      updated_at: now,
    },
    { onConflict: "session_id", ignoreDuplicates: true }
  );
  if (payErr) throw new Error(`storepilot_pro payments write failed: ${payErr.message}`);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const { error: entErr } = await supabase.from("storepilot_entitlements").upsert(
    {
      stripe_session_id: session.id,
      customer_email: email,
      stripe_customer_id: customerId,
      sku: STOREPILOT_PRO_OFFER.sku,
      tier: STOREPILOT_PRO_OFFER.tier,
      catalog_limit: catalogLimit,
      price_id: STOREPILOT_PRO_OFFER.priceId,
      granted_at: now,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true }
  );
  if (entErr) throw new Error(`storepilot_pro entitlement write failed: ${entErr.message}`);

  console.log(
    JSON.stringify({
      evt: "storepilot_pro_unlocked",
      session: session.id,
      catalog_limit: catalogLimit,
    })
  );
  return { unlocked: true, catalogLimit };
}
