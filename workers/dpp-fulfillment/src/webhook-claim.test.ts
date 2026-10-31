import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index";

const WEBHOOK = "whsec_test_not_real";

function makeEnv(opts: { failOn?: (key: string) => boolean } = {}): Env & {
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  const env = {
    store,
    KV: {
      get: async (k: string) => {
        if (opts.failOn?.(k)) throw new Error("kv down");
        return store.get(k) ?? null;
      },
      put: async (k: string, v: string) => {
        if (opts.failOn?.(k)) throw new Error("kv down");
        store.set(k, v);
      },
      delete: async (k: string) => {
        store.delete(k);
      },
    } as unknown as KVNamespace,
    STRIPE_WEBHOOK_SECRET: WEBHOOK,
    RESEND_API_KEY: "re_test_not_real",
    OFFER_KEY: "dpp_readiness_2026",
    PAYMENT_LINK_URL: "https://buy.stripe.com/test",
    FROM_EMAIL: "from@example.com",
    REPLY_TO: "reply@example.com",
    FOUNDER_NOTIFY: "founder@example.com",
    DPP_ADMIN_TOKEN: "test-admin-token-not-real",
  };
  return env;
}

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

async function stripeSignature(
  body: string,
  timestamp = Math.floor(Date.now() / 1000)
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`)
  );
  const hex = Array.from(new Uint8Array(sig), b =>
    b.toString(16).padStart(2, "0")
  ).join("");
  return `t=${timestamp},v1=${hex}`;
}

function post(body: string, signature: string): Request {
  return new Request("https://dpp.example/webhook", {
    method: "POST",
    headers: { "Stripe-Signature": signature },
    body,
  });
}

const eventBody = JSON.stringify({
  id: "evt_claim_1",
  type: "customer.created",
  data: { object: {} },
});

afterEach(() => vi.unstubAllGlobals());

describe("POST /webhook claim", () => {
  it("rejects a bad signature before touching the claim", async () => {
    const env = makeEnv();
    const res = await worker.fetch(post(eventBody, "t=1,v1=dead"), env, ctx);
    expect(res.status).toBe(401);
    expect(env.store.size).toBe(0);
  });

  it("claims the event id before answering, and skips a second delivery", async () => {
    const env = makeEnv();
    const signature = await stripeSignature(eventBody);
    const first = await worker.fetch(post(eventBody, signature), env, ctx);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: "accepted" });
    expect(env.store.get("evt:evt_claim_1")).toBe("customer.created");

    const second = await worker.fetch(post(eventBody, signature), env, ctx);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ status: "already_processed" });
  });

  it("releases the claim and answers 500 when fulfillment throws", async () => {
    const env = makeEnv({ failOn: key => key.startsWith("stat:") });
    const signature = await stripeSignature(eventBody);
    const res = await worker.fetch(post(eventBody, signature), env, ctx);
    expect(res.status).toBe(500);
    expect(env.store.has("evt:evt_claim_1")).toBe(false);
    expect(env.store.has("err:evt_claim_1")).toBe(true);
  });
});
