import { describe, expect, it, vi } from "vitest";
// @ts-expect-error -- plain JS Worker module, no type declarations
import { handleStripeWebhook } from "./index.js";

function fakeDb() {
  const prepare = vi.fn(() => {
    throw new Error("DB must not be touched");
  });
  return { prepare };
}

const subscriptionEvent = JSON.stringify({
  id: "evt_fake",
  type: "customer.subscription.created",
  data: {
    object: {
      id: "sub_fake",
      customer: "cus_fake",
      status: "active",
      items: { data: [] },
    },
  },
});

function post(headers: Record<string, string> = {}, body = subscriptionEvent) {
  return new Request("https://automation.example/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("authichain-automation /webhooks/stripe fails closed (PM-321)", () => {
  it("rejects a request with no Stripe-Signature header and writes nothing", async () => {
    const DB = fakeDb();
    const res = await handleStripeWebhook(post(), {
      DB,
      STRIPE_WEBHOOK_SECRET: "whsec_x",
    });
    expect(res.status).toBe(400);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("rejects an empty unsigned body with 400", async () => {
    const DB = fakeDb();
    const res = await handleStripeWebhook(post({}, "{}"), {
      DB,
      STRIPE_WEBHOOK_SECRET: "whsec_x",
    });
    expect(res.status).toBe(400);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("rejects a signature that does not verify with 401 and writes nothing", async () => {
    const DB = fakeDb();
    const res = await handleStripeWebhook(
      post({ "stripe-signature": "t=1,v1=deadbeef" }),
      { DB, STRIPE_WEBHOOK_SECRET: "whsec_x" }
    );
    expect(res.status).toBe(401);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("rejects when the webhook secret is not configured, even with a header", async () => {
    const DB = fakeDb();
    const res = await handleStripeWebhook(
      post({ "stripe-signature": "t=1,v1=00" }),
      { DB }
    );
    expect(res.status).toBe(401);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("rejects non-POST methods", async () => {
    const DB = fakeDb();
    const res = await handleStripeWebhook(
      new Request("https://automation.example/webhooks/stripe"),
      { DB, STRIPE_WEBHOOK_SECRET: "whsec_x" }
    );
    expect(res.status).toBe(405);
    expect(DB.prepare).not.toHaveBeenCalled();
  });
});
