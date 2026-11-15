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
  receiptSelectStatus?: number;
  upsertOk?: boolean;
  updateOk?: boolean;
  receiptInsertOk?: boolean;
  updateRows?: unknown[];
  rpcStatus?: number;
  rpcResultStatus?: "granted" | "already_granted" | "invalid";
}) {
  const calls: Array<{
    method: string;
    url: string;
    body?: unknown;
    prefer?: string | null;
  }> = [];
  const receipts = new Set(opts?.receipts ?? []);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers);
      const prefer = headers.get("Prefer");
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body, prefer });
      if (url.includes("/rpc/grant_stripe_pack_session")) {
        const args = body as { p_profile_id: string; p_session_id: string; p_plan: string };
        if ((opts?.rpcStatus ?? 200) >= 400) return new Response("rpc unavailable", { status: opts?.rpcStatus });
        const repeat = receipts.has(args.p_session_id) || opts?.prior === args.p_session_id;
        receipts.add(args.p_session_id);
        return new Response(JSON.stringify({
          status: opts?.rpcResultStatus ?? (repeat ? "already_granted" : "granted"),
          profile_id: args.p_profile_id, plan: args.p_plan,
          credits: args.p_plan === "creator" ? 500 : 100,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("founder_exit_side_effects")) {
        if (method === "GET") {
          if ((opts?.receiptSelectStatus ?? 200) >= 400) {
            return new Response("no", {
              status: opts?.receiptSelectStatus ?? 500,
            });
          }
          const hit = [...receipts].find(
            id =>
              url.includes(encodeURIComponent(`grant:${id}`)) ||
              url.includes(`grant:${id}`)
          );
          return new Response(
            JSON.stringify(hit ? [{ idempotency_key: `grant:${hit}` }] : []),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (method === "POST" && opts?.receiptInsertOk === false) {
          return new Response("no", { status: 500 });
        }
        if (method === "POST" && body && typeof body === "object") {
          const key = String(
            (body as { idempotency_key?: string }).idempotency_key ?? ""
          );
          if (key.startsWith("grant:"))
            receipts.add(key.slice("grant:".length));
        }
        return new Response("[]", { status: 201 });
      }
      if (method === "GET") {
        if ((opts?.selectStatus ?? 200) >= 400) {
          return new Response("no", { status: opts?.selectStatus ?? 500 });
        }
        const row =
          opts?.prior === undefined
            ? []
            : [
                {
                  id: "prof_1",
                  last_grant_session_id: opts.prior,
                  generations_limit: opts.grantLimit ?? 0,
                  generations_used: opts.grantUsed ?? 0,
                },
              ];
        return new Response(
          JSON.stringify(opts?.prior === undefined ? [] : row),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      if (method === "POST" && opts?.upsertOk === false) {
        return new Response("no", { status: 500 });
      }
      if (method === "PATCH" && opts?.updateOk === false) {
        return new Response("no", { status: 500 });
      }
      if (method === "PATCH" && prefer?.includes("return=representation")) {
        return new Response(
          JSON.stringify(opts?.updateRows ?? [{ id: "prof_1" }]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
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

/** Mutable profile + receipts so A → B → replay A can share one store. */
function installStatefulFetch(profile: {
  last_grant_session_id: string | null;
  generations_limit: number;
  generations_used: number;
}) {
  const calls: Array<{
    method: string;
    url: string;
    body?: unknown;
    prefer?: string | null;
  }> = [];
  const receipts = new Set<string>();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers);
      const prefer = headers.get("Prefer");
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body, prefer });
      if (url.includes("/rpc/grant_stripe_pack_session")) {
        const args = body as { p_profile_id: string; p_session_id: string; p_plan: string };
        const repeat = receipts.has(args.p_session_id);
        if (!repeat) {
          receipts.add(args.p_session_id);
          const credits = args.p_plan === "creator" ? 500 : 100;
          profile.generations_limit = Math.max(0, profile.generations_limit - profile.generations_used) + credits;
          profile.generations_used = 0;
          profile.last_grant_session_id = args.p_session_id;
        }
        return new Response(JSON.stringify({
          status: repeat ? "already_granted" : "granted",
          profile_id: args.p_profile_id, plan: args.p_plan,
          credits: args.p_plan === "creator" ? 500 : 100,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("founder_exit_side_effects")) {
        if (method === "GET") {
          const hit = [...receipts].find(
            id =>
              url.includes(encodeURIComponent(`grant:${id}`)) ||
              url.includes(`grant:${id}`)
          );
          return new Response(
            JSON.stringify(hit ? [{ idempotency_key: `grant:${hit}` }] : []),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (method === "POST" && body && typeof body === "object") {
          const key = String(
            (body as { idempotency_key?: string }).idempotency_key ?? ""
          );
          if (key.startsWith("grant:"))
            receipts.add(key.slice("grant:".length));
        }
        return new Response("[]", { status: 201 });
      }
      if (method === "GET" && url.includes("/profiles")) {
        return new Response(
          JSON.stringify([
            {
              id: "prof_1",
              last_grant_session_id: profile.last_grant_session_id,
              generations_limit: profile.generations_limit,
              generations_used: profile.generations_used,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (method === "PATCH" && url.includes("/profiles") && body) {
        const patch = body as {
          last_grant_session_id?: string;
          generations_limit?: number;
          generations_used?: number;
        };
        if (typeof patch.last_grant_session_id === "string") {
          profile.last_grant_session_id = patch.last_grant_session_id;
        }
        if (typeof patch.generations_limit === "number") {
          profile.generations_limit = patch.generations_limit;
        }
        if (typeof patch.generations_used === "number") {
          profile.generations_used = patch.generations_used;
        }
        return new Response(JSON.stringify([{ id: "prof_1" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    })
  );
  return { calls, receipts, profile };
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
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(patches(first)).toEqual([]);
    expect(first.filter(c => c.url.includes("/rpc/grant_stripe_pack_session"))).toEqual([
      expect.objectContaining({ method: "POST", body: expect.objectContaining({
        p_profile_id: "prof_1", p_session_id: "cs_new", p_plan: "starter",
      }) }),
    ]);
    state.event = sessionEvent({ price: STARTER, id: "cs_new" });
    const second = installFetch({ prior: "cs_new" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(patches(second)).toEqual([]);
    expect(second.some(c => c.url.includes("/rpc/grant_stripe_pack_session"))).toBe(true);
  });
  it("answers 500 when the prior-session lookup fails", async () => {
    state.event = sessionEvent({ price: STARTER });
    const calls = installFetch({ selectStatus: 500 });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(patches(calls)).toEqual([]);
    expect(await res.json()).toEqual({ error: "atomic pack profile lookup failed" });
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

  it("refuses a non-paid Starter session before invoking the pack RPC", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_no_payment", paymentStatus: "no_payment_required" });
    const calls = installFetch({ prior: null });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "paid pack session evidence missing" });
    expect(calls.some(c => c.url.includes("/rpc/grant_stripe_pack_session"))).toBe(false);
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
    expect(patches(calls)).toEqual([
      expect.objectContaining({
        plan: "qron_launch_annual",
        generations_limit: 1200,
        generations_used: 0,
        last_grant_session_id: "cs_annual",
      }),
    ]);
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
    const calls = installFetch({ prior: "cs_new", receipts: ["cs_old"] });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(patches(calls)).toEqual([]);
    expect(calls.some(c => c.url.includes("/rpc/grant_stripe_pack_session"))).toBe(true);
  });
  it("grant A, grant B, replay A does not add A again (CFA-869 F869-1)", async () => {
    const db = installStatefulFetch({
      last_grant_session_id: null, generations_limit: 0, generations_used: 0,
    });
    state.event = sessionEvent({ price: STARTER, id: "cs_a" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(100);
    state.event = sessionEvent({ price: STARTER, id: "cs_b" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(200);
    state.event = sessionEvent({ price: STARTER, id: "cs_a" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(200);
    expect(db.receipts.size).toBe(2);
    expect(db.calls.filter(c => c.method === "PATCH")).toEqual([]);
  });
  it("adds a second Starter pack on top of unused credits", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_repeat" });
    const calls = installFetch({ prior: "cs_old", grantLimit: 100, grantUsed: 40 });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(patches(calls)).toEqual([]);
    expect(calls.some(c => c.url.includes("/rpc/grant_stripe_pack_session") &&
      (c.body as { p_session_id?: string }).p_session_id === "cs_repeat")).toBe(true);
  });
  it("does not double-grant when the same Starter event is replayed", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_repeat" });
    const calls = installFetch({ prior: "cs_repeat", grantLimit: 160 });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(patches(calls)).toEqual([]);
    expect(calls.some(c => c.url.includes("/rpc/grant_stripe_pack_session"))).toBe(true);
  });
  it("adds a Creator pack on leftover Starter credits", async () => {
    const db = installStatefulFetch({
      last_grant_session_id: "cs_starter", generations_limit: 100, generations_used: 40,
    });
    state.event = sessionEvent({ price: CREATOR, id: "cs_creator" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(560);
    expect(db.profile.generations_used).toBe(0);
    expect(db.calls.filter(c => c.method === "PATCH")).toEqual([]);
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
    expect(patches(calls)).toEqual([
      expect.objectContaining({
        plan: "qron_launch_annual",
        generations_limit: 1200,
        generations_used: 0,
        last_grant_session_id: "cs_annual",
      }),
    ]);
    expect(calls.find(c => c.method === "PATCH")?.prefer).toBeNull();
  });

  it("retries a pack grant when the conditional write matches no row", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_rpc_fail" });
    const calls = installFetch({ prior: "cs_old", rpcStatus: 500 });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "atomic pack RPC failed" });
    expect(patches(calls)).toEqual([]);
  });
  it("skips after a CAS miss once this session is already stamped", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_rpc_invalid" });
    const calls = installFetch({ prior: "cs_old", rpcResultStatus: "invalid" });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "atomic pack RPC returned invalid evidence" });
    expect(patches(calls)).toEqual([]);
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
