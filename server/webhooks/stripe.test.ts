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
    webhooks = { constructEvent: mockConstructEvent };
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
    starter:      { name: "Starter",      priceMonthly: 4900,  features: ["Basic auth"] },
    professional: { name: "Professional", priceMonthly: 19900, features: ["Advanced auth"] },
    enterprise:   { name: "Enterprise",   priceMonthly: 79900, features: ["All features"] },
  },
}));

vi.mock("../email-service.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/order-payment-handler.js", () => ({
  handleServiceOrderPayment: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(type: string, id: string, data: object) {
  return { id, type, data: { object: data } };
}

const RAW_BODY = Buffer.from("{}");
const SIG = "stripe-sig";

// ─── Tests ────────────────────────────────────────────────────────────────────

// Common setup: reset mocks and set required env vars before every test.
// The "prerequisites" suite overrides env vars inside its own test body.
beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_SECRET_KEY = "sk_test";
});

describe("handleStripeWebhook — prerequisites", () => {
  it("throws when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
    const { handleStripeWebhook } = await import("./stripe.js");
    await expect(handleStripeWebhook(RAW_BODY, SIG)).rejects.toThrow(
      "STRIPE_WEBHOOK_SECRET not configured",
    );
  });
});

describe("handleStripeWebhook — test events", () => {

  it("returns received:true immediately for test verification events", async () => {
    mockConstructEvent.mockReturnValue(makeEvent("webhook_endpoint.created", "evt_test_verify", {}));
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
  });
});

describe("handleStripeWebhook — idempotency", () => {

  it("marks duplicate events and skips processing", async () => {
    const { hasWebhookEventProcessed } = await import("../db.js");
    vi.mocked(hasWebhookEventProcessed).mockResolvedValueOnce(true);
    mockConstructEvent.mockReturnValue(makeEvent("customer.subscription.created", "evt_001", {}));
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.duplicate).toBe(true);
    expect(result.received).toBe(true);
  });
});

describe("handleStripeWebhook — subscription events", () => {
  beforeEach(() => {
    mockCustomersRetrieve.mockResolvedValue({ deleted: false, metadata: { user_id: "42" } });
  });

  it("handles customer.subscription.created without throwing", async () => {
    mockConstructEvent.mockReturnValue(
      makeEvent("customer.subscription.created", "evt_sub_001", {
        id: "sub_abc",
        status: "active",
        customer: "cus_123",
        metadata: {},
        items: { data: [{ price: { id: "price_starter", unit_amount: 4900 } }] },
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      }),
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
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(setSubscriptionStatusByStripeId)).toHaveBeenCalledWith("sub_del", "cancelled", expect.any(Date));
  });
});

describe("handleStripeWebhook — invoice events", () => {
  beforeEach(() => {
    mockCustomersRetrieve.mockResolvedValue({ deleted: false, metadata: { user_id: "5" } });
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
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(recordRevenue)).toHaveBeenCalledWith(
      expect.objectContaining({ source: "stripe", amount: "49.00" }),
    );
  });

  it("invoice.payment_failed sets subscription to past_due and notifies user", async () => {
    const {
      setSubscriptionStatusByStripeId,
      createSystemNotification,
      getSubscriptionByStripeSubscriptionId,
    } = await import("../db.js");
    vi.mocked(getSubscriptionByStripeSubscriptionId).mockResolvedValueOnce({ userId: 99 } as any);
    mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_failed", "evt_inv_fail", {
        id: "in_fail_001",
        customer: "cus_abc",
        subscription: "sub_001",
        amount_paid: 0,
        currency: "usd",
        lines: { data: [] },
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(setSubscriptionStatusByStripeId)).toHaveBeenCalledWith("sub_001", "past_due");
    expect(vi.mocked(createSystemNotification)).toHaveBeenCalledWith(
      99, "Payment Failed", expect.any(String), "alert", "/subscriptions",
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
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
  });

  it("one_time_service mode calls handleServiceOrderPayment", async () => {
    const { handleServiceOrderPayment } = await import("../services/order-payment-handler.js");
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", "evt_service_001", {
        id: "cs_service_001",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_service_001",
        customer: "cus_svc",
        metadata: { user_id: "20", type: "one_time_service" },
        amount_total: 49900,
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(handleServiceOrderPayment)).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cs_service_001", payment_intent: "pi_service_001" }),
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
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lost@example.com" }),
    );
  });

  it("does not send email when no customer_email", async () => {
    const { sendEmail } = await import("../email-service.js");
    mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.expired", "evt_expired_002", {
        id: "cs_expired_002",
        metadata: { plan: "starter" },
        amount_total: 4900,
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });
});

describe("plan detection (via subscription amounts)", () => {
  beforeEach(() => {
    mockCustomersRetrieve.mockResolvedValue({ deleted: false, metadata: { user_id: "1" } });
  });

  const cases: Array<{ priceId: string; amount: number; expectedPlan: string }> = [
    { priceId: "price_starter_monthly",      amount: 4900,  expectedPlan: "starter" },
    { priceId: "price_professional_monthly", amount: 19900, expectedPlan: "professional" },
    { priceId: "price_enterprise_annual",    amount: 95880, expectedPlan: "enterprise" },
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
        }),
      );
      const { handleStripeWebhook } = await import("./stripe.js");
      await handleStripeWebhook(RAW_BODY, SIG);
      expect(vi.mocked(upsertStripeSubscription)).toHaveBeenCalledWith(
        expect.objectContaining({ plan: expectedPlan }),
      );
    });
  }
});
