import { describe, expect, it } from "vitest";
import { createPlanCheckoutSession } from "./plan-checkout";

describe("createPlanCheckoutSession", () => {
  it("requires planId", async () => {
    const result = await createPlanCheckoutSession({
      request: new Request("https://authichain.com/api/checkout", {
        method: "POST",
      }),
      body: {},
      stripeSecretKey: "sk_test_x",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "planId is required",
    });
  });

  it("rejects an unknown plan without calling Stripe", async () => {
    const result = await createPlanCheckoutSession({
      request: new Request("https://authichain.com/api/checkout", {
        method: "POST",
      }),
      body: { planId: "not-a-plan" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "Unknown plan",
    });
  });

  it("rejects the free plan", async () => {
    const result = await createPlanCheckoutSession({
      request: new Request("https://authichain.com/api/checkout", {
        method: "POST",
      }),
      body: { planId: "free" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Free plan/);
  });
});
