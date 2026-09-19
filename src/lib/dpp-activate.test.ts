import { describe, expect, it, vi } from "vitest";

const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { retrieve } };
  },
}));

describe("activateDppMerchant", () => {
  it("returns 400 without session_id", async () => {
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: { categories: "a", markets: "b", labeling: "c" },
      stripeSecretKey: "sk_test",
      supabase: { from: vi.fn() },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/session_id/);
    }
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("returns 400 when intake fields are missing", async () => {
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: { session_id: "cs_test" },
      stripeSecretKey: "sk_test",
      supabase: { from: vi.fn() },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
