import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createLicense,
  isEventProcessed,
  logEvent,
  markDelivered,
  getByStripeCustomer,
} = vi.hoisted(() => ({
  createLicense: vi.fn().mockResolvedValue(undefined),
  isEventProcessed: vi.fn().mockResolvedValue(false),
  logEvent: vi.fn().mockResolvedValue(undefined),
  markDelivered: vi.fn().mockResolvedValue(undefined),
  getByStripeCustomer: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/db", () => ({
  DB: {
    createLicense,
    isEventProcessed,
    logEvent,
    markDelivered,
    getByStripeCustomer,
    revoke: vi.fn(),
  },
}));

vi.mock("../services/license", () => ({
  issueLicenseKey: vi.fn().mockResolvedValue("license.jwt"),
  hashKey: vi.fn().mockResolvedValue("abc123"),
  tierFromPriceId: vi.fn().mockReturnValue("pro"),
  seatsForTier: vi.fn().mockReturnValue(5),
}));

vi.mock("../services/telegram", () => ({
  notifyAdminNewLicense: vi.fn().mockResolvedValue(undefined),
  deliverKeyViaTelegram: vi.fn().mockResolvedValue(false),
}));

vi.mock("../services/email", () => ({
  deliverKeyViaEmail: vi.fn().mockResolvedValue(false),
}));

vi.mock("../utils/crypto", () => ({
  verifyStripeSignature: vi.fn().mockResolvedValue(true),
}));

import { handleCheckout, stripeWebhook } from "./stripe-webhook";
import { licenseHealth } from "./health";
import type { Env } from "../index";

function env(overrides: Partial<Env> = {}): Env {
  return {
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_AGENT_BROWSER_PRO_PRICE_ID: "price_pro",
    STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID: "price_ent",
    LICENSE_PRIVATE_KEY_PEM: "-----BEGIN PRIVATE KEY-----",
    LICENSE_PUBLIC_KEY_PEM: "-----BEGIN PUBLIC KEY-----",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_ADMIN_CHAT_ID: "",
    DATABASE: {} as D1Database,
    SESSIONS: {} as KVNamespace,
    ...overrides,
  };
}

const dummyCtx = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext;

describe("license issuer health", () => {
  it("returns 503 JSON when required secrets are missing", async () => {
    const res = licenseHealth(
      new Request("https://issuer.example/health"),
      env({ STRIPE_WEBHOOK_SECRET: "", LICENSE_PRIVATE_KEY_PEM: "" }),
      dummyCtx
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.bindings.STRIPE_WEBHOOK_SECRET).toBe(false);
    expect(body.webhook).toBe("/api/license/stripe-webhook");
  });

  it("returns 200 when D1, webhook secret, and signing key are present", async () => {
    const res = licenseHealth(
      new Request("https://issuer.example/health"),
      env(),
      dummyCtx
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("handleCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createLicense.mockResolvedValue(undefined);
    getByStripeCustomer.mockResolvedValue(null);
  });

  it("writes a D1 license when Stripe omits customer id but includes email", async () => {
    await handleCheckout(env(), {
      id: "cs_guest",
      customer: null,
      customer_details: { email: "buyer@example.com" },
      metadata: { priceId: "price_pro" },
    });
    expect(createLicense).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: "buyer@example.com",
        stripe_customer_id: "email:buyer@example.com",
      })
    );
  });

  it("throws instead of silently skipping when email is missing", async () => {
    await expect(
      handleCheckout(env(), { id: "cs_no_email", customer: "cus_1" })
    ).rejects.toThrow(/email/i);
    expect(createLicense).not.toHaveBeenCalled();
  });

  it("does not mint a second license when the customer already has an active one", async () => {
    getByStripeCustomer.mockResolvedValue({
      id: "existing-jti",
      status: "active",
      stripe_customer_id: "cus_1",
    });
    await handleCheckout(env(), {
      id: "cs_retry",
      customer: "cus_1",
      customer_details: { email: "paid@example.com" },
      metadata: { priceId: "price_pro" },
    });
    expect(createLicense).not.toHaveBeenCalled();
  });
});

describe("stripeWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEventProcessed.mockResolvedValue(false);
    getByStripeCustomer.mockResolvedValue(null);
  });

  it("returns 503 without pretending the event was accepted when secrets are missing", async () => {
    const res = await stripeWebhook(
      new Request("https://issuer.example/api/license/stripe-webhook", {
        method: "POST",
        body: "{}",
      }),
      env({ STRIPE_WEBHOOK_SECRET: "" }),
      dummyCtx
    );
    expect(res.status).toBe(503);
    expect(createLicense).not.toHaveBeenCalled();
  });

  it("processes checkout.session.completed before returning 200", async () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_paid",
          customer: "cus_1",
          customer_details: { email: "paid@example.com" },
          metadata: { priceId: "price_pro" },
        },
      },
    });
    const res = await stripeWebhook(
      new Request("https://issuer.example/api/license/stripe-webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "t=1,v1=abc" },
        body: payload,
      }),
      env(),
      dummyCtx
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("processed");
    expect(createLicense).toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.anything(),
      "evt_1",
      "checkout.session.completed",
      "success",
      ""
    );
  });

  it("does not mint a second license when Stripe retries after createLicense", async () => {
    const payload = JSON.stringify({
      id: "evt_retry",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_paid",
          customer: "cus_1",
          customer_details: { email: "paid@example.com" },
          metadata: { priceId: "price_pro" },
        },
      },
    });
    const req = () =>
      new Request("https://issuer.example/api/license/stripe-webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "t=1,v1=abc" },
        body: payload,
      });

    const first = await stripeWebhook(req(), env(), dummyCtx);
    expect(first.status).toBe(200);
    expect(createLicense).toHaveBeenCalledTimes(1);

    isEventProcessed.mockResolvedValueOnce(false);
    getByStripeCustomer.mockResolvedValueOnce({
      id: "jti-1",
      status: "active",
      stripe_customer_id: "cus_1",
    });
    const retry = await stripeWebhook(req(), env(), dummyCtx);
    expect(retry.status).toBe(200);
    expect(createLicense).toHaveBeenCalledTimes(1);
  });
});
