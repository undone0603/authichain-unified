import Stripe from "stripe";
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

// ── PM-330: official Stripe verification, 300s window, once-only claim ──────

const SECRET = "whsec_unit_test_only";

function sign(payload: string, timestamp = Math.floor(Date.now() / 1000)) {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
    timestamp,
  });
}

/** Minimal D1 fake: the claim table with a real PRIMARY KEY, nothing else. */
function claimDb() {
  const claimed = new Set<string>();
  const writes: string[] = [];
  const prepare = vi.fn((sql: string) => {
    let args: unknown[] = [];
    const stmt = {
      bind: (...a: unknown[]) => {
        args = a;
        return stmt;
      },
      run: async () => {
        if (
          sql.startsWith("CREATE TABLE IF NOT EXISTS stripe_webhook_events")
        ) {
          return { meta: { changes: 0 } };
        }
        if (sql.startsWith("INSERT OR IGNORE INTO stripe_webhook_events")) {
          const id = String(args[0]);
          if (claimed.has(id)) return { meta: { changes: 0 } };
          claimed.add(id);
          return { meta: { changes: 1 } };
        }
        writes.push(sql);
        return { meta: { changes: 1 } };
      },
      first: async () => {
        writes.push(sql);
        return null;
      },
    };
    return stmt;
  });
  return { prepare, claimed, writes };
}

const unhandledEvent = JSON.stringify({
  id: "evt_pm330_once",
  object: "event",
  type: "invoice.paid",
  data: { object: { id: "in_fake" } },
});

describe("authichain-automation /webhooks/stripe replay protection (PM-330)", () => {
  it("rejects a hand-rolled `sha256=` header (the old, wrong format) with 401", async () => {
    const DB = claimDb();
    const res = await handleStripeWebhook(
      post({ "stripe-signature": "sha256=deadbeef" }, unhandledEvent),
      { DB, STRIPE_WEBHOOK_SECRET: SECRET }
    );
    expect(res.status).toBe(401);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("rejects a validly-signed delivery older than 300s with 401 and writes nothing", async () => {
    const DB = claimDb();
    const old = sign(unhandledEvent, Math.floor(Date.now() / 1000) - 301);
    const res = await handleStripeWebhook(
      post({ "stripe-signature": old }, unhandledEvent),
      { DB, STRIPE_WEBHOOK_SECRET: SECRET }
    );
    expect(res.status).toBe(401);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("accepts a fresh signature once, then skips the same event_id", async () => {
    const DB = claimDb();
    const env = { DB, STRIPE_WEBHOOK_SECRET: SECRET };
    const first = await handleStripeWebhook(
      post({ "stripe-signature": sign(unhandledEvent) }, unhandledEvent),
      env
    );
    expect(first.status).toBe(200);
    expect((await first.json()).data).toMatchObject({ handled: false });
    expect(DB.claimed.has("evt_pm330_once")).toBe(true);

    const second = await handleStripeWebhook(
      post({ "stripe-signature": sign(unhandledEvent) }, unhandledEvent),
      env
    );
    expect(second.status).toBe(200);
    expect((await second.json()).data).toMatchObject({ duplicate: true });
  });

  it("does not create a second manufacturer when a subscription event is retried", async () => {
    const DB = claimDb();
    const env = { DB, STRIPE_WEBHOOK_SECRET: SECRET };
    const payload = subscriptionEvent;
    await handleStripeWebhook(
      post({ "stripe-signature": sign(payload) }, payload),
      env
    );
    const inserts = () =>
      DB.writes.filter(sql => sql.startsWith("INSERT INTO manufacturers"))
        .length;
    expect(inserts()).toBe(1);
    const retry = await handleStripeWebhook(
      post({ "stripe-signature": sign(payload) }, payload),
      env
    );
    expect(retry.status).toBe(200);
    expect(inserts()).toBe(1);
  });
});
