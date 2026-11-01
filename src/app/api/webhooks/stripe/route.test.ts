/**
 * Opt-in legacy Stripe receiver regression test for issue #2038.
 * Signed synthetic test events, fake Supabase, no network and no live charge.
 * The canonical /api/stripe/webhook handler is deliberately not involved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { POST } from "./route";

const { inserts, dbState, fakeDb } = vi.hoisted(() => {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const dbState = { rejectPayment: false };
  const fakeDb = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          if (table === "payments" && dbState.rejectPayment) {
            return Promise.resolve({ error: { message: "simulated insert failure" } });
          }
          return Promise.resolve({ error: null });
        },
        update(_row: Record<string, unknown>) {
          return {
            async eq(_column: string, _value: unknown) {
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { inserts, dbState, fakeDb };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => fakeDb,
}));

const testSecret = "whsec_legacy_regression_offline_only";
const signer = new Stripe("sk_test_offline_legacy_fixture_not_a_key");
const environment = [
  "STRIPE_WEBHOOK_LEGACY_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_AUTHICHAIN_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const saved = Object.fromEntries(
  environment.map(name => [name, process.env[name]])
) as Record<string, string | undefined>;

function checkoutEvent(id: string, amountTotal = 29900) {
  return {
    id: `evt_test_legacy_${id}`,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: `cs_test_legacy_${id}`,
        object: "checkout.session",
        payment_status: "paid",
        mode: "payment",
        amount_total: amountTotal,
        currency: "usd",
        customer_email: "offline-buyer@example.test",
      },
    },
  };
}

function signedRequest(
  event: ReturnType<typeof checkoutEvent>,
  secret = testSecret
): NextRequest {
  const payload = JSON.stringify(event);
  const signature = signer.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return {
    text: async () => payload,
    headers: {
      get: (name: string) => (name === "stripe-signature" ? signature : null),
    },
  } as unknown as NextRequest;
}

describe("retired legacy webhook payment amount", () => {
  beforeEach(() => {
    inserts.length = 0;
    dbState.rejectPayment = false;
    process.env.STRIPE_WEBHOOK_LEGACY_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_offline_legacy_fixture_not_a_key";
    process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET = testSecret;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline_fixture_only";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const name of environment) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it("remains retired and never writes when not explicitly enabled", async () => {
    delete process.env.STRIPE_WEBHOOK_LEGACY_ENABLED;
    const response = await POST(signedRequest(checkoutEvent("retired")));
    expect(response.status).toBe(410);
    expect(inserts).toEqual([]);
  });

  it("verifies a signed USD $299 checkout and writes amount 299, not amount_cents", async () => {
    const response = await POST(signedRequest(checkoutEvent("usd299", 29900)));
    expect(response.status).toBe(200);
    const payment = inserts.find(entry => entry.table === "payments")?.row;
    expect(payment).toMatchObject({
      session_id: "cs_test_legacy_usd299",
      amount: 299,
      currency: "usd",
      status: "paid",
    });
    expect(payment).not.toHaveProperty("amount_cents");
    expect(inserts.some(entry => entry.table === "stripe_events")).toBe(true);
  });

  it("retains the two-decimal conversion for fractional USD amounts", async () => {
    const response = await POST(signedRequest(checkoutEvent("usd29999", 29999)));
    expect(response.status).toBe(200);
    const payment = inserts.find(entry => entry.table === "payments")?.row;
    expect(payment?.amount).toBe(299.99);
  });

  it("rejects a different signing secret without recording payment", async () => {
    const response = await POST(
      signedRequest(checkoutEvent("bad_sig"), "whsec_other_dummy")
    );
    expect(response.status).toBe(400);
    expect(inserts).toEqual([]);
  });

  it("returns 500 when the payment insert fails, so Stripe can retry", async () => {
    dbState.rejectPayment = true;
    const response = await POST(signedRequest(checkoutEvent("db_error")));
    expect(response.status).toBe(500);
    expect(inserts.some(entry => entry.table === "stripe_events")).toBe(false);
  });
});
