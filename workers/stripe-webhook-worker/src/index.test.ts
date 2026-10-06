import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

const SECRET = "whsec_test_stripe_webhook_worker";
const OTHER_SECRET = "whsec_other_endpoint_secret";
const CONSENSUS_ENGINE_URL = "https://consensus.example.test";

const CHECKOUT_BODY = JSON.stringify({
  type: "checkout.session.completed",
  data: {
    object: {
      metadata: {
        product_id: "p1",
        product_name: "Widget",
        manufacturer: "Acme",
      },
    },
  },
});

const PING_BODY = JSON.stringify({ type: "ping" });

function env(
  overrides: {
    STRIPE_WEBHOOK_SECRET?: string;
    CONSENSUS_ENGINE_URL?: string;
  } = {}
) {
  return {
    STRIPE_WEBHOOK_SECRET: SECRET,
    CONSENSUS_ENGINE_URL,
    ...overrides,
  };
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return [...new Uint8Array(sig)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function stripeSignature(
  body: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
  extraV1: string[] = []
): Promise<string> {
  const v1 = await hmacHex(secret, `${timestamp}.${body}`);
  const parts = [`t=${timestamp}`, ...extraV1.map(s => `v1=${s}`), `v1=${v1}`];
  return parts.join(",");
}

function post(body: string, signature?: string | null) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (signature !== undefined && signature !== null) {
    headers.set("Stripe-Signature", signature);
  }
  return new Request("https://stripe-webhook-worker.example/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("stripe-webhook-worker signature gate", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            consensus: { reached: true, seal_id: "seal-1" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a valid signed event", async () => {
    const signature = await stripeSignature(PING_BODY, SECRET);
    const res = await worker.fetch(post(PING_BODY, signature), env());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts when one of several v1 signatures matches", async () => {
    const signature = await stripeSignature(PING_BODY, SECRET, undefined, [
      "0".repeat(64),
    ]);
    const res = await worker.fetch(post(PING_BODY, signature), env());
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards checkout.session.completed to the consensus engine after a valid signature", async () => {
    const signature = await stripeSignature(CHECKOUT_BODY, SECRET);
    const res = await worker.fetch(post(CHECKOUT_BODY, signature), env());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${CONSENSUS_ENGINE_URL}/verify`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: "p1",
          name: "Widget",
          manufacturer: "Acme",
        }),
      })
    );
  });

  it("rejects a POST with no Stripe-Signature header and does not fetch", async () => {
    const res = await worker.fetch(post(CHECKOUT_BODY), env());
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid signature");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a signature computed with the wrong secret and does not fetch", async () => {
    const signature = await stripeSignature(CHECKOUT_BODY, OTHER_SECRET);
    const res = await worker.fetch(post(CHECKOUT_BODY, signature), env());
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a tampered body and does not fetch", async () => {
    const signature = await stripeSignature(CHECKOUT_BODY, SECRET);
    const tampered = CHECKOUT_BODY.replace("Widget", "Forged");
    const res = await worker.fetch(post(tampered, signature), env());
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a stale timestamp and does not fetch", async () => {
    const stale = Math.floor(Date.now() / 1000) - 301;
    const signature = await stripeSignature(CHECKOUT_BODY, SECRET, stale);
    const res = await worker.fetch(post(CHECKOUT_BODY, signature), env());
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 and does nothing when STRIPE_WEBHOOK_SECRET is unset", async () => {
    const signature = await stripeSignature(CHECKOUT_BODY, SECRET);
    const res = await worker.fetch(
      post(CHECKOUT_BODY, signature),
      env({ STRIPE_WEBHOOK_SECRET: "" })
    );
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 405 for a non-POST request", async () => {
    const res = await worker.fetch(
      new Request("https://stripe-webhook-worker.example/webhook", {
        method: "GET",
      }),
      env()
    );
    expect(res.status).toBe(405);
    expect(await res.text()).toBe("Method not allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON after a valid signature, without fetching", async () => {
    const body = "{not-json";
    const signature = await stripeSignature(body, SECRET);
    const res = await worker.fetch(post(body, signature), env());
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid JSON");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
