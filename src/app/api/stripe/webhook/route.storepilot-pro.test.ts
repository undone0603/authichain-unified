/**
 * Phase 3 PR-C: fail-closed 503 + StorePilot Pro $29 one-time unlock.
 * Stripe, Supabase, next/server and the ledger are faked in-process.
 * No network, no live money, no real keys.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { provisionPurchase } from "@/lib/provisioning";
import {
  STOREPILOT_PRO_OFFER,
  isStorePilotProSession,
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
        payment_link: STOREPILOT_PRO_OFFER.paymentLinkId,
        amount_total: 2900,
        amount_subtotal: 2900,
        total_details: { amount_discount: 0 },
        currency: "usd",
        customer_details: { email: "Buyer@Example.com" },
        customer: "cus_1",
        metadata: {},
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

describe("StorePilot Pro $29 one-time", () => {
  it("the $29 one-time price resolves to Pro, NOT Starter", async () => {
    const res = await post(proSession());
    expect(res.status).toBe(200);
    expect(provisionPurchase).not.toHaveBeenCalled();
    const pay = [...table("payments").values()];
    const ent = [...table("storepilot_entitlements").values()];
    expect(pay).toHaveLength(1);
    expect(pay[0]).toMatchObject({ session_id: "cs_live_pro_1", amount_cents: 2900, status: "paid" });
    expect(ent).toHaveLength(1);
    expect(ent[0]).toMatchObject({ tier: "pro", catalog_limit: 200, price_id: STOREPILOT_PRO_OFFER.priceId });
    expect(mockAfter).toHaveLength(1);
    await mockAfter[0]();
    expect(mockAnchorSale).toHaveBeenCalledWith(expect.objectContaining({ sku: "storepilot_pro", amountCents: 2900 }));
  });

  it("matches on metadata.stripe_price_id too", async () => {
    await post(proSession({ payment_link: null, metadata: { stripe_price_id: STOREPILOT_PRO_OFFER.priceId } }));
    expect(table("storepilot_entitlements").size).toBe(1);
    expect(provisionPurchase).not.toHaveBeenCalled();
  });

  it("replayed event is a duplicate and writes nothing more", async () => {
    await post(proSession());
    const writes = db.writes;
    const res = await post(proSession());
    expect(res.body.duplicate).toBe(true);
    expect(db.writes).toBe(writes);
    expect(table("payments").size).toBe(1);
  });

  it("a second event for the same session keeps one row each", async () => {
    await post(proSession());
    db.eventSeen = false;
    await post({ ...proSession(), id: "evt_pro_2", type: "checkout.session.async_payment_succeeded" });
    expect(table("payments").size).toBe(1);
    expect(table("storepilot_entitlements").size).toBe(1);
  });

  it("unpaid session -> no payment row, no entitlement", async () => {
    await post(proSession({ payment_status: "unpaid" }));
    expect(db.writes).toBe(0);
  });

  it("the retired price never unlocks Pro", () => {
    expect(isStorePilotProSession({ metadata: {} }, "price_1UHlnqRETIRED")).toBe(false);
    expect(isStorePilotProSession({ payment_link: "plink_other", metadata: { stripe_price_id: "price_1UHlnqRETIRED" } }, null)).toBe(false);
  });

  it("an unmarked $29 session still provisions Starter (existing path unchanged)", async () => {
    await post(proSession({ payment_link: null }));
    expect(table("storepilot_entitlements").size).toBe(0);
    expect(provisionPurchase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ plan: "starter" }));
    expect(resolveCheckoutPlanId({ priceId: STOREPILOT_PRO_OFFER.priceId })).toBeNull();
  });
});
