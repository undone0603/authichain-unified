import { describe, it, expect, vi, beforeEach } from "vitest";

// Locks in the money-safety property of the fulfillment library: a paid
// checkout session grants credits/tier EXACTLY ONCE, even when the webhook and
// the success-page backstop both fire. Supabase + automation logging are mocked
// so the test touches no network and asserts purely on the guard behavior.

const { createClient, logAutomation } = vi.hoisted(() => ({
  createClient: vi.fn(),
  logAutomation: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("./automation", () => ({ logAutomation, formatErr: (e: unknown) => String(e) }));
vi.mock("./plans", () => ({
  PLAN_CREDITS: { starter: 100, business: 999999, free: 0 },
  PLAN_TIER: { starter: "pro", business: "enterprise", free: "free" },
}));

import { grantCheckoutEntitlements } from "./fulfillment";

// Simulated `stripe_events` table: a Set keyed by event_id whose membership
// enforces the PRIMARY KEY uniqueness our idempotency relies on.
let guardStore: Set<string>;
const rpcSpy = vi.fn();

function makeClient() {
  return {
    rpc: rpcSpy,
    from(table: string) {
      if (table === "stripe_events") {
        let pendingKey: string | null = null;
        const builder = {
          select: () => builder,
          eq: (_col: string, val: string) => {
            pendingKey = val;
            return builder;
          },
          maybeSingle: () =>
            Promise.resolve({
              data: pendingKey && guardStore.has(pendingKey) ? { event_id: pendingKey } : null,
              error: null,
            }),
          insert: (row: { event_id: string }) => {
            if (guardStore.has(row.event_id)) {
              return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
            }
            guardStore.add(row.event_id);
            return Promise.resolve({ error: null });
          },
          delete: () => ({
            eq: (_col: string, val: string) => {
              guardStore.delete(val);
              return Promise.resolve({ error: null });
            },
          }),
        };
        return builder;
      }
      // profiles (and anything else): update().eq() resolves cleanly
      const profileBuilder = {
        update: () => profileBuilder,
        eq: () => Promise.resolve({ error: null }),
      };
      return profileBuilder;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  guardStore = new Set();
  rpcSpy.mockResolvedValue({ data: null, error: null });
  createClient.mockImplementation(() => makeClient());
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc_key";
});

describe("grantCheckoutEntitlements", () => {
  const base = {
    sessionId: "cs_test_123",
    userId: "user-1",
    planId: "starter",
    customerId: "cus_1",
    source: "webhook" as const,
  };

  it("grants finite credits once and raises the limit via RPC", async () => {
    const res = await grantCheckoutEntitlements(base);
    expect(res.granted).toBe(true);
    expect(res.credits).toBe(100);
    expect(res.tier).toBe("pro");
    expect(rpcSpy).toHaveBeenCalledWith("add_generation_credits", {
      user_uuid: "user-1",
      amount: 100,
    });
  });

  it("is idempotent: a second call for the same session does NOT re-grant", async () => {
    const first = await grantCheckoutEntitlements({ ...base, source: "webhook" });
    expect(first.granted).toBe(true);
    expect(rpcSpy).toHaveBeenCalledTimes(1);

    // Backstop races in after the webhook already fulfilled this session.
    const second = await grantCheckoutEntitlements({ ...base, source: "backstop" });
    expect(second.granted).toBe(false);
    expect(second.reason).toBe("already_fulfilled");
    expect(rpcSpy).toHaveBeenCalledTimes(1); // still only the first grant
  });

  it("does not call the credit RPC for unlimited (enterprise) plans", async () => {
    const res = await grantCheckoutEntitlements({ ...base, planId: "business" });
    expect(res.granted).toBe(true);
    expect(res.tier).toBe("enterprise");
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("skips when required metadata is missing", async () => {
    const res = await grantCheckoutEntitlements({ ...base, userId: null });
    expect(res.granted).toBe(false);
    expect(res.reason).toBe("missing_metadata");
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("skips unknown plans without touching the database", async () => {
    const res = await grantCheckoutEntitlements({ ...base, planId: "mystery" });
    expect(res.granted).toBe(false);
    expect(res.reason).toBe("unknown_plan");
  });
});
