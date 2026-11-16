import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  event: null as unknown,
  verifyError: null as Error | null,
}));

vi.mock("stripe", () => ({
  default: class {
    webhooks = {
      constructEventAsync: async () => {
        if (state.verifyError) throw state.verifyError;
        return state.event;
      },
    };
  },
}));

import worker from "./index";
import {
  CATALOG_GRANT_RPC,
  applyCatalogGrantState,
  grantReceiptKey,
} from "../../../src/lib/provisioning";

const env = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

const STARTER = "price_1UIoEVGqTruSqV8T61lp48wB";
const CREATOR = "price_1UIoEYGqTruSqV8TCXTNipvh";
const DPP = "price_1TwmD8GqTruSqV8TpAF8dfyA";
const LAUNCH_ANNUAL = "price_1USNoSGqTruSqV8ThTIW7Ej8";

function sessionEvent(opts: {
  id?: string;
  price: string;
  email?: string | null;
  prior?: string | null;
  type?: string;
  paymentStatus?: string;
}) {
  return {
    id: "evt_1",
    type: opts.type ?? "checkout.session.completed",
    data: {
      object: {
        id: opts.id ?? "cs_1",
        payment_status: opts.paymentStatus ?? "paid",
        customer: "cus_1",
        customer_details: {
          email: opts.email === undefined ? "buyer@example.com" : opts.email,
          name: "Buyer",
        },
        metadata: { stripe_price_id: opts.price },
      },
    },
  };
}

