import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setSubscriptionStatusRest,
  upsertSubscriptionRest,
  shouldUseRestFallback,
} from "./subscriptions-rest";

const ENV = { ...process.env };

function fakeFetch(existing: unknown[]) {
  const calls: { url: string; method: string; body: any }[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const payload =
      (init.method ?? "GET") === "GET" ? JSON.stringify(existing) : "";
    return new Response(payload, {
      status: init.method === "POST" ? 201 : 200,
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const sub = {
  userId: 7,
  plan: "starter",
  status: "active" as const,
  monthlyQuota: 100,
  billingCycle: "monthly" as const,
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
  currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
  trialEndsAt: null,
};

describe("subscriptions over Supabase REST", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_URL = "https://proj.supabase.co/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  it("is used only when DATABASE_URL is absent and Supabase credentials exist", () => {
    expect(shouldUseRestFallback()).toBe(true);
    process.env.DATABASE_URL = "postgres://x";
    expect(shouldUseRestFallback()).toBe(false);
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(shouldUseRestFallback()).toBe(false);
  });

  it("inserts a new row with camelCase columns when none exists", async () => {
    const { impl, calls } = fakeFetch([]);
    await upsertSubscriptionRest(sub, impl);
    expect(calls.map(c => c.method)).toEqual(["GET", "POST"]);
    expect(calls[0].url).toBe(
      "https://proj.supabase.co/rest/v1/subscriptions?stripeSubscriptionId=eq.sub_1&select=*&limit=1"
    );
    expect(calls[1].body).toMatchObject({
      userId: 7,
      stripeSubscriptionId: "sub_1",
      plan: "starter",
      status: "active",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    });
  });

  it("patches the existing row instead of inserting a duplicate", async () => {
    const { impl, calls } = fakeFetch([{ id: 3 }]);
    await upsertSubscriptionRest({ ...sub, status: "past_due" }, impl);
    expect(calls.map(c => c.method)).toEqual(["GET", "PATCH"]);
    expect(calls[1].body.status).toBe("past_due");
    expect(calls[1].body.userId).toBeUndefined();
  });

  it("sets status and cancellation time", async () => {
    const { impl, calls } = fakeFetch([]);
    await setSubscriptionStatusRest(
      "sub_1",
      "cancelled",
      new Date("2026-09-23T00:00:00Z"),
      impl
    );
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      body: { status: "cancelled", cancelledAt: "2026-09-23T00:00:00.000Z" },
    });
  });

  it("throws on a failed write so Stripe retries the webhook", async () => {
    const impl = vi.fn(
      async () => new Response("nope", { status: 500 })
    ) as unknown as typeof fetch;
    await expect(
      setSubscriptionStatusRest("sub_1", "active", undefined, impl)
    ).rejects.toThrow(/500/);
  });
});
