/**
 * PM-330 items 1 + 4 for the edge router (authichain-edge-router →
 * handleStripeWebhook). Unlike stripe.test.ts, Stripe is NOT mocked here: the
 * real SDK verifies real signatures, so these pin the fail-closed behaviour
 * and the 300s replay window end to end. The route maps any throw to HTTP 400
 * (worker-app/index.ts stripeWebhookPost; a missing header is a 400 before the
 * handler runs, covered in worker-app/routes.test.ts).
 */
import Stripe from "stripe";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAutomationAudit: vi.fn().mockResolvedValue(undefined),
  recordRevenue: vi.fn().mockResolvedValue(undefined),
  upsertStripeSubscription: vi.fn().mockResolvedValue(undefined),
  setSubscriptionStatusByStripeId: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeSubscriptionId: vi.fn().mockResolvedValue(null),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
  // The apex Worker has no DATABASE_URL: the Drizzle check fails open, so
  // the stripe_events claim is the only duplicate guard.
  hasWebhookEventProcessed: vi
    .fn()
    .mockRejectedValue(
      new Error("DATABASE_URL environment variable is not set")
    ),
}));

vi.mock("../email-service.js", () => ({
  sendEmail: vi.fn().mockResolvedValue({ status: "sent", provider: "resend" }),
}));

vi.mock("../services/order-payment-handler.js", () => ({
  handleServiceOrderPayment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/lib/stripe-webhook-log", () => ({
  recordStripeWebhookDelivery: vi.fn().mockResolvedValue({ ok: true }),
  checkoutSessionIdFromEvent: () => null,
}));

const { claimed } = vi.hoisted(() => ({ claimed: new Set<string>() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: (table: string) => {
      if (table !== "stripe_events") return {};
      return {
        // insert ... on conflict (event_id) do nothing, as the real PK does.
        upsert: (row: { event_id: string }) => ({
          select: async () => {
            if (claimed.has(row.event_id)) return { data: [], error: null };
            claimed.add(row.event_id);
            return { data: [{ event_id: row.event_id }], error: null };
          },
        }),
        update: () => {
          const chain = {
            eq: () => chain,
            or: () => chain,
            select: async () => ({ data: [], error: null }),
          };
          return chain;
        },
      };
    },
  }),
}));

const SECRET = "whsec_unit_test_only";

function expiredEvent(id: string) {
  return JSON.stringify({
    id,
    object: "event",
    type: "checkout.session.expired",
    data: {
      object: {
        id: `cs_${id}`,
        object: "checkout.session",
        mode: "payment",
        customer_email: "buyer@example.com",
        metadata: { plan: "starter" },
        amount_total: 2900,
      },
    },
  });
}

function sign(payload: string, timestamp = Math.floor(Date.now() / 1000)) {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
    timestamp,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  claimed.clear();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_unit_only";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_unit_only";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("edge router Stripe webhook — fail closed + replay window", () => {
  it("rejects an unsigned delivery before any side effect", async () => {
    const { handleStripeWebhook } = await import("./stripe");
    const { sendEmail } = await import("../email-service.js");
    await expect(
      handleStripeWebhook(Buffer.from(expiredEvent("evt_unsigned")), "")
    ).rejects.toThrow(/stripe-signature/i);
    expect(claimed.size).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a forged signature", async () => {
    const { handleStripeWebhook } = await import("./stripe");
    const payload = expiredEvent("evt_forged");
    const forged = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_attacker",
    });
    await expect(
      handleStripeWebhook(Buffer.from(payload), forged)
    ).rejects.toThrow(/No signatures found/);
    expect(claimed.size).toBe(0);
  });

  it("rejects a validly-signed delivery older than 300s (replay)", async () => {
    const { handleStripeWebhook } = await import("./stripe");
    const { sendEmail } = await import("../email-service.js");
    const payload = expiredEvent("evt_old");
    const old = sign(payload, Math.floor(Date.now() / 1000) - 301);
    await expect(
      handleStripeWebhook(Buffer.from(payload), old)
    ).rejects.toThrow(/tolerance/i);
    expect(claimed.size).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("accepts a fresh signature, then skips the same event_id the second time", async () => {
    const { handleStripeWebhook } = await import("./stripe");
    const { sendEmail } = await import("../email-service.js");
    const payload = expiredEvent("evt_once");

    const first = await handleStripeWebhook(
      Buffer.from(payload),
      sign(payload)
    );
    expect(first.received).toBe(true);
    expect(first.duplicate).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
      idempotencyKey: "stripe-evt_once-checkout_recovery_subscription",
    });

    // Stripe retry: freshly re-signed, same event id.
    const second = await handleStripeWebhook(
      Buffer.from(payload),
      sign(payload)
    );
    expect(second.duplicate).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
