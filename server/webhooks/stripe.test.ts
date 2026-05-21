/**
 * Stripe webhook handler unit tests.
 * Stripe SDK, db calls, and getPlanQuota are all mocked.
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
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(type: string, id: string, data: object) {
  return { id, type, data: { object: data } };
}

const RAW_BODY = Buffer.from("{}");
const SIG = "stripe-sig";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleStripeWebhook — prerequisites", () => {
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
  });

  it("returns received:true immediately for test verification events", async () => {
    mockConstructEvent.mockReturnValue(makeEvent("webhook_endpoint.created", "evt_test_verify", {}));
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
  });
});

describe("handleStripeWebhook — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
  });

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
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
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
        items: { data: [{ price: { id: "price_starter", unit_amount: 4900 } }] },
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      }),
    );
    const { handleStripeWebhook } = await import("./stripe.js");
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("handles customer.subscription.deleted without throwing", async () => {
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
    expect(vi.mocked(setSubscriptionStatusByStripeId)).toHaveBeenCalled();
  });
});

describe("handleStripeWebhook — checkout.session.completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
  });

  it("handles checkout.session.completed with subscription mode without throwing", async () => {
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
});

describe("plan detection (via subscription amounts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    mockCustomersRetrieve.mockResolvedValue({ deleted: false, metadata: { user_id: "1" } });
  });

  const cases: Array<{ priceId: string; amount: number; expectedPlan: string }> = [
    { priceId: "price_starter_monthly", amount: 4900, expectedPlan: "starter" },
    { priceId: "price_professional_monthly", amount: 19900, expectedPlan: "professional" },
    { priceId: "price_enterprise_annual", amount: 95880, expectedPlan: "enterprise" },
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
