import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  rows: [] as Record<string, unknown>[],
}));

vi.mock("../../../utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock("../../../lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          chain.matches = state.rows.filter(row => row[column] === value);
          return chain;
        },
        limit: async () => ({ data: chain.matches }),
        matches: [] as Record<string, unknown>[],
      };
      return chain;
    },
  }),
}));

import { GET, POST } from "./route";
import { listedPlans } from "../../../lib/plans";

const get = (query = "") =>
  GET(new NextRequest(`https://authichain.com/api/subscription${query}`));

describe("/api/subscription", () => {
  beforeEach(() => {
    state.user = null;
    state.rows = [];
  });

  it("refuses the caller's subscription without a session", async () => {
    expect((await get()).status).toBe(401);
  });

  it("returns the signed-in user's real entitlement", async () => {
    state.user = { id: "u1", email: "Buyer@Example.com" };
    // Guest checkout: the profile is keyed by email, not user id.
    state.rows = [
      {
        email: "buyer@example.com",
        subscription_plan: "starter",
        subscription_status: "active",
      },
    ];
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      plan: "starter",
      status: "active",
      entitled: true,
    });
  });

  it("reports no plan for a user without a profile", async () => {
    state.user = { id: "u2", email: "new@example.com" };
    expect(await (await get()).json()).toEqual({
      plan: null,
      status: null,
      entitled: false,
    });
  });

  it("lists exactly the plans on sale in plans.ts", async () => {
    const body = await (await get("?type=plans")).json();
    expect(body.plans.map((p: { id: string }) => p.id)).toEqual(
      listedPlans().map(p => p.id)
    );
    expect(JSON.stringify(body)).not.toMatch(/plan_pro|plan_business|sub_00/);
  });

  it("no longer creates subscriptions", async () => {
    const res = POST();
    expect(res.status).toBe(410);
    expect((await res.json()).error).toContain("/checkout/");
  });
});
