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
    const created = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(created.status).toBe(200);
    expect(patches(first)).toEqual([
      expect.objectContaining({
        plan: "starter",
        generations_limit: 100,
        generations_used: 0,
        last_grant_session_id: "cs_new",
      }),
    ]);
    expect(first.find(c => c.method === "PATCH")?.prefer).toMatch(
      /return=representation/
    );
    expect(
      first.some(
        c =>
          c.method === "POST" &&
          c.url.includes("founder_exit_side_effects") &&
          (c.body as { idempotency_key?: string })?.idempotency_key ===
            "grant:cs_new"
      )
    ).toBe(true);

    state.event = sessionEvent({ price: STARTER, id: "cs_new" });
    const second = installFetch({ prior: "cs_new" });
    const replay = await worker.fetch(
      new Request("https://worker.test/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=ok" },
      }),
      env
    );
    expect(replay.status).toBe(200);
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
    const calls = installFetch({
      prior: "cs_new",
      grantLimit: 200,
      grantUsed: 0,
      receipts: ["cs_old"],
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(patches(calls)).toEqual([]);
    expect(
      calls.some(
        c => c.method === "GET" && c.url.includes("founder_exit_side_effects")
      )
    ).toBe(true);
  });

  it("grant A, grant B, replay A does not add A again (CFA-869 F869-1)", async () => {
    const db = installStatefulFetch({
      last_grant_session_id: null,
      generations_limit: 0,
      generations_used: 0,
    });
    state.event = sessionEvent({ price: STARTER, id: "cs_a" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(100);
    expect(db.receipts.has("cs_a")).toBe(true);

    state.event = sessionEvent({ price: STARTER, id: "cs_b" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(200);
    expect(db.profile.last_grant_session_id).toBe("cs_b");
    const writes = patches(db.calls).length;

    state.event = sessionEvent({ price: STARTER, id: "cs_a" });
    expect((await worker.fetch(signedPost(), env)).status).toBe(200);
    expect(db.profile.generations_limit).toBe(200);
    expect(patches(db.calls)).toHaveLength(writes);
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
    expect(patches(calls)).toEqual([
      expect.objectContaining({
        plan: "starter",
        generations_limit: 160,
        generations_used: 0,
        last_grant_session_id: "cs_repeat",
      }),
    ]);
    const patch = calls.find(c => c.method === "PATCH");
    expect(patch?.url).toMatch(/generations_limit=eq\.100/);
    expect(patch?.url).toMatch(/generations_used=eq\.40/);
    expect(patch?.url).toMatch(/last_grant_session_id=eq\.cs_old/);
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
    expect(patches(calls)).toEqual([
      expect.objectContaining({
        plan: "creator",
        generations_limit: 560,
        generations_used: 0,
        last_grant_session_id: "cs_creator",
      }),
    ]);
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
    state.event = sessionEvent({ price: STARTER, id: "cs_cas" });
    const calls = installFetch({
      prior: "cs_old",
      grantLimit: 100,
      grantUsed: 40,
      updateRows: [],
    });
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "concurrent profile update; retry",
    });
    expect(patches(calls)).toHaveLength(4);
  });

  it("skips after a CAS miss once this session is already stamped", async () => {
    state.event = sessionEvent({ price: STARTER, id: "cs_race" });
    let gets = 0;
    const granted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (String(url).includes("founder_exit_side_effects")) {
          return new Response("[]", {
            status: method === "GET" ? 200 : 201,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (method === "GET") {
          gets += 1;
          const row =
            gets === 1
              ? {
                  last_grant_session_id: "cs_old",
                  generations_limit: 100,
                  generations_used: 40,
                }
              : {
                  last_grant_session_id: "cs_race",
                  generations_limit: 160,
                  generations_used: 0,
                };
          return new Response(JSON.stringify([row]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (method === "PATCH") {
          granted.push(JSON.parse(String(init?.body)));
          return new Response("[]", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 200 });
      })
    );
    const res = await worker.fetch(signedPost(), env);
    expect(res.status).toBe(200);
    expect(granted).toEqual([
      expect.objectContaining({
        generations_limit: 160,
        last_grant_session_id: "cs_race",
      }),
    ]);
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
