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
  upsertOk?: boolean;
  updateOk?: boolean;
}) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (method === "GET") {
        if ((opts?.selectStatus ?? 200) >= 400) {
          return new Response("no", { status: opts?.selectStatus ?? 500 });
        }
        const row =
          opts?.prior === undefined ? [] : [{ last_grant_session_id: opts.prior }];
        return new Response(JSON.stringify(opts?.prior === undefined ? [] : row), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (method === "POST" && opts?.upsertOk === false) {
        return new Response("no", { status: 500 });
      }
      if (method === "PATCH" && opts?.updateOk === false) {
        return new Response("no", { status: 500 });
      }
      return new Response("{}", { status: 200 });
    })
  );
  return calls;
}

function patches(calls: Array<{ method: string; body?: unknown }>) {
  return calls.filter(c => c.method === "PATCH").map(c => c.body);
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
    state.verifyError = new Error("No signatures found matching the expected signature");
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

  it("does not stamp a session id or zero generations for a DPP human hold", async () => {
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
    expect(res.status).toBe(200);
    expect(patches(calls)).toEqual([]);
    expect(calls.some(c => c.method === "GET")).toBe(false);
    expect(
      calls.filter(c => c.method === "POST" && c.url.includes("/profiles"))
    ).toHaveLength(1);
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
