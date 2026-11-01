/**
 * Offline Stripe signature contract fixture.
 *
 * Uses a local, deliberately fake signing secret. No network, Stripe account,
 * production secret, checkout, or database is needed.
 * This validates the raw-body signature boundary only; it does NOT establish
 * payment fulfillment, durable grants, or authenticated product access.
 */
import { describe, expect, it } from "vitest";
import Stripe from "stripe";

const secret = "whsec_offline_fixture_not_a_real_secret";
const event = {
  id: "evt_offline_signed_fixture",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_offline_fixture",
      object: "checkout.session",
      mode: "payment",
      payment_status: "paid",
      amount_total: 29900,
      currency: "usd",
      metadata: { offer: "dpp_readiness_2026" },
    },
  },
};
const raw = JSON.stringify(event);

function stripe() {
  // Never use a live key. Constructing a client does not make an API call.
  return new Stripe("sk_test_offline_fixture_not_a_real_key");
}

describe("offline signed Stripe webhook fixture", () => {
  it("accepts an HMAC signature over the exact original raw body", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret,
      timestamp,
    });
    const parsed = stripe().webhooks.constructEvent(raw, signature, secret);
    expect(parsed.id).toBe("evt_offline_signed_fixture");
    expect(parsed.type).toBe("checkout.session.completed");
    expect((parsed.data.object as Stripe.Checkout.Session).amount_total).toBe(29900);
  });

  it("rejects any modification of the signed raw body", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret,
      timestamp: Math.floor(Date.now() / 1000),
    });
    expect(() =>
      stripe().webhooks.constructEvent(raw.replace("29900", "0"), signature, secret)
    ).toThrow();
  });

  it("rejects a signature from a different signing secret", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret: "whsec_wrong_offline_fixture",
      timestamp: Math.floor(Date.now() / 1000),
    });
    expect(() => stripe().webhooks.constructEvent(raw, signature, secret)).toThrow();
  });

  it("rejects a signed request outside the default timestamp tolerance", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(() => stripe().webhooks.constructEvent(raw, signature, secret)).toThrow();
  });
});
