/**
 * Phase 3 PR-C: fail-closed 503 + DPP report $29 one-time unlock (idempotent on session id).
 * SIGNED-FIXTURE REPLAY: real Stripe signature verification with a secret
 * generated in-test (never a real secret). Supabase, next/server and the ledger are faked in-process.
 * No network, no live money, no real keys.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

const { mockAfter, mockAnchorSale, mockConstructEvent, db } = vi.hoisted(() => {
  const db = {
    eventSeen: false,
    tables: {} as Record<string, Map<string, Record<string, unknown>>>,
    writes: 0,
  };
  return {
    mockAfter: [] as Array<() => unknown>,
    mockAnchorSale: vi.fn().mockResolvedValue(undefined),
    mockConstructEvent: vi.fn(),
    db,
  };
});

function table(name: string) {
  return (db.tables[name] ??= new Map());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function builder(name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select: () => b,
    eq: () => b,
    update: () => b,
    insert: (row: Record<string, unknown>) => {
      if (name === "stripe_events") {
        if (db.eventSeen)
          return Promise.resolve({ error: { code: "23505", message: "dup" } });
        db.eventSeen = true;
      }
      return Promise.resolve({ error: null });
    },
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string; ignoreDuplicates?: boolean }
    ) => {
      db.writes += 1;
      const key = String(row[opts.onConflict]);
      if (!table(name).has(key)) table(name).set(key, row);
      return Promise.resolve({ error: null });
    },
    maybeSingle: async () =>
      name === "stripe_events"
        ? { data: { status: "success", processed_at: null }, error: null }
        : { data: null, error: null },
    single: async () => ({ data: null, error: null }),
    then: (res: (v: { error: null }) => unknown) =>
      Promise.resolve({ error: null }).then(res),
  };
  return b;
}

vi.mock("next/server", () => ({
  NextResponse: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    }),
  },
  after: (cb: () => unknown) => {
    mockAfter.push(cb);
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => builder(t) }),
}));
vi.mock("@/lib/ledger-service", () => ({
  anchorStripeSale: mockAnchorSale,
  anchorStripeReversal: vi.fn(),
  resolveSku: () => "unknown",
  resolveBuyerWallet: () => null,
}));
vi.mock("@/lib/provisioning", () => ({
  provisionPurchase: vi
    .fn()
    .mockResolvedValue({ status: "provisioned", profileId: null }),
}));
vi.mock("@/lib/billing-emails", () => ({
  renderBillingEmail: () => ({ from: "a", subject: "s", html: "h", text: "t" }),
}));
vi.mock("@/lib/brand-billing", () => ({ getBrandIdFromMetadata: () => "authichain" }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/dpp-loop", () => ({
  recordDppLoopEvent: vi.fn(),
  isDppOffer: () => false,
  dppActivateUrl: () => "",
}));
vi.mock("@/lib/dpp-fulfill-checkout", () => ({ fulfillDppPaidSession: vi.fn() }));

const textSpy = vi.fn(async () => "{}");
void textSpy;
function post(event?: unknown) {
  if (event) mockConstructEvent.mockResolvedValue(event);
  const req = {
    text: textSpy,
    headers: { get: () => "sig_test" },
  } as unknown as NextRequest;
  return POST(req) as unknown as Promise<{ status: number; body: Record<string, unknown> }>;
}

function proSession(over: Record<string, unknown> = {}) {
  return {
    id: "evt_pro_1",
    type: "checkout.session.completed",
    livemode: true,
    data: {
      object: {
        id: "cs_live_pro_1",
        payment_status: "paid",
        payment_link: "plink_dpp_fixture",
        amount_total: 2900,
        amount_subtotal: 2900,
        total_details: { amount_discount: 0 },
        currency: "usd",
        customer_details: { email: "Buyer@Example.com" },
        customer: "cus_1",
        metadata: { product_line: "dpp_report" },
        line_items: { data: [] },
        created: 1790000000,
        ...over,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAfter.length = 0;
  db.eventSeen = false;
  db.tables = {};
  db.writes = 0;
  process.env.STRIPE_SECRET_KEY = "stripe_key_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";
});


import Stripe from "stripe";
import { randomBytes } from "node:crypto";

describe("signed fixture replay (no live money)", () => {
  it("same signed checkout.session.completed delivered twice -> exactly one unlock row", async () => {
    const secret = "whsec_" + randomBytes(24).toString("hex");
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
    const payload = JSON.stringify(proSession());
    const header = await new Stripe("stripe_key_test_dummy").webhooks.generateTestHeaderStringAsync({ payload, secret });
    const deliver = () =>
      POST({ text: async () => payload, headers: { get: (h: string) => (h.toLowerCase() === "stripe-signature" ? header : null) } } as unknown as NextRequest) as unknown as Promise<{ status: number; body: Record<string, unknown> }>;
    const a = await deliver();
    const b = await deliver();
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(table("dpp_report_entitlements").size).toBe(1);
    expect(table("payments").size).toBe(1);
  });

  it("tampered payload is rejected with no row", async () => {
    const secret = "whsec_" + randomBytes(24).toString("hex");
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const payload = JSON.stringify(proSession());
    const header = await new Stripe("stripe_key_test_dummy").webhooks.generateTestHeaderStringAsync({ payload, secret });
    const res = (await POST({ text: async () => payload.replace("2900", "1"), headers: { get: () => header } } as unknown as NextRequest)) as unknown as { status: number };
    expect(res.status).toBe(400);
    expect(table("dpp_report_entitlements").size).toBe(0);
  });
});
