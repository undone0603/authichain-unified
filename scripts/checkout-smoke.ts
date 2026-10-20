#!/usr/bin/env tsx
/**
 * Self-serve checkout smoke: creates (does not complete) a live Checkout Session
 * for QRON Starter price_1UIoEVGqTruSqV8T61lp48wB ($29 one-time).
 * Marks metadata smoke=true, is_demo=true so revenue watch excludes it.
 * Logs session ID. Cost: $0. Never hardcode key.
 *
 * Run: STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/checkout-smoke.ts
 */
import Stripe from "stripe";

const PRICE_ID = "price_1UIoEVGqTruSqV8T61lp48wB";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_live_")) {
    console.error("STRIPE_SECRET_KEY must be a live sk_live_... key");
    process.exit(1);
  }
  const stripe = new Stripe(key);
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
    expires_at: Math.floor(Date.now() / 1000) + 1800,
  });

  console.log(
    JSON.stringify({
      evt: "checkout_smoke_created",
      session_id: session.id,
      url: session.url,
      amount_total: session.amount_total,
      ts: Date.now(),
    })
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      evt: "checkout_smoke_failed",
      error: String(err?.message ?? err),
    })
  );
  process.exit(1);
});
