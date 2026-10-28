import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const createClient = vi.fn((_url: string, _key: string) => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string) => createClient(url, key),
}));

import {
  checkoutProtectionSupabaseUrl,
  claimCheckoutAttempt,
  recordCheckoutSession,
} from "./checkout-protection";
import {
  CHECKOUT_UNAVAILABLE_MESSAGE,
  tryHandleGatedCheckout,
} from "./checkout-gate";

const NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(NAMES.map(n => [n, process.env[n]]));
  for (const n of NAMES) delete process.env[n];
  rpc.mockReset();
  createClient.mockClear();
});
afterEach(() => {
  for (const n of NAMES) {
    if (saved[n] === undefined) delete process.env[n];
    else process.env[n] = saved[n];
  }
});

const claimOpts = (plan = "starter") => ({
  checkoutKey: "12345678-1234-4234-8234-123456789abc",
  email: "a@b.co",
  planId: plan,
  request: new Request("https://authichain.com/checkout/" + plan, {
    headers: { "cf-connecting-ip": "203.0.113.9" },
  }),
});

describe("checkoutProtectionSupabaseUrl", () => {
  it("prefers NEXT_PUBLIC_SUPABASE_URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://next.supabase.co";
    process.env.SUPABASE_URL = "https://worker.supabase.co";
    expect(checkoutProtectionSupabaseUrl()).toBe("https://next.supabase.co");
  });
  it("falls back to SUPABASE_URL (authichain-com Worker binding)", () => {
    process.env.SUPABASE_URL = "https://worker.supabase.co";
    expect(checkoutProtectionSupabaseUrl()).toBe("https://worker.supabase.co");
  });
  it("is undefined when neither is set", () => {
    expect(checkoutProtectionSupabaseUrl()).toBeUndefined();
  });
});

describe("claimCheckoutAttempt / recordCheckoutSession with only SUPABASE_URL", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://worker.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  for (const plan of ["starter", "strainchain_passport"]) {
    it(`claim reaches the RPC for ${plan}`, async () => {
      rpc.mockResolvedValue({ data: { allowed: true }, error: null });
      await expect(claimCheckoutAttempt(claimOpts(plan))).resolves.toEqual({
        allowed: true,
      });
      expect(createClient).toHaveBeenCalledWith(
        "https://worker.supabase.co",
        "test-service-role"
      );
      expect(rpc).toHaveBeenCalledWith(
        "claim_gated_checkout",
        expect.objectContaining({ p_plan_id: plan })
      );
    });
  }

  it("record reaches the RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(
      recordCheckoutSession("k", "https://checkout.stripe.com/c/pay/cs_x")
    ).resolves.toBe(true);
    expect(createClient).toHaveBeenCalledWith(
      "https://worker.supabase.co",
      "test-service-role"
    );
  });

  it("still refuses when no Supabase URL is configured", async () => {
    delete process.env.SUPABASE_URL;
    await expect(claimCheckoutAttempt(claimOpts())).resolves.toEqual({
      allowed: false,
      reason: "Checkout protection unavailable",
    });
    await expect(recordCheckoutSession("k", "u")).resolves.toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("gated POST when protection is unavailable", () => {
  for (const path of ["/checkout/starter", "/checkout/strainchain_passport"]) {
    it(`${path} returns 503 with a message that does not blame Stripe`, async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const res = await tryHandleGatedCheckout(
        new Request(`https://authichain.com${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
            origin: "https://authichain.com",
          },
          body: new URLSearchParams({
            email: "a@b.co",
            checkout_key: "12345678-1234-4234-8234-123456789abc",
          }).toString(),
        }),
        { STRIPE_SECRET_KEY: "sk_test_x" },
        { fetchImpl }
      );
      expect(res!.status).toBe(503);
      const html = await res!.text();
      expect(html).toContain(CHECKOUT_UNAVAILABLE_MESSAGE);
      expect(html).not.toContain("Stripe checkout could not start");
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }
});
