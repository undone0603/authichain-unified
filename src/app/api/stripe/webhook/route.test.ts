/**
 * Pins the invoice.paid renewal branching in src/app/api/stripe/webhook/route.ts.
 *
 * - billing_reason 'subscription_create' (first payment, already handled by
 *   checkout.session.completed + anchored under the checkout session id):
 *   no affiliate credit, no ledger anchor.
 * - billing_reason 'subscription_cycle' (renewal): affiliate credit AND
 *   ledger anchor.
 *
 * No Stripe price creation, no live sends, no secrets — Stripe, Supabase,
 * next/server and the ledger are all faked in-process.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

// ─── Hoisted fakes ────────────────────────────────────────────────────────────

const {
  mockAfterCalls,
  mockRetrieve,
  mockAnchorSale,
  mockAnchorReversal,
  mockConstructEvent,
  db,
  calls,
  fakeClient,
} = vi.hoisted(() => {
  const mockAfterCalls: Array<() => unknown> = [];
  const mockRetrieve = vi.fn();
  const mockAnchorSale = vi.fn().mockResolvedValue(undefined);
  const mockAnchorReversal = vi.fn().mockResolvedValue(undefined);
  const mockConstructEvent = vi.fn();
  const db = {
    seenEvent: null as null | { event_id: string },
    profile: { id: "prof_1" } as Record<string, unknown> | null,
    affiliate: {
      id: "aff_1",
      pending_payout: 0,
      commission_rate: 0.1,
      status: "active",
    } as Record<string, unknown> | null,
  };
  const calls = {
    profileUpdates: [] as Array<{
      payload: unknown;
      filters: Array<[string, unknown]>;
    }>,
    paymentInserts: [] as Array<Record<string, unknown>>,
    affiliateSelects: 0,
    affiliateUpdates: [] as Array<{
      payload: unknown;
      filters: Array<[string, unknown]>;
    }>,
    eventInserts: [] as Array<Record<string, unknown>>,
  };

  // Minimal thenable query builder: select chains end in a terminal
  // (maybeSingle/single), update chains resolve via .then so both single-eq
  // and double-eq chains record exactly once with full filters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function builderFor(table: string): any {
    const filters: Array<[string, unknown]> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updatePayload: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      update: (payload: unknown) => {
        updatePayload = payload;
        return builder;
      },
      insert: (row: Record<string, unknown>) => {
        if (table === "stripe_events") {
          calls.eventInserts.push(row);
          return {
            select: () => Promise.resolve({ data: [row], error: null }),
          };
        }
        if (table === "payment_history") calls.paymentInserts.push(row);
        return Promise.resolve({ error: null });
      },
      maybeSingle: async () => {
        if (table === "stripe_events")
          return { data: db.seenEvent, error: null };
        if (table === "affiliates") {
          calls.affiliateSelects += 1;
          return { data: db.affiliate, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === "profiles") return { data: db.profile, error: null };
        return { data: null, error: null };
      },
      then: (
        resolve: (v: { error: null }) => unknown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reject?: (e: any) => unknown
      ) => {
        if (updatePayload !== null) {
          if (table === "affiliates")
            calls.affiliateUpdates.push({
              payload: updatePayload,
              filters: [...filters],
            });
          else if (table === "profiles")
            calls.profileUpdates.push({
              payload: updatePayload,
              filters: [...filters],
            });
        }
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  const fakeClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string): any => builderFor(table),
  };

  return {
    mockAfterCalls,
    mockRetrieve,
    mockAnchorSale,
    mockAnchorReversal,
    mockConstructEvent,
    db,
    calls,
    fakeClient,
  };
});

// ─── Module mocks (mirror server/webhooks/stripe.test.ts patterns) ───────────

vi.mock("next/server", () => ({
  NextResponse: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      json: async () => body,
    }),
  },
  after: (cb: () => unknown) => {
    mockAfterCalls.push(cb);
  },
  NextRequest: class MockNextRequest {
    private _body: string;
    headers = {
      get: (k: string) => (k === "stripe-signature" ? "sig_test" : null),
    };
    constructor(body?: string) {
      this._body = body ?? "{}";
    }
    async text() {
      return this._body;
    }
  },
}));

vi.mock("stripe", () => ({
  default: class MockStripe {
    subscriptions = { retrieve: mockRetrieve };
    checkout = { sessions: { list: vi.fn().mockResolvedValue({ data: [] }) } };
    constructor(..._args: unknown[]) {}
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (..._args: unknown[]) => fakeClient,
}));

vi.mock("@/lib/stripe-construct-event", () => ({
  constructStripeEventAsync: (...args: unknown[]) =>
    mockConstructEvent(...args),
}));

vi.mock("@/lib/ledger-service", () => ({
  anchorStripeSale: mockAnchorSale,
  anchorStripeReversal: mockAnchorReversal,
  resolveSku: () => "farm_monthly",
  resolveBuyerWallet: () => null,
}));

vi.mock("@/lib/provisioning", () => ({ provisionPurchase: vi.fn() }));
vi.mock("@/lib/billing-emails", () => ({
  renderBillingEmail: () => ({
    from: "billing@authichain.com",
    subject: "s",
    html: "<p>x</p>",
    text: "x",
  }),
}));
vi.mock("@/lib/brand-billing", () => ({
  getBrandIdFromMetadata: () => "authichain",
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/dpp-loop", () => ({
  recordDppLoopEvent: vi.fn().mockResolvedValue(undefined),
  isDppOffer: () => false,
  dppActivateUrl: () => "https://authichain.com/dpp/activate",
}));
vi.mock("@/lib/dpp-fulfill-checkout", () => ({
  fulfillDppPaidSession: vi
    .fn()
    .mockResolvedValue({ handled: false, profileId: null }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invoiceEvent(
  billingReason: string,
  ids: { event: string; invoice: string }
): any {
  return {
    id: ids.event,
    type: "invoice.paid",
    livemode: true,
    data: {
      object: {
        id: ids.invoice,
        customer: "cus_123",
        subscription: "sub_123",
        amount_paid: 14900,
        currency: "usd",
        status: "paid",
        billing_reason: billingReason,
        metadata: {},
        lines: {
          data: [{ price: { id: "price_farm_monthly" }, metadata: {} }],
        },
        created: 1789786400,
      },
    },
  };
}

async function flushAfter() {
  const pending = mockAfterCalls.splice(0);
  await Promise.allSettled(pending.map(cb => cb()));
}

function postInvoice(event: unknown) {
  mockConstructEvent.mockResolvedValue(event);
  // Request shape matches the next/server mock above.

  const req = {
    text: async () => "{}",
    headers: { get: () => "sig_test" },
  } as unknown as NextRequest;
  return POST(req) as unknown as Promise<{
    status: number;
    body: Record<string, unknown>;
  }>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/stripe/webhook invoice.paid branching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAfterCalls.length = 0;
    calls.profileUpdates.length = 0;
    calls.paymentInserts.length = 0;
    calls.affiliateSelects = 0;
    calls.affiliateUpdates.length = 0;
    calls.eventInserts.length = 0;
    db.seenEvent = null;
    db.profile = { id: "prof_1" };
    db.affiliate = {
      id: "aff_1",
      pending_payout: 0,
      commission_rate: 0.1,
      status: "active",
    };
    // Even the first invoice carries a subscribing affiliate — the
    // subscription_create path must still not credit it.
    mockRetrieve.mockResolvedValue({
      id: "sub_123",
      metadata: { affiliate_code: "AFF-TEST" },
    });
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";
  });

  it("subscription_create: no affiliate credit, no ledger anchor", async () => {
    const res = await postInvoice(
      invoiceEvent("subscription_create", {
        event: "evt_inv_create_001",
        invoice: "in_create_001",
      })
    );
    await flushAfter();

    expect(res.body).toMatchObject({ received: true });
    // Profile + payment history still record — only money side-effects skip.
    expect(calls.paymentInserts).toHaveLength(1);
    expect(calls.paymentInserts[0]).toMatchObject({
      stripe_invoice_id: "in_create_001",
      stripe_subscription_id: "sub_123",
    });
    // First payment is handled by checkout.session.completed: no re-credit.
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(calls.affiliateUpdates).toHaveLength(0);
    // First invoice is anchored under the checkout session id, not here.
    expect(mockAnchorSale).not.toHaveBeenCalled();
  });

  it("subscription_cycle: affiliate credit AND ledger anchor", async () => {
    const res = await postInvoice(
      invoiceEvent("subscription_cycle", {
        event: "evt_inv_cycle_001",
        invoice: "in_cycle_001",
      })
    );
    await flushAfter();

    expect(res.body).toMatchObject({ received: true });
    expect(mockRetrieve).toHaveBeenCalledWith("sub_123");
    // $149.00 x 10% = $14.90 onto the active affiliate.
    expect(calls.affiliateSelects).toBe(1);
    expect(calls.affiliateUpdates).toHaveLength(1);
    expect(calls.affiliateUpdates[0].payload).toMatchObject({
      pending_payout: 14.9,
    });
    // Renewal anchored under the invoice id.
    expect(mockAnchorSale).toHaveBeenCalledTimes(1);
    expect(mockAnchorSale).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_inv_cycle_001",
        objectId: "in_cycle_001",
        amountCents: 14900,
        invoiceId: "in_cycle_001",
      })
    );
  });
});
