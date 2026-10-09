/**
 * PM-338 (a): dpp-fulfillment POST /webhook uses the official Stripe
 * verification with a 300s window and fails closed. Real Stripe SDK
 * signatures, fake KV, stubbed fetch (no network, no real email).
 */
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { STRIPE_WEBHOOK_TOLERANCE_SECONDS } from "./index";

const SECRET = "whsec_unit_test_only";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

function env(KV = fakeKv(), secret = SECRET) {
  return {
    KV,
    STRIPE_WEBHOOK_SECRET: secret,
    RESEND_API_KEY: "re_test_only",
    OFFER_KEY: "dpp_readiness_2026",
    PAYMENT_LINK_URL: "https://example.test/checkout",
    FROM_EMAIL: "from@example.test",
    REPLY_TO: "reply@example.test",
    FOUNDER_NOTIFY: "founder@example.test",
  } as any;
}

function ctx() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil: (p: Promise<unknown>) => pending.push(p),
    passThroughOnException: () => {},
  } as any;
}

const expiredEvent = JSON.stringify({
  id: "evt_dpp_once",
  object: "event",
  type: "checkout.session.expired",
  data: {
    object: {
      id: "cs_test_dpp",
      metadata: { offer: "dpp_readiness_2026" },
      customer_details: { email: "buyer@example.test", name: "Test Buyer" },
    },
  },
});

function sign(
  payload: string,
  timestamp = Math.floor(Date.now() / 1000),
  secret = SECRET
) {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp,
  });
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("https://dpp-fulfillment.example/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ id: "email_test" }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function call(req: Request, e = env()) {
  const c = ctx();
  const res = await worker.fetch(req, e, c);
  await Promise.all(c.pending);
  return { res, KV: e.KV };
}

describe("dpp-fulfillment /webhook (PM-338)", () => {
  it("uses a 300s tolerance", () => {
    expect(STRIPE_WEBHOOK_TOLERANCE_SECONDS).toBe(300);
  });

  it("rejects an unsigned POST with 400 and does nothing", async () => {
    const { res, KV } = await call(post(expiredEvent));
    expect(res.status).toBe(400);
    expect(KV.store.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a forged signature with 401", async () => {
    const forged = sign(expiredEvent, undefined, "whsec_attacker");
    const { res, KV } = await call(
      post(expiredEvent, { "stripe-signature": forged })
    );
    expect(res.status).toBe(401);
    expect(KV.store.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a correctly signed event older than 300s with 401", async () => {
    const stale = sign(expiredEvent, Math.floor(Date.now() / 1000) - 301);
    const { res } = await call(
      post(expiredEvent, { "stripe-signature": stale })
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed with 500 when no webhook secret is configured", async () => {
    const { res } = await call(
      post(expiredEvent, { "stripe-signature": sign(expiredEvent) }),
      env(fakeKv(), "")
    );
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a fresh signed event once and skips the duplicate event_id", async () => {
    const e = env();
    const first = await call(
      post(expiredEvent, { "stripe-signature": sign(expiredEvent) }),
      e
    );
    expect(first.res.status).toBe(200);
    expect(await first.res.json()).toEqual({ status: "accepted" });
    expect(e.KV.store.get("evt:evt_dpp_once")).toBe("checkout.session.expired");
    const sends = fetchMock.mock.calls.length;
    expect(sends).toBe(1);

    const again = await call(
      post(expiredEvent, { "stripe-signature": sign(expiredEvent) }),
      e
    );
    expect(again.res.status).toBe(200);
    expect(await again.res.json()).toEqual({ status: "already_processed" });
    expect(fetchMock.mock.calls.length).toBe(sends);
  });
});
