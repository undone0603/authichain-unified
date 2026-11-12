/**
 * Canonical Stripe webhook grant for one prepaid 120-verification pack.
 * Never reuse the QR-generation provisionPurchase path. The price, paid status,
 * mode, livemode, quantity and actual Stripe line items must all match.
 *
 * A unique Stripe checkout-session ID makes duplicate webhook deliveries
 * idempotent. The amount metadata is never trusted to mint verifications.
 */
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  X402_AGENT_PACK_CREDITS,
  X402_AGENT_PACK_PRICE_ID,
  isX402PackCandidate,
  validX402PackPurchase,
} from "./x402-agent-pack";

export type PackGrantResult =
  | "not_pack"
  | "unpaid"
  | "reconciliation_required"
  | "granted"
  | "revoked";

export async function fulfillX402AgentPackIfPaid(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  supabase: SupabaseClient | null
): Promise<PackGrantResult> {
  const seenPrice =
    session.line_items?.data?.[0]?.price?.id ??
    session.metadata?.stripe_price_id ??
    null;
  if (!isX402PackCandidate(session.metadata, seenPrice)) return "not_pack";
  if (session.payment_status !== "paid") return "unpaid";

  // Verify against Stripe's actual line items, never the request metadata.
  const response = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 2,
  });
  const items = response.data.map(item => ({
    priceId: item.price?.id ?? null,
    quantity: item.quantity ?? null,
    unitAmount: item.price?.unit_amount ?? null,
    currency: item.price?.currency ?? null,
    recurring: item.price?.type === "recurring",
  }));
  if (!validX402PackPurchase({
    livemode: session.livemode,
    mode: session.mode,
    paymentStatus: session.payment_status,
    currency: session.currency,
    amountSubtotal: session.amount_subtotal,
    amountTotal: session.amount_total,
    items,
  })) {
    // A paid wrong-account/wrong-price/discounted checkout must not mint credits.
    throw new Error("x402_pack_payment_evidence_mismatch");
  }

  const email = (
    session.customer_details?.email || session.customer_email || ""
  ).trim().toLowerCase();
  if (!email || !email.includes("@") || !supabase) {
    return "reconciliation_required";
  }

  const intentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  if (!intentId) return "reconciliation_required";
  // One server-side transaction serializes grants against earlier/later
  // refunds and disputes on the same PaymentIntent. A late paid webhook
  // can never resurrect a reversed purchase.
  const { data, error } = await supabase.rpc("grant_x402_agent_pack", {
    p_checkout_session_id: session.id,
    p_payment_intent_id: intentId,
    p_buyer_email: email,
  });
  if (error || !["granted", "existing", "reversed"].includes(String(data))) {
    throw new Error("x402_pack_grant_write_failed");
  }
  if (data === "reversed") return "revoked";
  return "granted";
}

/**
 * Idempotent refund/dispute handling. A protected webhook can safely retry
 * this update even after it has claimed the Stripe event ID.
 * Keep revocation active when the Checkout kill switch is OFF: previously
 * sold credits must still be revoked after a payment reversal.
 */
export async function revokeX402AgentPackOnReversal(
  event: Stripe.Event,
  supabase: SupabaseClient | null,
  expectedPriceId: string | undefined = process.env.X402_PACK_PRICE_ID,
  stripe: Stripe | null = null
): Promise<void> {
  if (event.type !== "charge.refunded" && event.type !== "charge.dispute.created") return;
  // Before the approved pack release, never make unrelated refunds depend on a
  // table which has not yet been migrated.
  if (expectedPriceId !== X402_AGENT_PACK_PRICE_ID) return;
  const object = event.data.object as Stripe.Charge | Stripe.Dispute;
  const intentId = typeof object.payment_intent === "string"
    ? object.payment_intent
    : object.payment_intent?.id ?? null;
  if (!intentId) return;
  // Refunds and disputes for unrelated SKUs must not depend on the pack
  // database. Check the Stripe-owned PaymentIntent, not charge metadata.
  // Both checkout entry points attach the approved plan and price ID.
  if (!stripe) throw new Error("x402_pack_reversal_stripe_unavailable");
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(intentId);
  } catch {
    throw new Error("x402_pack_payment_intent_lookup_failed");
  }
  if (paymentIntent.metadata?.plan !== "x402_agent_credits_120" ||
      paymentIntent.metadata?.stripe_price_id !== X402_AGENT_PACK_PRICE_ID) return;
  if (!supabase) throw new Error("x402_pack_revocation_database_unavailable");
  const status = event.type === "charge.refunded" ? "refunded" : "disputed";
  // Record the reversal even if the grant has not arrived yet. The DB
  // transaction uses the same PaymentIntent lock as grant_x402_agent_pack.
  const { data, error } = await supabase.rpc("reverse_x402_agent_pack", {
    p_payment_intent_id: intentId,
    p_status: status,
  });
  if (error || data !== true) throw new Error("x402_pack_revocation_failed");
}
