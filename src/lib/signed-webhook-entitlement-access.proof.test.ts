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
        async maybeSingle() { return { data: matches()[0] ?? null, error: null }; },
        async single() { return { data: matches()[0] ?? null, error: null }; },
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

const API_VERSION = "2026-08-26.dahlia" as const;
const SECRET = "whsec_test_component_proof_only";
const stripe = new Stripe("sk_test_component_proof_only", {
  apiVersion: API_VERSION,
});

function fixture(sessionId: string) {
  const body = JSON.stringify({
    id: "evt_test_" + sessionId, object: "event",
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
