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

  it("rejects a paid $299 session whose line item is another product", async () => {
    retrieve.mockResolvedValueOnce({
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      metadata: {},
      line_items: {
        data: [{ price: { id: "price_1UL0vVGqTruSqV8T5WYjrq6i" } }],
      },
    });
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_musa",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from: vi.fn() },
    });
    expect(retrieve).toHaveBeenCalledWith("cs_musa", {
      expand: ["line_items"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Not a DPP workspace session/);
    }
  });

  it("rejects a $0 session that is not a DPP offer", async () => {
    retrieve.mockResolvedValueOnce({
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 0,
      metadata: {},
      line_items: { data: [{}] },
    });
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_zero",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from: vi.fn() },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Not a paid DPP workspace purchase/);
    }
  });

  // Regression: Stripe can mark a Checkout complete while asynchronous
  // payment is still unpaid. The activation endpoint must refuse it.
  const genuineDpp = {
    mode: "payment",
    payment_status: "paid",
    status: "complete",
    amount_total: 29900,
    metadata: { plan: "dpp_readiness" },
    line_items: {
      data: [{ quantity: 1, price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }],
    },
  };

  for (const [label, overrides, status] of [
    ["complete but unpaid", { payment_status: "unpaid" }, 402],
    ["paid but checkout still open", { status: "open" }, 402],
    ["completed but no monetary payment", { amount_total: 0 }, 400],
    ["subscription mode", { mode: "subscription" }, 400],
    ["DPP metadata on another $299 price", {
      line_items: { data: [{ quantity: 1, price: { id: "price_1UL0vVGqTruSqV8T5WYjrq6i" } }] },
    }, 400],
    ["metadata claims DPP with no line-item price", {
      line_items: { data: [{ price: null }] },
    }, 400],
    ["correct price with conflicting plan metadata", {
      metadata: { plan: "musa_claim_file" },
    }, 400],
    ["multiple products in one session", {
      line_items: { data: [
        { quantity: 1, price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } },
        { quantity: 1, price: { id: "price_1UL0vVGqTruSqV8T5WYjrq6i" } },
      ] },
    }, 400],
    ["multiple DPP workspaces in one item", {
      line_items: { data: [{ quantity: 2, price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    }, 400],
  ] as const) {
    it(`refuses ${label} without recording activation`, async () => {
      retrieve.mockResolvedValueOnce({ ...genuineDpp, ...overrides });
      const from = vi.fn();
      const { activateDppMerchant } = await import("./dpp-activate");
      const result = await activateDppMerchant({
        body: { session_id: "cs_gate", categories: "a", markets: "b", labeling: "c" },
        stripeSecretKey: "sk_test",
        supabase: { from },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(status);
      expect(from).not.toHaveBeenCalled();
    });
  }

  it("fails closed when prior activation receipt lookup fails", async () => {
    retrieve.mockResolvedValueOnce({
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      metadata: { plan: "dpp_readiness" },
      line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    });
    const insert = vi.fn();
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: null,
                error: { message: "read failed" },
              }),
            }),
          }),
        }),
      }),
      insert,
    }));
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_failed_read",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Activation record lookup failed");
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not report activated when the durable event insert fails", async () => {
    retrieve.mockResolvedValueOnce({
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      metadata: { plan: "dpp_readiness" },
      line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    });
    const insert = vi.fn().mockResolvedValue({
      error: { message: "database write failed" },
    });
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
      insert,
    }));
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_failed_insert",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(insert).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Activation could not be recorded");
    }
  });

  it("refuses to activate when a buyer's profile lookup fails", async () => {
    retrieve.mockResolvedValueOnce({
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      metadata: { plan: "dpp_readiness" },
      customer_details: { email: "buyer@example.com" },
      line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    });
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { message: "profile read failed" },
          }),
        }),
      }),
    }));
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_profile_read_failed",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Customer record lookup failed");
    }
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("returns and persists an importer_file on first paid DPP activation", async () => {
    retrieve.mockResolvedValueOnce({
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      metadata: { plan: "dpp_readiness", visit_id: "visit_1", source: "seo" },
      customer_details: { email: "buyer@example.com" },
      line_items: {
        data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }],
      },
    });

    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "prof_1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "funnel_events") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
          insert,
        };
      }
      return { insert };
    });

    const { activateDppMerchant } = await import("./dpp-activate");
    const { DPP_IMPORTER_FILE_SCHEMA } = await import("./dpp-importer-file");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_dpp",
        categories: "LMT e-bike",
        markets: "DE",
        labeling: "Wh on label",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.already_activated).toBe(false);
    expect(result.importer_file.schema).toBe(DPP_IMPORTER_FILE_SCHEMA);
    expect(result.importer_file.summary.present).toBe(3);
    expect(result.importer_file.qr.status).toBe("not_issued");
    expect(insert).toHaveBeenCalled();
    const inserted = insert.mock.calls[0]?.[0];
    expect(inserted?.metadata?.importer_file?.schema).toBe(
      DPP_IMPORTER_FILE_SCHEMA
    );
    expect(inserted?.metadata?.importer_file?.product?.categories).toBe(
      "LMT e-bike"
    );
  });
});
