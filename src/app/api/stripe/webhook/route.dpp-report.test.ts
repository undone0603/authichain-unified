/**
 * Phase 3 PR-C: fail-closed 503 + DPP report $29 one-time unlock (idempotent on session id).
 * Stripe, Supabase, next/server and the ledger are faked in-process.
 * No network, no live money, no real keys.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { provisionPurchase } from "@/lib/provisioning";
import {
  STOREPILOT_PRO_PRICE_ID,
  isDppReportSession,
  resolveCheckoutPlanId,
} from "../../../../lib/billing/live-catalog";

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
vi.mock("stripe", () => ({
  default: class {
    subscriptions = { retrieve: vi.fn() };
    checkout = { sessions: { list: vi.fn().mockResolvedValue({ data: [] }) } };
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => builder(t) }),
}));
vi.mock("@/lib/stripe-construct-event", () => ({
  constructStripeEventAsync: (...a: unknown[]) => mockConstructEvent(...a),
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

describe("fail closed", () => {
  it("Supabase unset -> 503, body never read, signature never checked, no writes", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await post(proSession());
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Supabase not configured");
    expect(textSpy).not.toHaveBeenCalled();
    expect(mockConstructEvent).not.toHaveBeenCalled();
    expect(db.writes).toBe(0);
  });

  it("Supabase URL unset -> 503", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect((await post(proSession())).status).toBe(503);
  });

  it("Stripe webhook secret unset -> 503, nothing read", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
    const res = await post(proSession());
    expect(res.status).toBe(503);
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("bad signature -> 400, no writes", async () => {
    mockConstructEvent.mockRejectedValue(new Error("bad sig"));
    const res = await post();
    expect(res.status).toBe(400);
    expect(db.writes).toBe(0);
  });
});

describe("DPP report $29 one-time", () => {
  it("metadata product_line=dpp_report unlocks the report, NOT Starter", async () => {
    const res = await post(proSession());
    expect(res.status).toBe(200);
    expect(provisionPurchase).not.toHaveBeenCalled();
    const pay = [...table("payments").values()];
    const ent = [...table("dpp_report_entitlements").values()];
    expect(pay).toHaveLength(1);
    expect(pay[0]).toMatchObject({ session_id: "cs_live_pro_1", amount_cents: 2900, status: "paid" });
    expect(ent).toHaveLength(1);
    expect(ent[0]).toMatchObject({ tier: "dpp_report", sku: "dpp_report", catalog_limit: 200 });
    await mockAfter[0]();
    expect(mockAnchorSale).toHaveBeenCalledWith(expect.objectContaining({ sku: "dpp_report", amountCents: 2900 }));
  });

  it("configured DPP_REPORT_PRICE_ID matches; unset matches nothing by id", () => {
    const env = { DPP_REPORT_PRICE_ID: "price_dppfixture" };
    expect(isDppReportSession({ metadata: {} }, "price_dppfixture", env)).toBe(true);
    expect(isDppReportSession({ metadata: {} }, "price_dppfixture", {})).toBe(false);
  });

  it("product metadata on the line item marks DPP", () => {
    expect(isDppReportSession({ line_items: { data: [{ price: { id: "price_x", product: { metadata: { product_line: "dpp_report" } } } }] } }, "price_x", {})).toBe(true);
  });

  it("StorePilot Pro price never unlocks DPP, even if configured or marked", () => {
    const env = { DPP_REPORT_PRICE_ID: STOREPILOT_PRO_PRICE_ID };
    expect(isDppReportSession({ metadata: {} }, STOREPILOT_PRO_PRICE_ID, env)).toBe(false);
    expect(isDppReportSession({ metadata: { product_line: "dpp_report" } }, STOREPILOT_PRO_PRICE_ID, {})).toBe(false);
  });

  it("duplicate event delivery -> 200, one row", async () => {
    await post(proSession());
    const res = await post(proSession());
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(table("dpp_report_entitlements").size).toBe(1);
  });

  it("second event for the same session id -> 200, still one row", async () => {
    await post(proSession());
    db.eventSeen = false;
    const res = await post({ ...proSession(), id: "evt_pro_2", type: "checkout.session.async_payment_succeeded" });
    expect(res.status).toBe(200);
    expect(table("payments").size).toBe(1);
    expect(table("dpp_report_entitlements").size).toBe(1);
  });

  it("unpaid session -> no writes", async () => {
    await post(proSession({ payment_status: "unpaid" }));
    expect(db.writes).toBe(0);
  });

  it("an unmarked $29 session with line items still provisions Starter", async () => {
    await post(proSession({ metadata: {} }));
    expect(table("dpp_report_entitlements").size).toBe(0);
    expect(provisionPurchase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ plan: "starter" }));
    expect(resolveCheckoutPlanId({ priceId: STOREPILOT_PRO_PRICE_ID })).toBeNull();
  });
});
