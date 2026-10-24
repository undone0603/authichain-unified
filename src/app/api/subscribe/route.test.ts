import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { gatedCheckoutUrl } from "../../../lib/plans";

const state = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
}));

vi.mock("../../../lib/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error("invalid"),
      }),
    },
  },
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    constructor() {
      throw new Error("subscribe must not construct Stripe");
    }
  },
}));

import { POST } from "./route";

function post(plan: string) {
  return POST(
    new NextRequest("https://authichain.com/api/subscribe", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ plan, trial_days: 14 }),
    })
  );
}

describe("POST /api/subscribe", () => {
  beforeEach(() => {
    state.user = { id: "user_1", email: "buyer@brand.com" };
  });

  it("returns the gated confirm URL for a public plan and does not open Stripe", async () => {
    const res = await post("dpp_readiness");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      plan: "dpp_readiness",
      checkout_url: gatedCheckoutUrl("dpp_readiness"),
    });
  });

  it("refuses Farm, Theater, and the old Basic id", async () => {
    for (const plan of ["strainchain_farm", "theater_3", "authichain_basic", "business"]) {
      const res = await post(plan);
      expect(res.status, plan).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Plan is not a public offer");
    }
  });
});
