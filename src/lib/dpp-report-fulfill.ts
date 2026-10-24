/**
 * Records a paid DPP readiness report ($29 one-time) checkout session:
 * one `payments` row (PK session_id) and one `dpp_report_entitlements` row
 * (UNIQUE stripe_session_id), both ON CONFLICT DO NOTHING, so a duplicate
 * delivery returns 200 with no second row. catalog_limit=200. Throws on any write error so the webhook marks the event
 * `error` and Stripe retries. Logs ids only, never email or secrets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DPP_REPORT_OFFER,
  dppReportCatalogLimit,
} from "./billing/live-catalog";

export type DppReportSession = {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  customer?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type DppReportResult =
  | { unlocked: true; catalogLimit: number }
  | { unlocked: false; reason: "not_paid" | "no_email" };

export async function fulfillDppReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  session: DppReportSession,
  priceId?: string | null
): Promise<DppReportResult> {
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
    throw new Error("dpp_report: paid session has no customer email");
  }
  const now = new Date().toISOString();
  const catalogLimit = dppReportCatalogLimit(session.metadata);

  // Live public.payments (checked 2026-10-24): PK is a uuid `id`, `amount`
  // numeric NOT NULL (no amount_cents), and session_id has NO unique index,
  // so ON CONFLICT (session_id) is impossible there. Look up by session_id,
  // insert only if absent; the UNIQUE entitlement row below is the real
  // idempotency anchor. payments schema is left untouched.
  const amountCents = session.amount_total ?? DPP_REPORT_OFFER.amountCents;
  const { data: existingPay, error: payReadErr } = await supabase
    .from("payments")
    .select("id")
    .eq("session_id", session.id)
    .limit(1)
    .maybeSingle();
  if (payReadErr) throw new Error(`dpp_report payments read failed: ${payReadErr.message}`);
  if (!existingPay) {
    const { error: payErr } = await supabase.from("payments").insert({
      session_id: session.id,
      customer_email: email,
      amount: amountCents / 100,
      currency: (session.currency || "usd").toLowerCase(),
      status: "paid",
      description: "DPP readiness report",
      metadata: { sku: DPP_REPORT_OFFER.sku, amount_cents: amountCents },
      created_at: now,
      updated_at: now,
    });
    if (payErr) throw new Error(`dpp_report payments write failed: ${payErr.message}`);
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const { error: entErr } = await supabase.from("dpp_report_entitlements").upsert(
    {
      stripe_session_id: session.id,
      customer_email: email,
      stripe_customer_id: customerId,
      sku: DPP_REPORT_OFFER.sku,
      tier: DPP_REPORT_OFFER.tier,
      catalog_limit: catalogLimit,
      price_id: priceId ?? null,
      granted_at: now,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true }
  );
  if (entErr) throw new Error(`dpp_report entitlement write failed: ${entErr.message}`);

  console.log(
    JSON.stringify({
      evt: "dpp_report_unlocked",
      session: session.id,
      catalog_limit: catalogLimit,
    })
  );
  return { unlocked: true, catalogLimit };
}
