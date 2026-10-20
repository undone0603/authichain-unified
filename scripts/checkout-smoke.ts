#!/usr/bin/env tsx
/**
 * Checkout smoke: creates an incomplete live Checkout Session for QRON Starter
 * price_1UIoEVGqTruSqV8T61lp48wB and logs the session ID.
 * Does not complete payment. Marks metadata for exclusion (smoke / is_demo).
 *
 * Usage: STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/checkout-smoke.ts
 * Cost: $0 (unpaid session only). Human-only: provide live secret.
 */
import Stripe from "stripe";

const PRICE_ID = "price_1UIoEVGqTruSqV8T61lp48wB"; // QRON Starter $29
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_KEY || !STRIPE_KEY.startsWith("sk_live_")) {
  console.error("Set STRIPE_SECRET_KEY to a live secret. Aborting.");
  process.exit(1);
}

async function main() {
  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-06-20" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: "https://qron.space/generate?paid=1&session_id={CHECKOUT_SESSION_ID}&smoke=1",
    cancel_url: "https://qron.space/#pricing",
    client_reference_id: `smoke-${Date.now()}`,
    metadata: {
      smoke: "true",
      is_demo: "true",
      plan: "starter",
      brand: "qron",
      source: "checkout-smoke",
    },
    payment_intent_data: {
      metadata: {
        smoke: "true",
        is_demo: "true",
        plan: "starter",
      },
    },
    expires_at: Math.floor(Date.now() / 1000) + 1800,
  });

  console.log(
    JSON.stringify({
      evt: "checkout_smoke_created",
      session_id: session.id,
      url: session.url,
      price_id: PRICE_ID,
      amount_total: session.amount_total,
      ts: Date.now(),
    })
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ evt: "checkout_smoke_failed", error: String(err?.message ?? err) }));
  process.exit(1);
});
