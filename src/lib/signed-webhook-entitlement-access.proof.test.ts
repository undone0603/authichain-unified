/**
 * NON-PRODUCTION component proof:
 * real Stripe HMAC -> verified event -> real provisioning -> stateful fake
 * profiles storage -> real generation credit read/spend.
 *
 * NOT proof of a deployed Cloudflare revision or a real paying customer.
 * No Stripe API calls, network requests, or Supabase production writes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { constructStripeEventAsync } from "./stripe-construct-event";
import { provisionPurchase } from "./provisioning";
import { checkCredit, deductCredit } from "./business-tier";

const memory = vi.hoisted(() => {
  type Profile = Record<string, unknown> & { id: string };
  const rows = new Map<string, Profile>();
  let nextId = 0;
  let writes = 0;
  const client = {
    from(table: string) {
      if (table !== "profiles") throw new Error("Unexpected table: " + table);
      const filters: Array<{ column: string; value: unknown; isNull: boolean }> = [];
      let patch: Record<string, unknown> | null = null;
      const matches = () => [...rows.values()].filter(row =>
        filters.every(f => f.isNull ? row[f.column] == null : row[f.column] === f.value)
      );
      // The fake commits updates into the same Map used by checkCredit().
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = {
        select() { return query; },
        eq(column: string, value: unknown) {
          filters.push({ column, value, isNull: false });
          return query;
        },
        is(column: string, value: unknown) {
          filters.push({ column, value, isNull: true });
          return query;
        },
        // PostgREST returns detached JSON rows. Returning a direct Map reference
        // would let a later update mutate the earlier read and falsely deduct
        // credits twice in the result calculation (100 -> 98 after one spend).
        async maybeSingle() {
          const row = matches()[0];
          return { data: row ? { ...row } : null, error: null };
        },
        async single() {
          const row = matches()[0];
          return { data: row ? { ...row } : null, error: null };
        },
        insert(row: Record<string, unknown>) {
          const id = "test_profile_" + ++nextId;
          rows.set(id, {
            ...row, id, generations_limit: 0, generations_used: 0,
            last_grant_session_id: null,
          });
          writes += 1;
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id }, error: null }),
            }),
          };
        },
        update(row: Record<string, unknown>) { patch = row; return query; },
        then(resolve: (value: { data: Array<{ id: string }>; error: null }) => unknown,
             reject?: (reason: unknown) => unknown) {
          const matched = matches();
          if (patch) for (const row of matched) {
            Object.assign(row, patch);
            writes += 1;
          }
          return Promise.resolve({
            data: matched.map(row => ({ id: row.id })),
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return {
    rows, client,
    reset: () => { rows.clear(); nextId = 0; writes = 0; },
    get writes() { return writes; },
  };
});

// The real credit reader is retained; only its Supabase connector is faked.
vi.mock("@supabase/supabase-js", () => ({ createClient: () => memory.client }));

// Exercise the canonical handleStripeWebhook implementation with the real Stripe
// SDK while isolating all external side effects. The production handler is NOT
// replaced or mocked; the internal database/event-claim transport is.
const handlerEvidence = vi.hoisted(() => ({
  claims: new Set<string>(),
  deliveries: [] as Array<{ status: string; eventId: string }>,
}));

vi.mock("../../server/db", () => ({
  getHyperdriveDb: vi.fn().mockReturnValue({}),
  hasWebhookEventProcessed: vi.fn().mockResolvedValue(false),
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAutomationAudit: vi.fn().mockResolvedValue(undefined),
  recordRevenue: vi.fn().mockResolvedValue(undefined),
  upsertStripeSubscription: vi.fn().mockResolvedValue(undefined),
  setSubscriptionStatusByStripeId: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeSubscriptionId: vi.fn().mockResolvedValue(null),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));
// The Hono router has these unrelated integrations at import time. Stub
// them without replacing the canonical Stripe handler under test.
vi.mock("../../server/paddle/webhook", () => ({
  handlePaddleWebhook: vi.fn(),
}));
vi.mock("../../server/webhooks/instantly", () => ({
  handleInstantlyWebhook: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../../server/webhooks/docusign", () => ({
  handleDocuSignWebhook: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../../server/_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn() },
}));
vi.mock("../../server/_core/db-helpers", () => ({
  getOpsSummary: vi.fn().mockResolvedValue({ ok: true }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../server/stripe-products", () => ({
  getPlanQuota: () => 100,
  STRIPE_PRODUCTS: {
    starter: { name: "Starter", features: [] },
  },
}));
vi.mock("../../server/email-service", () => ({
  sendEmail: vi.fn().mockResolvedValue({ status: "suppressed" }),
}));
vi.mock("../../server/services/order-payment-handler", () => ({
  handleServiceOrderPayment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./affiliate-accrual", () => ({
  accrueAffiliateCommission: vi.fn().mockResolvedValue({ credited: false }),
}));
vi.mock("./dpp-fulfill-checkout", () => ({
  fulfillDppPaidSession: vi.fn().mockResolvedValue({ handled: false }),
}));
vi.mock("./stripe-webhook-claim", () => ({
  StripeEventClaimUnavailableError: class extends Error {
    name = "StripeEventClaimUnavailableError";
  },
  claimStripeEvent: vi.fn(async (_client: unknown, eventId: string) => {
    if (handlerEvidence.claims.has(eventId)) return "duplicate";
    handlerEvidence.claims.add(eventId);
    return "claimed";
  }),
}));
vi.mock("./stripe-webhook-log", () => ({
  recordStripeWebhookDelivery: vi.fn(async (
    _client: unknown, entry: { eventId: string; status: string }
  ) => {
    handlerEvidence.deliveries.push({
      eventId: entry.eventId, status: entry.status,
    });
    return { ok: true };
  }),
  checkoutSessionIdFromEvent: (event: {
    type: string; data?: { object?: { id?: string } }
  }) => event.type.startsWith("checkout.session.")
    ? event.data?.object?.id ?? null : null,
}));

const API_VERSION = "2026-08-26.dahlia" as const;
const SECRET = "whsec_test_component_proof_only";
const stripe = new Stripe("sk_test_component_proof_only", {
  apiVersion: API_VERSION,
});

function fixture(sessionId: string) {
  const body = JSON.stringify({
    id: "evt_e2e_" + sessionId, object: "event",
    type: "checkout.session.completed", api_version: API_VERSION,
    created: Math.floor(Date.now() / 1000), livemode: false,
    data: { object: {
      id: sessionId, object: "checkout.session", mode: "payment",
      livemode: false, payment_status: "paid", currency: "usd",
      amount_total: 2900, customer_email: "test-buyer@example.test",
      metadata: { plan: "starter" },
    }},
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: body, secret: SECRET,
  });
  return { body, signature };
}

async function verifyAndGrant(body: string, signature: string) {
  // Integration of real components, not a substitute for the actual Worker route.
  const event = await constructStripeEventAsync(
    stripe, body, signature, [SECRET]
  );
  if (event.livemode !== false) throw new Error("test-mode fixture required");
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" || session.amount_total !== 2900 ||
      session.currency !== "usd" || session.mode !== "payment")
    throw new Error("not a valid Starter fixture");
  return provisionPurchase(memory.client, {
    email: session.customer_email, plan: "starter",
    brand: "authichain", sessionId: session.id,
  });
}

describe("signed webhook components -> stored entitlement -> customer access", () => {
  beforeEach(() => memory.reset());

  it("verifies real HMAC, persists 100 credits and allows an authorized spend", async () => {
    const { body, signature } = fixture("cs_test_persisted_access");
    const grant = await verifyAndGrant(body, signature);
    expect(grant.status).toBe("provisioned");
    expect(grant.profileId).toBeTruthy();
    expect(memory.rows.get(grant.profileId!)).toMatchObject({
      last_grant_session_id: "cs_test_persisted_access",
      generations_limit: 100, generations_used: 0,
    });
    expect(await checkCredit(grant.profileId!)).toMatchObject({
      ok: true, remaining: 100,
    });
    expect(await deductCredit(grant.profileId!)).toMatchObject({
      ok: true, remaining: 99,
    });
    expect(memory.rows.get(grant.profileId!)?.generations_used).toBe(1);
  });

  it("rejects a tampered signature before any customer or credit write", async () => {
    const { body, signature } = fixture("cs_test_tampered");
    await expect(verifyAndGrant(body.replace("2900", "2901"), signature))
      .rejects.toThrow();
    expect(memory.rows.size).toBe(0);
    expect(memory.writes).toBe(0);
  });

  it("replaying a signed session does not grant twice", async () => {
    const { body, signature } = fixture("cs_test_idempotent");
    const first = await verifyAndGrant(body, signature);
    expect(first.status).toBe("provisioned");
    const writesBefore = memory.writes;
    const second = await verifyAndGrant(body, signature);
    expect(second).toMatchObject({
      status: "provisioned", skippedIdempotent: true,
      profileId: first.profileId,
    });
    expect(memory.writes).toBe(writesBefore);
    expect(memory.rows.get(first.profileId!)?.generations_limit).toBe(100);
  });

  it("rejects a zero-dollar paid-status fixture without a credit grant", async () => {
    const { body } = fixture("cs_test_zero");
    const zero = body.replace('"amount_total":2900', '"amount_total":0');
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: zero, secret: SECRET,
    });
    await expect(verifyAndGrant(zero, signature))
      .rejects.toThrow(/valid Starter/);
    expect(memory.rows.size).toBe(0);
  });
});

describe("canonical Stripe webhook handler: real HMAC and stateful test store", () => {
  beforeEach(() => {
    memory.reset();
    handlerEvidence.claims.clear();
    handlerEvidence.deliveries.length = 0;
    process.env.STRIPE_SECRET_KEY = "sk_test_component_proof_only";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-only.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-do-not-use";
  });

  it("processes a signed non-evt_test Checkout, stores grant and permits spending", async () => {
    const { handleStripeWebhook } = await import("../../server/webhooks/stripe");
    const { body, signature } = fixture("cs_test_handler_checkout");
    const result = await handleStripeWebhook(Buffer.from(body), signature);
    expect(result).toMatchObject({
      received: true, type: "checkout.session.completed", handled: true,
    });
    expect(handlerEvidence.deliveries.some(x => x.status === "success")).toBe(true);
    expect(memory.rows.size).toBe(1);
    const profile = [...memory.rows.values()][0];
    expect(profile).toMatchObject({
      last_grant_session_id: "cs_test_handler_checkout",
      generations_limit: 100,
      generations_used: 0,
    });
    expect(await checkCredit(profile.id)).toMatchObject({
      ok: true, remaining: 100,
    });
    expect(await deductCredit(profile.id)).toMatchObject({
      ok: true, remaining: 99,
    });
    const replay = await handleStripeWebhook(Buffer.from(body), signature);
    expect(replay.duplicate).toBe(true);
    expect(memory.rows.get(profile.id)?.generations_limit).toBe(100);
    expect(memory.rows.get(profile.id)?.generations_used).toBe(1);
  });

  it("the handler rejects a tampered signed event before creating a profile", async () => {
    const { handleStripeWebhook } = await import("../../server/webhooks/stripe");
    const { body, signature } = fixture("cs_test_handler_tamper");
    await expect(
      handleStripeWebhook(Buffer.from(body.replace("2900", "2901")), signature)
    ).rejects.toThrow();
    expect(memory.rows.size).toBe(0);
    expect(handlerEvidence.claims.size).toBe(0);
  });

  // Blocked on held economic PR #2149: the current handler accepts metadata.plan
  // despite amount_total=0. Do not claim this negative test or release green.
  it.todo("refuses a signed $0 paid-status Starter checkout before any grant");
});

describe("Cloudflare Hono webhook HTTP route (in-process, no deployment)", () => {
  beforeEach(() => {
    memory.reset();
    handlerEvidence.claims.clear();
    handlerEvidence.deliveries.length = 0;
    process.env.STRIPE_SECRET_KEY = "sk_test_component_proof_only";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    delete process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-only.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-do-not-use";
  });

  it("POST verifies a real HMAC header, grants credits, and authorizes access", async () => {
    const { app } = await import("../../worker-app/index");
    const { body, signature } = fixture("cs_test_http_route");
    const res = await app.request(
      "https://authichain.com/api/stripe/webhook",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body,
      },
      {
        STRIPE_SECRET_KEY: "sk_test_component_proof_only",
        STRIPE_WEBHOOK_SECRET: SECRET,
        NEXT_PUBLIC_SUPABASE_URL: "https://test-only.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "test-only-do-not-use",
      } as never
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      received: true, type: "checkout.session.completed",
    });
    expect(memory.rows.size).toBe(1);
    const profile = [...memory.rows.values()][0];
    expect(profile.last_grant_session_id).toBe("cs_test_http_route");
    expect(await checkCredit(profile.id)).toMatchObject({
      ok: true, remaining: 100,
    });
  });

  it("POST rejects an altered payload before any grant", async () => {
    const { app } = await import("../../worker-app/index");
    const { body, signature } = fixture("cs_test_http_tamper");
    const res = await app.request(
      "https://authichain.com/api/stripe/webhook",
      {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: body.replace("2900", "2901"),
      },
      {
        STRIPE_SECRET_KEY: "sk_test_component_proof_only",
        STRIPE_WEBHOOK_SECRET: SECRET,
        NEXT_PUBLIC_SUPABASE_URL: "https://test-only.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "test-only-do-not-use",
      } as never
    );
    expect(res.status).toBe(400);
    expect(memory.rows.size).toBe(0);
  });
});
