/**
 * PM-330 items 1 + 4 for first-dollar-desk POST /api/stripe/webhook:
 * official Stripe verification, 300s replay window, fail closed, and a
 * once-only event_id claim. Real Stripe SDK signatures, fake KV.
 */
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain JS Worker module, no type declarations
import worker from "./index.js";

const SECRET = "whsec_unit_test_only";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
  };
}

const ignoredEvent = JSON.stringify({
  id: "evt_fdd_once",
  object: "event",
  type: "payment_intent.created",
  data: { object: { id: "pi_fake" } },
});

function sign(payload: string, timestamp = Math.floor(Date.now() / 1000)) {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
    timestamp,
  });
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("https://first-dollar-desk.example/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

async function call(req: Request, LEDGER = fakeKv()) {
  const res = await worker.fetch(req, {
    LEDGER,
    STRIPE_WEBHOOK_SECRET: SECRET,
  });
  return { res, LEDGER };
}

describe("first-dollar-desk /api/stripe/webhook (PM-330)", () => {
  it("rejects an unsigned POST with 400 and writes nothing", async () => {
    const { res, LEDGER } = await call(post(ignoredEvent));
    expect(res.status).toBe(400);
    expect(LEDGER.store.size).toBe(0);
  });

  it("rejects a forged signature with 400", async () => {
    const forged = Stripe.webhooks.generateTestHeaderString({
      payload: ignoredEvent,
      secret: "whsec_attacker",
    });
    const { res, LEDGER } = await call(
      post(ignoredEvent, { "stripe-signature": forged })
    );
    expect(res.status).toBe(400);
    expect(LEDGER.store.size).toBe(0);
  });

  it("rejects a validly-signed delivery older than 300s with 400 (the old check accepted it forever)", async () => {
    const old = sign(ignoredEvent, Math.floor(Date.now() / 1000) - 301);
    const { res, LEDGER } = await call(
      post(ignoredEvent, { "stripe-signature": old })
    );
    expect(res.status).toBe(400);
    expect(LEDGER.store.size).toBe(0);
  });

  it("fails closed when STRIPE_WEBHOOK_SECRET is unset", async () => {
    const LEDGER = fakeKv();
    const res = await worker.fetch(
      post(ignoredEvent, { "stripe-signature": sign(ignoredEvent) }),
      { LEDGER }
    );
    expect(res.status).toBe(400);
    expect(LEDGER.store.size).toBe(0);
  });

  it("accepts a fresh signature once, then skips the same event_id", async () => {
    const LEDGER = fakeKv();
    const first = await call(
      post(ignoredEvent, { "stripe-signature": sign(ignoredEvent) }),
      LEDGER
    );
    expect(first.res.status).toBe(200);
    expect(await first.res.json()).toMatchObject({
      received: true,
      ignored: "payment_intent.created",
    });
    expect(LEDGER.store.has("stripe_evt:evt_fdd_once")).toBe(true);
    LEDGER.store.delete("stripe_webhook_last");

    const second = await call(
      post(ignoredEvent, { "stripe-signature": sign(ignoredEvent) }),
      LEDGER
    );
    expect(second.res.status).toBe(200);
    expect(await second.res.json()).toMatchObject({ duplicate: true });
    // The duplicate did not act: no new stripe_webhook_last write.
    expect(LEDGER.store.has("stripe_webhook_last")).toBe(false);
  });

  it("releases the event claim and answers 500 when processing fails, so Stripe's retry runs it (CFA-121)", async () => {
    const LEDGER = fakeKv();
    const realPut = LEDGER.put;
    let failWrites = true;
    LEDGER.put = async (k: string, v: string) => {
      if (failWrites && !k.startsWith("stripe_evt:")) {
        throw new Error("KV write failed");
      }
      return realPut(k, v);
    };

    const first = await call(
      post(ignoredEvent, { "stripe-signature": sign(ignoredEvent) }),
      LEDGER
    );
    expect(first.res.status).toBe(500);
    expect(LEDGER.store.has("stripe_evt:evt_fdd_once")).toBe(false);

    failWrites = false;
    const retry = await call(
      post(ignoredEvent, { "stripe-signature": sign(ignoredEvent) }),
      LEDGER
    );
    expect(retry.res.status).toBe(200);
    expect(await retry.res.json()).toMatchObject({
      received: true,
      ignored: "payment_intent.created",
    });
    expect(LEDGER.store.has("stripe_evt:evt_fdd_once")).toBe(true);
    expect(LEDGER.store.has("stripe_webhook_last")).toBe(true);
  });
});
