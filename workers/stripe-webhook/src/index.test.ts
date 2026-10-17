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
const CREATOR = "price_1UIoEYGqTruSqV8TCXTNipvh";

async function deliver() {
  return worker.fetch(
    new Request("https://worker.test/stripe", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "t=1,v1=ok" },
    }),
    env
  );
}

function upserts(
  calls: Array<{ method: string; url: string; body?: unknown }>
) {
  return calls
    .filter(c => c.method === "POST" && c.url.includes("/profiles"))
    .map(c => c.body as Record<string, unknown>);
}

function sessionEvent(opts: {
  id?: string;
  price: string;
  email?: string | null;
  prior?: string | null;
}) {
  return {
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: opts.id ?? "cs_1",
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
  row?: Record<string, unknown>;
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
        const row = opts?.row
          ? [opts.row]
          : opts?.prior === undefined
            ? []
            : [{ last_grant_session_id: opts.prior }];
        return new Response(JSON.stringify(row), {
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

  describe("one-time packs stack onto unused credits", () => {
    it("60 left + Starter = 160", async () => {
      state.event = sessionEvent({ price: STARTER, id: "cs_stack" });
      const calls = installFetch({
        row: {
          last_grant_session_id: "cs_old",
          plan: "starter",
          generations_limit: 100,
          generations_used: 40,
        },
      });
      expect((await deliver()).status).toBe(200);
      expect(patches(calls)).toEqual([
        expect.objectContaining({
          plan: "starter",
          generations_limit: 160,
          generations_used: 0,
          last_grant_session_id: "cs_stack",
        }),
      ]);
    });

    it("stacks Creator onto leftover credits (60 + 500 = 560)", async () => {
      state.event = sessionEvent({ price: CREATOR, id: "cs_creator" });
      const calls = installFetch({
        row: {
          last_grant_session_id: "cs_old",
          plan: "starter",
          generations_limit: 100,
          generations_used: 40,
        },
      });
      expect((await deliver()).status).toBe(200);
      expect(patches(calls)).toEqual([
        expect.objectContaining({
          plan: "creator",
          generations_limit: 560,
          generations_used: 0,
        }),
      ]);
    });

    it("keeps a Launch subscriber's plan and subscription when they buy a pack", async () => {
      state.event = sessionEvent({ price: STARTER, id: "cs_sub_pack" });
      const calls = installFetch({
        row: {
          last_grant_session_id: "cs_launch",
          plan: "qron_launch",
          generations_limit: 100,
          generations_used: 30,
          stripe_subscription_id: "sub_123",
          stripe_subscription_status: "active",
        },
      });
      expect((await deliver()).status).toBe(200);
      const [patch] = patches(calls) as Array<Record<string, unknown>>;
      expect(patch).not.toHaveProperty("plan");
      expect(patch).toMatchObject({
        generations_limit: 170,
        generations_used: 0,
        last_grant_session_id: "cs_sub_pack",
      });
      const [up] = upserts(calls);
      expect(up).not.toHaveProperty("plan");
      expect(up).not.toHaveProperty("stripe_subscription_id");
    });

    it("does not add credits twice for a duplicate event", async () => {
      state.event = sessionEvent({ price: STARTER, id: "cs_dup" });
      const calls = installFetch({
        row: {
          last_grant_session_id: "cs_dup",
          plan: "starter",
          generations_limit: 160,
          generations_used: 0,
        },
      });
      expect((await deliver()).status).toBe(200);
      expect(patches(calls)).toEqual([]);
    });

    it("does not count a brand-new profile's defaults as leftover", async () => {
      state.event = sessionEvent({ price: STARTER, id: "cs_first" });
      const calls = installFetch();
      expect((await deliver()).status).toBe(200);
      expect(patches(calls)).toEqual([
        expect.objectContaining({
          generations_limit: 100,
          generations_used: 0,
        }),
      ]);
    });
  });
});
