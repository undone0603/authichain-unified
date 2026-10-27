/**
 * "Training" for the Stripe webhook: TEST-MODE checkout.session.completed
 * payloads signed with a dummy test secret (whsec_test_training_dummy, not a
 * real key) and verified by the real Stripe SDK through
 * constructStripeEventAsync. No live keys, no network, no charges.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { provisionPurchase } from "@/lib/provisioning";

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
    rpcCalls: [] as Array<{ fn: string; args: unknown }>,
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
          // Primary-key semantics: a second insert of the same event_id conflicts.
          if (calls.eventInserts.some(r => r.event_id === row.event_id)) {
            return Promise.resolve({ error: { code: "23505" } });
          }
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
          return { data: { status: "success", processed_at: null }, error: null };
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
    rpc: async (fn: string, args: unknown) => {
      calls.rpcCalls.push({ fn, args });
      return {
        data: { credited: true, affiliate_id: "aff_1", commission: 14.9 },
        error: null,
      };
    },
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

// Real Stripe SDK for webhooks.constructEventAsync / generateTestHeaderString;
// no API calls are made (subscriptions.retrieve is faked, no network).
vi.mock("stripe", async importOriginal => {
  const Real = ((await importOriginal()) as { default: any }).default;
  class TestStripe extends Real {
    subscriptions = { retrieve: mockRetrieve };
    constructor(...args: any[]) {
      super(...args);
    }
  }
  return { default: TestStripe };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: (..._args: unknown[]) => fakeClient,
}));

// Real signature verification (stripe-construct-event is NOT mocked here).

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


const TEST_SECRET = "whsec_test_training_dummy";
const StripeReal = (await vi.importActual<{ default: any }>("stripe")).default;
const signer = new StripeReal("sk_test_training_dummy");

function signedRequest(event: unknown, secret = TEST_SECRET, tamper = false) {
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret });
  const sent = tamper ? payload.replace("2900", "2901") : payload;
  return {
    text: async () => sent,
    headers: { get: (k: string) => (k === "stripe-signature" ? header : null) },
  } as unknown as NextRequest;
}

function testModeSession(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `evt_test_${id}`,
    object: "event",
    api_version: "2026-08-26.dahlia",
    type: "checkout.session.completed",
    livemode: false,
    created: 1792000000,
    data: {
      object: {
        id: `cs_test_${id}`,
        object: "checkout.session",
        livemode: false,
        mode: "payment",
        amount_total: 2900,
        amount_subtotal: 2900,
        total_details: { amount_discount: 0 },
        currency: "usd",
        customer_email: "buyer@example.com",
        customer_details: { email: "buyer@example.com" },
        payment_status: "paid",
        metadata: {},
        ...overrides,
      },
    },
  };
}

async function run(req: NextRequest) {
  vi.mocked(provisionPurchase).mockResolvedValue({
    profileId: "prof_1",
    created: false,
    status: "provisioned",
  });
  const res = (await POST(req)) as unknown as {
    status: number;
    body: Record<string, unknown>;
  };
  const pending = mockAfterCalls.splice(0);
  await Promise.allSettled(pending.map(cb => cb()));
  const call = vi.mocked(provisionPurchase).mock.calls[0]?.[1] as
    | { plan?: string }
    | undefined;
  return { res, plan: call?.plan, provisioned: !!call };
}

describe("stripe webhook training: signed TEST-MODE events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAfterCalls.length = 0;
    db.seenEvent = null;
    calls.eventInserts.length = 0;
    process.env.STRIPE_SECRET_KEY = "sk_test_training_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
    delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("Starter checkout with metadata.plan resolves starter from metadata (test mode)", async () => {
    const r = await run(
      signedRequest(
        testModeSession("meta_starter", {
          metadata: { plan: "starter", checkout_gate: "confirm_post" },
        })
      )
    );
    expect(r.res.status).toBe(200);
    expect(r.plan).toBe("starter");
  });

  it("metadata wins even when the amount differs (no amount guess)", async () => {
    const r = await run(
      signedRequest(
        testModeSession("meta_other_amount", {
          amount_total: 1234,
          amount_subtotal: 1234,
          metadata: { plan: "starter" },
        })
      )
    );
    expect(r.plan).toBe("starter");
  });

  it("test-mode $29 with no metadata grants no plan (amount fallback is live-only)", async () => {
    const r = await run(signedRequest(testModeSession("no_meta")));
    expect(r.res.status).toBe(200);
    expect(r.plan).toBeUndefined();
  });

  it("rejects a tampered payload with 400 and provisions nothing", async () => {
    const r = await run(
      signedRequest(testModeSession("tamper", { metadata: { plan: "starter" } }), TEST_SECRET, true)
    );
    expect(r.res.status).toBe(400);
    expect(r.provisioned).toBe(false);
  });

  it("rejects a payload signed with a different secret", async () => {
    const r = await run(
      signedRequest(
        testModeSession("wrong_secret", { metadata: { plan: "starter" } }),
        "whsec_test_some_other_dummy"
      )
    );
    expect(r.res.status).toBe(400);
    expect(r.provisioned).toBe(false);
  });

  it("a replayed signed event is a duplicate and provisions only once", async () => {
    const event = testModeSession("replay", { metadata: { plan: "starter" } });
    const first = await run(signedRequest(event));
    expect(first.plan).toBe("starter");
    vi.mocked(provisionPurchase).mockClear();
    const again = await run(signedRequest(event));
    expect(again.res.status).toBe(200);
    expect(again.res.body).toMatchObject({ duplicate: true });
    expect(again.provisioned).toBe(false);
  });
});
