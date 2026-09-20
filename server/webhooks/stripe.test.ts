/**
 * Stripe webhook handler unit tests.
 * Stripe SDK, db calls, and email/order handlers are all mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Stripe ──────────────────────────────────────────────────────────────

const mockConstructEvent = vi.fn();
const mockCustomersRetrieve = vi.fn();

vi.mock("stripe", () => {
  class MockStripe {
    webhooks = {
      // Live Workers throw if the handler calls the sync API.
      constructEvent: () => {
        throw new Error(
          "SubtleCryptoProvider cannot be used in a synchronous context. Use await constructEventAsync(...) instead of constructEvent(...)"
        );
      },
      constructEventAsync: (...args: unknown[]) =>
        Promise.resolve(mockConstructEvent(...args)),
    };
    customers = { retrieve: mockCustomersRetrieve };
  }
  return { default: MockStripe };
});

// ─── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock("../db.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAutomationAudit: vi.fn().mockResolvedValue(undefined),
  recordRevenue: vi.fn().mockResolvedValue(undefined),
  upsertStripeSubscription: vi.fn().mockResolvedValue(undefined),
  setSubscriptionStatusByStripeId: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeSubscriptionId: vi.fn().mockResolvedValue(null),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
  hasWebhookEventProcessed: vi.fn().mockResolvedValue(false),
}));

vi.mock("../stripe-products.js", () => ({
  getPlanQuota: vi.fn().mockReturnValue(100),
  STRIPE_PRODUCTS: {
    starter: { name: "Starter", priceMonthly: 4900, features: ["Basic auth"] },
    professional: {
      name: "Professional",
      priceMonthly: 19900,
      features: ["Advanced auth"],
    },
    enterprise: {
      name: "Enterprise",
      priceMonthly: 79900,
      features: ["All features"],
    },
  },
}));

vi.mock("../email-service.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/order-payment-handler.js", () => ({
  handleServiceOrderPayment: vi.fn().mockResolvedValue(undefined),
}));

const { fulfillDppPaidSession } = vi.hoisted(() => ({
  fulfillDppPaidSession: vi.fn().mockResolvedValue({
    handled: true,
    profileId: "prof_dpp",
  }),
}));

vi.mock("../../src/lib/dpp-fulfill-checkout", () => ({
  fulfillDppPaidSession,
}));

const { recordStripeWebhookDelivery } = vi.hoisted(() => ({
  recordStripeWebhookDelivery: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../src/lib/stripe-webhook-log", () => ({
  recordStripeWebhookDelivery,
  checkoutSessionIdFromEvent: (event: {
    type?: string;
    data?: { object?: { id?: string } };
  }) => {
    const type = event.type || "";
    if (!type.startsWith("checkout.session.")) return null;
    const id = event.data?.object?.id;
    return typeof id === "string" ? id : null;
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({ from: vi.fn() }),
}));

// The Stripe SDK is mocked above, so these values are never used to reach
// Stripe — they only satisfy the guards in getStripeClient() and
// handleStripeWebhook(), which throw when the secrets are absent. Without them
// both tests fail on configuration rather than on behaviour, which is what they
// were doing. Set lazily-read env before any handler call.
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_dummy_for_unit_tests";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(type: string, id: string, data: object) {
  return { id, type, data: { object: data } };
}

const RAW_BODY = Buffer.from("{}");
const SIG = "stripe-sig";

// ─── Tests ────────────────────────────────────────────────────────────────────

// Common setup: reset mocks and set required env vars before every test.
// The "prerequisites" suite overrides env vars inside its own test body.
beforeEach(async () => {
  vi.clearAllMocks();
  const db = await import("../db.js");
  vi.mocked(db.hasWebhookEventProcessed).mockResolvedValue(false);
  vi.mocked(db.logActivity).mockResolvedValue(undefined);
  vi.mocked(db.logAutomationAudit).mockResolvedValue(undefined);
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";
});

describe("handleStripeWebhook — prerequisites", () => {
  it("throws when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
    const { handleStripeWebhook } = await import("./stripe.js");
    await expect(handleStripeWebhook(RAW_BODY, SIG)).rejects.toThrow(
      "STRIPE_WEBHOOK_SECRET not configured"
    );
  });

  it("treats whitespace-only STRIPE_WEBHOOK_SECRET as missing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "  \n";
    delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
    const { handleStripeWebhook } = await import("./stripe.js");
    await expect(handleStripeWebhook(RAW_BODY, SIG)).rejects.toThrow(
      "STRIPE_WEBHOOK_SECRET not configured"
    );
  });
});

describe("handleStripeWebhook — signature verification", () => {
  it("rejects when constructEventAsync cannot verify any candidate secret", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error(
        "No signatures found matching the expected signature for payload."
      );
    });
    const { handleStripeWebhook } = await import("./stripe.js");
    await expect(handleStripeWebhook(RAW_BODY, SIG)).rejects.toThrow(
      /No signatures found matching the expected signature[\s\S]*STRIPE_WEBHOOK_SECRET=set/
    );
    expect(fulfillDppPaidSession).not.toHaveBeenCalled();
  });

  it("trims wrangler-echo newlines before constructEventAsync", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test\n";
    mockConstructEvent.mockReturnValue(
      makeEvent("webhook_endpoint.created", "evt_test_trim", {})
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    await handleStripeWebhook(RAW_BODY, SIG);
    expect(mockConstructEvent).toHaveBeenCalledWith("{}", SIG, "whsec_test");
  });
});

describe("handleStripeWebhook — test events", () => {
  it("returns received:true immediately for test verification events", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("webhook_endpoint.created", "evt_test_verify", {})
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
  });
});

describe("handleStripeWebhook — idempotency", () => {
  it("marks duplicate events and skips processing", async () => {
    const { hasWebhookEventProcessed } = await import("../db.js");
    vi.mocked(hasWebhookEventProcessed).mockResolvedValueOnce(true);
    mockConstructEvent.mockReturnValue(
      makeEvent("customer.subscription.created", "evt_001", {})
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.duplicate).toBe(true);
    expect(result.received).toBe(true);
    expect(recordStripeWebhookDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: "evt_001",
        eventType: "customer.subscription.created",
        status: "duplicate",
        httpStatus: 200,
      })
    );
  });
});

describe("handleStripeWebhook — subscription events", () => {
  beforeEach(() => {
    mockCustomersRetrieve.mockResolvedValue({
      deleted: false,
      metadata: { user_id: "42" },
    });
  });

  it("handles customer.subscription.created without throwing", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("customer.subscription.created", "evt_sub_001", {
        id: "sub_abc",
        status: "active",
        customer: "cus_123",
        metadata: {},
        items: {
          data: [{ price: { id: "price_starter", unit_amount: 4900 } }],
        },
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("handles customer.subscription.deleted and cancels subscription", async () => {
    const { setSubscriptionStatusByStripeId } = await import("../db.js");
    mockConstructEvent.mockReturnValue(
      makeEvent("customer.subscription.deleted", "evt_sub_del", {
        id: "sub_del",
        status: "canceled",
        customer: "cus_456",
        metadata: { user_id: "7" },
        items: { data: [] },
        current_period_end: Math.floor(Date.now() / 1000),
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(setSubscriptionStatusByStripeId)).toHaveBeenCalledWith(
      "sub_del",
      "cancelled",
      expect.any(Date)
    );
  });
});

describe("handleStripeWebhook — invoice events", () => {
  beforeEach(() => {
    mockCustomersRetrieve.mockResolvedValue({
      deleted: false,
      metadata: { user_id: "5" },
    });
  });

  it("invoice.payment_succeeded records revenue", async () => {
    const { recordRevenue } = await import("../db.js");
    mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_succeeded", "evt_inv_ok", {
        id: "in_001",
        customer: "cus_abc",
        subscription: "sub_001",
        amount_paid: 4900,
        currency: "usd",
        lines: { data: [{ price: { id: "price_starter_monthly" } }] },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(recordRevenue)).toHaveBeenCalledWith(
      expect.objectContaining({ source: "stripe", amount: "49.00" })
    );
  });

  it("invoice.payment_failed sets subscription to past_due and notifies user", async () => {
    const {
      setSubscriptionStatusByStripeId,
      createSystemNotification,
      getSubscriptionByStripeSubscriptionId,
    } = await import("../db.js");
    vi.mocked(getSubscriptionByStripeSubscriptionId).mockResolvedValueOnce({
      userId: 99,
    } as any);
    mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_failed", "evt_inv_fail", {
        id: "in_fail_001",
        customer: "cus_abc",
        subscription: "sub_001",
        amount_paid: 0,
        currency: "usd",
        lines: { data: [] },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(setSubscriptionStatusByStripeId)).toHaveBeenCalledWith(
      "sub_001",
      "past_due"
    );
    expect(vi.mocked(createSystemNotification)).toHaveBeenCalledWith(
      99,
      "Payment Failed",
      expect.any(String),
      "alert",
      "/subscriptions"
    );
  });
});

describe("handleStripeWebhook — checkout.session.completed", () => {
  it("subscription mode logs audit without throwing", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_checkout_001", {
        id: "cs_test_001",
        mode: "subscription",
        payment_status: "paid",
        customer: "cus_789",
        subscription: "sub_new",
        metadata: { user_id: "10", plan: "professional" },
        amount_total: 19900,
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
  });

  it("one_time_service mode calls handleServiceOrderPayment", async () => {
    const { handleServiceOrderPayment } =
      await import("../services/order-payment-handler.js");
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_service_001", {
        id: "cs_service_001",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_service_001",
        customer: "cus_svc",
        metadata: { user_id: "20", type: "one_time_service" },
        amount_total: 49900,
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(handleServiceOrderPayment)).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cs_service_001",
        payment_intent: "pi_service_001",
      })
    );
  });

  it("fulfills a paid DPP session even when Drizzle DATABASE_URL is missing", async () => {
    const { hasWebhookEventProcessed, logActivity, logAutomationAudit } =
      await import("../db.js");
    vi.mocked(hasWebhookEventProcessed).mockRejectedValue(
      new Error("DATABASE_URL environment variable is not set")
    );
    vi.mocked(logActivity).mockRejectedValue(
      new Error("DATABASE_URL environment variable is not set")
    );
    vi.mocked(logAutomationAudit).mockRejectedValue(
      new Error("DATABASE_URL environment variable is not set")
    );
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_dpp_edge", {
        id: "cs_live_smoke_check",
        mode: "payment",
        payment_status: "paid",
        amount_total: 0,
        customer_details: { email: "authichain@gmail.com" },
        client_reference_id: "smoke_check_1789786486",
        metadata: {
          offer: "dpp_readiness_2026",
          plan: "dpp_readiness",
          visit_id: "smoke_check_1789786486",
        },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(result.handled).toBe(true);
    expect(fulfillDppPaidSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "cs_live_smoke_check" }),
      null
    );
  });

  it("fulfills a $0 DPP-SMOKE checkout.session.completed (is_demo)", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_dpp_zero", {
        id: "cs_live_a1y4Tu_smoke",
        mode: "payment",
        payment_status: "paid",
        amount_total: 0,
        customer_details: { email: "authichain@gmail.com" },
        client_reference_id: "smoke_check_1789786486",
        metadata: {
          offer: "dpp_readiness_2026",
          plan: "dpp_readiness",
          visit_id: "smoke_check_1789786486",
          is_demo: "true",
          promo: "DPP-SMOKE-E2E",
        },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(fulfillDppPaidSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "cs_live_a1y4Tu_smoke",
        amount_total: 0,
      }),
      null
    );
  });

  it("does not fulfill checkout.session.completed until payment_status is paid", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_dpp_unpaid", {
        id: "cs_async_pending",
        mode: "payment",
        payment_status: "unpaid",
        amount_total: 29900,
        metadata: {
          offer: "dpp_readiness_2026",
          plan: "dpp_readiness",
          visit_id: "dpp_async_1",
        },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(fulfillDppPaidSession).not.toHaveBeenCalled();
  });

  it("fulfills checkout.session.async_payment_succeeded for delayed wallets", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.async_payment_succeeded", "evt_dpp_async", {
        id: "cs_async_paid",
        mode: "payment",
        payment_status: "paid",
        amount_total: 29900,
        metadata: {
          offer: "dpp_readiness_2026",
          plan: "dpp_readiness",
          visit_id: "dpp_async_1",
          stripe_price_id: "price_1TwmD8GqTruSqV8TpAF8dfyA",
        },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(fulfillDppPaidSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "cs_async_paid" }),
      "price_1TwmD8GqTruSqV8TpAF8dfyA"
    );
  });

  it("replays DPP fulfill when Drizzle already marked the event processed", async () => {
    const { hasWebhookEventProcessed, upsertStripeSubscription } =
      await import("../db.js");
    vi.mocked(hasWebhookEventProcessed).mockResolvedValue(true);
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_dpp_replay", {
        id: "cs_live_a1y4Tu_replay",
        mode: "payment",
        payment_status: "paid",
        amount_total: 0,
        customer_details: { email: "authichain@gmail.com" },
        client_reference_id: "smoke_check_1789786486",
        metadata: {
          offer: "dpp_readiness_2026",
          plan: "dpp_readiness",
          visit_id: "smoke_check_1789786486",
          is_demo: "true",
          promo: "DPP-SMOKE-E2E",
        },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.duplicate).toBe(true);
    expect(result.handled).toBe(true);
    expect(fulfillDppPaidSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "cs_live_a1y4Tu_replay" }),
      null
    );
    expect(vi.mocked(upsertStripeSubscription)).not.toHaveBeenCalled();
    expect(recordStripeWebhookDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: "evt_dpp_replay",
        sessionId: "cs_live_a1y4Tu_replay",
        status: "received",
      })
    );
    expect(recordStripeWebhookDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: "evt_dpp_replay",
        sessionId: "cs_live_a1y4Tu_replay",
        status: "success",
        httpStatus: 200,
      })
    );
  });

  it("persists stripe_events received then success for a paid $0 DPP session", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_dpp_log", {
        id: "cs_live_a1y4Tu_log",
        mode: "payment",
        payment_status: "paid",
        amount_total: 0,
        metadata: {
          offer: "dpp_readiness_2026",
          plan: "dpp_readiness",
          visit_id: "smoke_check_1789786486",
          promo: "DPP-SMOKE-E2E",
        },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    await handleStripeWebhook(RAW_BODY, SIG);
    expect(
      recordStripeWebhookDelivery.mock.calls.map(c => c[1].status)
    ).toEqual(["received", "success"]);
    expect(recordStripeWebhookDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: "evt_dpp_log",
        eventType: "checkout.session.completed",
        sessionId: "cs_live_a1y4Tu_log",
        status: "success",
        httpStatus: 200,
      })
    );
  });

  it("persists stripe_events error when DPP fulfill throws", async () => {
    fulfillDppPaidSession.mockRejectedValueOnce(new Error("supabase down"));
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_dpp_fail", {
        id: "cs_live_a1y4Tu_fail",
        mode: "payment",
        payment_status: "paid",
        amount_total: 0,
        metadata: {
          offer: "dpp_readiness_2026",
          plan: "dpp_readiness",
          visit_id: "smoke_check_1789786486",
        },
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    await expect(handleStripeWebhook(RAW_BODY, SIG)).rejects.toThrow(
      "supabase down"
    );
    expect(recordStripeWebhookDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: "evt_dpp_fail",
        sessionId: "cs_live_a1y4Tu_fail",
        status: "error",
        httpStatus: 400,
        error: "supabase down",
      })
    );
  });
});

describe("handleStripeWebhook — checkout.session.expired (abandoned cart)", () => {
  it("sends recovery email when customer_email is present", async () => {
    const { sendEmail } = await import("../email-service.js");
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.expired", "evt_expired_001", {
        id: "cs_expired_001",
        customer_email: "lost@example.com",
        metadata: { user_id: "30", plan: "starter", customer_name: "Alex" },
        amount_total: 4900,
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lost@example.com" })
    );
  });

  it("does not send email when no customer_email", async () => {
    const { sendEmail } = await import("../email-service.js");
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.expired", "evt_expired_002", {
        id: "cs_expired_002",
        metadata: { plan: "starter" },
        amount_total: 4900,
      })
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });
});

describe("plan detection (via subscription amounts)", () => {
  beforeEach(() => {
    mockCustomersRetrieve.mockResolvedValue({
      deleted: false,
      metadata: { user_id: "1" },
    });
  });

  const cases: Array<{
    priceId: string;
    amount: number;
    expectedPlan: string;
  }> = [
    { priceId: "price_starter_monthly", amount: 4900, expectedPlan: "starter" },
    {
      priceId: "price_professional_monthly",
      amount: 19900,
      expectedPlan: "professional",
    },
    {
      priceId: "price_enterprise_annual",
      amount: 95880,
      expectedPlan: "enterprise",
    },
  ];

  for (const { priceId, amount, expectedPlan } of cases) {
    it(`detects plan '${expectedPlan}' from priceId '${priceId}'`, async () => {
      const { upsertStripeSubscription } = await import("../db.js");
      mockConstructEvent.mockReturnValue(
        makeEvent("customer.subscription.created", `evt_plan_${expectedPlan}`, {
          id: `sub_${expectedPlan}`,
          status: "active",
          customer: "cus_plan",
          metadata: { user_id: "1" },
          items: { data: [{ price: { id: priceId, unit_amount: amount } }] },
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        })
      );
      const { handleStripeWebhook } = await import("./stripe.js");
      await handleStripeWebhook(RAW_BODY, SIG);
      expect(vi.mocked(upsertStripeSubscription)).toHaveBeenCalledWith(
        expect.objectContaining({ plan: expectedPlan })
      );
    });
  }
});