function installFetch(opts?: {
  selectStatus?: number;
  prior?: string | null;
  grantLimit?: number;
  grantUsed?: number;
  receipts?: string[];
  upsertOk?: boolean;
  rpcStatus?: number;
  ambiguousProfile?: boolean;
  receiptProfile?: string | null;
  rpcProfileOverride?: string | null;
}) {
  const calls: Array<{
    method: string;
    url: string;
    body?: unknown;
    prefer?: string | null;
  }> & {
    profile: Record<string, unknown>;
    receipts: Set<string>;
  } = Object.assign([], {
    profile: {
      id: "prof_1",
      last_grant_session_id: opts?.prior === undefined ? null : opts.prior,
      generations_limit: opts?.grantLimit ?? 0,
      generations_used: opts?.grantUsed ?? 0,
    },
    receipts: new Set(
      (opts?.receipts ?? []).map(id =>
        id.startsWith("grant:") ? id : grantReceiptKey(id)
      )
    ),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers);
      const prefer = headers.get("Prefer");
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body, prefer });
      if (url.includes(`/rpc/${CATALOG_GRANT_RPC}`)) {
        if ((opts?.rpcStatus ?? 200) >= 400) {
          return new Response("no", { status: opts?.rpcStatus ?? 500 });
        }
        const args = (body ?? {}) as Record<string, unknown>;
        const result = applyCatalogGrantState(
          {
            receipts: calls.receipts,
            receiptProfiles: opts?.receiptProfile
              ? Object.fromEntries(
                  [...calls.receipts].map(key => [key, opts.receiptProfile!])
                )
              : undefined,
            row: calls.profile,
          },
          {
            profileId: String(args.p_profile_id),
            sessionId: String(args.p_session_id),
            plan: String(args.p_plan),
            brand: String(args.p_brand),
            generations: Number(args.p_generations),
            stack: Boolean(args.p_stack),
            stripeCustomerId:
              (args.p_stripe_customer_id as string | null) ?? null,
            stripeSubscriptionId:
              (args.p_stripe_subscription_id as string | null) ?? null,
            isTrial: Boolean(args.p_is_trial),
          }
        );
        if (result.status === "conflict") {
          return new Response("catalog_grant_receipt_conflict", {
            status: 400,
          });
        }
        return new Response(
          JSON.stringify({
            status: result.status,
            profile_id:
              opts?.rpcProfileOverride !== undefined
                ? opts.rpcProfileOverride
                : result.profileId,
            generations_limit: calls.profile.generations_limit,
            generations_used: calls.profile.generations_used,
            last_grant_session_id: calls.profile.last_grant_session_id,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (method === "GET") {
        if ((opts?.selectStatus ?? 200) >= 400) {
          return new Response("no", {
            status: opts?.selectStatus ?? 500,
          });
        }
        const row =
          opts?.prior === undefined
            ? []
            : opts.ambiguousProfile
              ? [calls.profile, { ...calls.profile, id: "prof_2" }]
              : [calls.profile];
        return new Response(JSON.stringify(row), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (method === "POST" && opts?.upsertOk === false) {
        return new Response("no", { status: 500 });
      }
      return new Response("{}", { status: 200 });
    })
  );
  return calls;
}

function signedPost() {
  return new Request("https://worker.test/stripe", {
    method: "POST",
    body: "{}",
    headers: { "stripe-signature": "t=1,v1=ok" },
  });
}

function patches(calls: Array<{ method: string; body?: unknown }>) {
  return calls.filter(c => c.method === "PATCH").map(c => c.body);
}

function grantRpcs(
  calls: Array<{ method: string; url: string; body?: unknown }>
) {
  return calls.filter(
    c =>
      c.method === "POST" && String(c.url).includes(`/rpc/${CATALOG_GRANT_RPC}`)
  );
}

describe("stripe-webhook checkout grant", () => {
  beforeEach(() => {
    state.event = null;
    state.verifyError = null;
    vi.unstubAllGlobals();
  });

  it("rejects a missing signature", async () => {
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", { method: "POST", body: "{}" }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid signature", async () => {
    state.verifyError = new Error(
      "No signatures found matching the expected signature"
    );
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=bad" },
      }),
      env
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/No signatures found/);
  });

  it("does not grant when the checkout has no email", async () => {
    state.event = sessionEvent({ price: STARTER, email: null });
    const calls = installFetch();
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(res.status).toBe(200);
    expect(calls.filter(c => c.url.includes("/profiles"))).toEqual([]);
    expect(patches(calls)).toEqual([]);
  });

  it("writes one starter grant and skips the replay", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_new" });
    const first = installFetch({ prior: null });
    const created = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(created.status).toBe(200);
    expect(grantRpcs(first)).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({
          p_session_id: "cs_new",
          p_plan: "starter",
          p_generations: 100,
          p_stack: true,
        }),
      }),
    ]);
    expect(first.profile.generations_limit).toBe(100);
    expect(first.receipts.has(grantReceiptKey("cs_new"))).toBe(true);
    expect(patches(first)).toEqual([]);

    state.event = sessionEvent({ price: STARTER, id: "cs_new" });
    const second = installFetch({ prior: "cs_new", grantLimit: 100 });
    const replay = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(replay.status).toBe(200);
    expect(second.profile.generations_limit).toBe(100);
    expect(patches(second)).toEqual([]);
  });

  it("answers 500 when the prior-session lookup fails", async () => {
    state.event = sessionEvent({ price: STARTER });
    const calls = installFetch({ selectStatus: 500 });
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(res.status).toBe(500);
    expect(patches(calls)).toEqual([]);
    expect(await res.json()).toEqual({ error: "grant lookup failed" });
  });

  it("DPP release retries until the canonical 50-credit grant is persisted", async () => {
    state.event = sessionEvent({ price: DPP, id: "cs_dpp" });
    const calls = installFetch({ prior: null });
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "canonical DPP entitlement pending",
    });
    expect(patches(calls)).toEqual([]);
  });

  it("DPP release acknowledges a verified canonical grant without double-granting", async () => {
    state.event = sessionEvent({ price: DPP, id: "cs_dpp" });
    const calls = installFetch({ prior: "cs_dpp", grantLimit: 50 });
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(res.status).toBe(200);
    expect(patches(calls)).toEqual([]);
    expect(calls.some(c => c.method === "GET")).toBe(true);
  });

  it("DPP does not acknowledge a paid session without a buyer email", async () => {
    state.event = sessionEvent({ price: DPP, id: "cs_dpp", email: null });
    const calls = installFetch();
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "canonical DPP buyer identity missing",
    });
    expect(calls.filter(c => c.url.includes("/profiles"))).toHaveLength(0);
  });

  it("DPP does not acknowledge a matching session with no credits", async () => {
    state.event = sessionEvent({ price: DPP, id: "cs_dpp" });
    const calls = installFetch({ prior: "cs_dpp", grantLimit: 0 });
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(res.status).toBe(500);
    expect(patches(calls)).toEqual([]);
  });

  it("fails closed for a one-time Starter pack with no_payment_required", async () => {
    state.event = sessionEvent({
      price: STARTER, id: "cs_unsettled_starter",
      paymentStatus: "no_payment_required",
    });
    const calls = installFetch();
    const response = await worker.fetch(signedPost(), env);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "paid pack settlement not confirmed",
    });
    expect(calls.some(c => c.url.includes(`/rpc/${CATALOG_GRANT_RPC}`))).toBe(false);
    expect(calls.some(c => c.url.includes("/profiles"))).toBe(false);
  });

  it("fails closed for a Creator checkout missing payment_status", async () => {
    state.event = sessionEvent({ price: CREATOR, id: "cs_missing_payment" });
    const evt = state.event as { data: { object: { payment_status?: string } } };
    delete evt.data.object.payment_status;
    const calls = installFetch();
    const response = await worker.fetch(signedPost(), env);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "paid pack settlement not confirmed",
    });
    expect(calls.some(c => c.url.includes(`/rpc/${CATALOG_GRANT_RPC}`))).toBe(false);
    expect(calls.some(c => c.url.includes("/profiles"))).toBe(false);
  });

  it("does not grant a checkout session that is still unpaid", async () => {
    state.event = sessionEvent({
      price: LAUNCH_ANNUAL,
      id: "cs_unpaid",
      paymentStatus: "unpaid",
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation(msg => {
      logs.push(String(msg));
    });
    const calls = installFetch({ prior: null });
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(calls.filter(c => c.url.includes("/profiles"))).toEqual([]);
    expect(patches(calls)).toEqual([]);
    const events = logs.map(line => JSON.parse(line) as { evt: string });
    expect(events).toEqual([
      expect.objectContaining({
        evt: "stripe_grant_held_unpaid",
        session: "cs_unpaid",
        type: "checkout.session.completed",
      }),
    ]);
    expect(events.some(e => e.evt === "checkout_paid_qron_annual")).toBe(false);
  });

  it("grants Launch Annual and logs the paid event once the money arrives", async () => {
    state.event = sessionEvent({
      price: LAUNCH_ANNUAL,
      id: "cs_annual",
      type: "checkout.session.async_payment_succeeded",
      paymentStatus: "paid",
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation(msg => {
      logs.push(String(msg));
    });
    const calls = installFetch({ prior: null });
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(grantRpcs(calls)[0]?.body).toMatchObject({
      p_plan: "qron_launch_annual",
      p_generations: 1200,
      p_stack: false,
      p_session_id: "cs_annual",
    });
    expect(calls.profile.generations_limit).toBe(1200);
    const paid = logs
      .map(line => JSON.parse(line) as { evt: string })
      .filter(e => e.evt === "checkout_paid_qron_annual");
    expect(paid).toEqual([
      expect.objectContaining({
        evt: "checkout_paid_qron_annual",
        plan_id: "qron_launch_annual",
        session_id: "cs_annual",
        amount_usd: 190,
        generations: 1200,
        brand: "qron",
      }),
    ]);
  });

  it("does not add again when an older session is replayed after a newer purchase", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_old" });
    const calls = installFetch({
      prior: "cs_new",
      grantLimit: 200,
      grantUsed: 0,
      receipts: ["cs_old"],
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(calls.profile.generations_limit).toBe(200);
    expect(grantRpcs(calls)).toHaveLength(1);
    expect(patches(calls)).toEqual([]);
  });

  it("grant A, grant B, replay A does not add A again (CFA-869 F869-1)", async () => {
    const db = installFetch({
      prior: null,
      grantLimit: 0,
      grantUsed: 0,
    });
    state.event = sessionEvent({ price: STARTER, id: "cs_a" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(100);
    expect(db.receipts.has(grantReceiptKey("cs_a"))).toBe(true);

    state.event = sessionEvent({ price: STARTER, id: "cs_b" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(200);
    expect(db.profile.last_grant_session_id).toBe("cs_b");
    const writes = grantRpcs(db).length;

    state.event = sessionEvent({ price: STARTER, id: "cs_a" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(200);
    expect(grantRpcs(db)).toHaveLength(writes + 1);
  });

  it("adds a second Starter pack on top of unused credits", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_repeat" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      grantUsed: 40,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(grantRpcs(calls)[0]?.body).toMatchObject({
      p_plan: "starter",
      p_generations: 100,
      p_stack: true,
      p_session_id: "cs_repeat",
    });
    expect(calls.profile.generations_limit).toBe(160);
    expect(patches(calls)).toEqual([]);
  });

  it("does not double-grant when the same Starter event is replayed", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_repeat" });
    const calls = installFetch({
      prior: "cs_repeat",
      grantLimit: 160,
      grantUsed: 0,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(patches(calls)).toEqual([]);
  });

  it("adds a Creator pack on leftover Starter credits", async () => {
    state.event = sessionEvent({ price: CREATOR, id: "cs_creator" });
    const calls = installFetch({
      prior: "cs_starter",
      grantLimit: 100,
      grantUsed: 40,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(grantRpcs(calls)[0]?.body).toMatchObject({
      p_plan: "creator",
      p_generations: 500,
      p_stack: true,
    });
    expect(calls.profile.generations_limit).toBe(560);
  });

  it("still sets a Launch Annual period grant instead of stacking", async () => {
    state.event = sessionEvent({ price: LAUNCH_ANNUAL, id: "cs_annual" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      grantUsed: 40,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(grantRpcs(calls)[0]?.body).toMatchObject({
      p_plan: "qron_launch_annual",
      p_generations: 1200,
      p_stack: false,
    });
    expect(calls.profile.generations_limit).toBe(1200);
    expect(patches(calls)).toEqual([]);
  });

  it("fails closed when two profiles match the buyer email", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_amb" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      ambiguousProfile: true,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "grant lookup failed" });
    expect(grantRpcs(calls)).toEqual([]);
    expect(calls.profile.generations_limit).toBe(100);
  });

  it("fails closed when the catalog RPC is missing (migration not applied)", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_rpc" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      grantUsed: 40,
      rpcStatus: 404,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "catalog grant RPC unavailable",
    });
    expect(calls.profile.generations_limit).toBe(100);
  });

  it("fails closed when the catalog RPC returns 500, without changing credits", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_rpc" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      grantUsed: 40,
      rpcStatus: 500,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "grant write failed",
    });
    expect(calls.profile.generations_limit).toBe(100);
    expect(calls.receipts.has(grantReceiptKey("cs_rpc"))).toBe(false);
  });

  it("rejects atomic RPC replay evidence for another profile", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_wrong_profile" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      receipts: ["cs_wrong_profile"],
      rpcProfileOverride: "prof_other",
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "catalog_grant_receipt_conflict",
    });
    expect(grantRpcs(calls)).toHaveLength(1);
    expect(calls.profile.generations_limit).toBe(100);
  });

  it("rejects already_granted evidence that omits the receipt profile", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_unmapped" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      receipts: ["cs_unmapped"],
      rpcProfileOverride: null,
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "catalog_grant_receipt_conflict",
    });
    expect(calls.profile.generations_limit).toBe(100);
  });

  it("fails closed when the session receipt belongs to another profile", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_taken" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      grantUsed: 0,
      receipts: ["cs_taken"],
      receiptProfile: "prof_other",
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "catalog_grant_receipt_conflict",
    });
    expect(calls.profile.generations_limit).toBe(100);
  });

  it("treats a uniqueness conflict as already granted", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_race" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 160,
      grantUsed: 0,
      receipts: ["cs_race"],
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(calls.profile.generations_limit).toBe(160);
    expect(grantRpcs(calls)).toHaveLength(1);
  });

  it("does not log a second Launch Annual sale when the paid session replays", async () => {
    state.event = sessionEvent({
      price: LAUNCH_ANNUAL,
      id: "cs_annual",
      paymentStatus: "paid",
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation(msg => {
      logs.push(String(msg));
    });
    const calls = installFetch({ prior: "cs_annual" });
    const res = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(patches(calls)).toEqual([]);
    expect(
      logs
        .map(line => JSON.parse(line) as { evt: string })
        .some(e => e.evt === "checkout_paid_qron_annual")
    ).toBe(false);
  });
});
