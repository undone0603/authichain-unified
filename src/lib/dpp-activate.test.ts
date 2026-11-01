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

  it("fails closed when Checkout is complete but the payment has not cleared", async () => {
    const { activateDppMerchant } = await import("./dpp-activate");
    for (const payment_status of ["unpaid", "no_payment_required", undefined]) {
      retrieve.mockResolvedValueOnce({
        status: "complete",
        payment_status,
        amount_total: 29900,
        metadata: { offer: "dpp_readiness_2026" },
        line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
      });
      const from = vi.fn(() => { throw new Error("must not create activation event"); });
      const result = await activateDppMerchant({
        body: { session_id: "cs_pending", categories: "a", markets: "b", labeling: "c" },
        stripeSecretKey: "sk_test",
        supabase: { from },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(402);
      expect(from).not.toHaveBeenCalled();
    }
  });

  it("rejects a paid checkout whose session is still open", async () => {
    retrieve.mockResolvedValueOnce({
      status: "open", payment_status: "paid", amount_total: 29900,
      metadata: { plan: "dpp_readiness" },
      line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    });
    const from = vi.fn(() => { throw new Error("must not create activation event"); });
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: { session_id: "cs_open", categories: "a", markets: "b", labeling: "c" },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(402);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a paid $299 session whose line item is another product", async () => {
    retrieve.mockResolvedValueOnce({
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
      expect(result.error).toMatch(/Not a DPP workspace session/);
    }
  });

  it("rejects forged DPP metadata and matching dollar amount without the purchased DPP price", async () => {
    const { activateDppMerchant } = await import("./dpp-activate");
    const invalidPurchases = [
      { line_items: undefined },
      { line_items: { data: [{ price: { id: "price_1UL0vVGqTruSqV8T5WYjrq6i" } }] } },
      { line_items: { data: [
        { price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } },
        { price: { id: "price_another_product" } },
      ] } },
    ];
    for (const [index, purchase] of invalidPurchases.entries()) {
      retrieve.mockResolvedValueOnce({
        status: "complete", payment_status: "paid", amount_total: 29900,
        metadata: { offer: "dpp_readiness_2026", plan: "dpp_readiness" },
        customer_details: { email: "buyer@example.test" },
        ...purchase,
      });
      const from = vi.fn(() => { throw new Error("must not persist invalid activation"); });
      const result = await activateDppMerchant({
        body: { session_id: `cs_wrong_price_${index}`, categories: "a", markets: "b", labeling: "c" },
        stripeSecretKey: "sk_test", supabase: { from },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.error).toMatch(/Not a DPP workspace session/);
      }
      expect(from).not.toHaveBeenCalled();
    }
  });

  it("returns 503 when paid activation cannot persist its durable event", async () => {
    const { activateDppMerchant } = await import("./dpp-activate");
    for (const failure of ["error", "exception"]) {
      retrieve.mockResolvedValueOnce({
        status: "complete", payment_status: "paid", amount_total: 29900,
        metadata: { offer: "dpp_readiness_2026", visit_id: "visit_record" },
        customer_details: { email: "buyer@example.test" },
        line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
      });
      const insert = vi.fn();
      if (failure === "error") insert.mockResolvedValueOnce({ error: { message: "database unavailable" } });
      else insert.mockRejectedValueOnce(new Error("database unavailable"));
      const from = vi.fn((table: string) => {
        if (table === "profiles") {
          return { select: () => ({ eq: () => ({
            maybeSingle: async () => ({ data: { id: "profile_verified" }, error: null }),
          }) }) };
        }
        if (table === "funnel_events") {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ order: () => ({
              limit: async () => ({ data: [], error: null }),
            }) }) }) }),
            insert,
          };
        }
        throw new Error("unexpected table");
      });
      const result = await activateDppMerchant({
        body: { session_id: "cs_record_error", categories: "a", markets: "b", labeling: "c" },
        stripeSecretKey: "sk_test", supabase: { from },
      });
      expect(result).toMatchObject({
        ok: false,
        status: 503,
        error: "Merchant activation could not be persisted",
      });
      expect(insert).toHaveBeenCalledTimes(1);
    }
  });

  it("returns and persists an importer_file on first paid DPP activation", async () => {
    retrieve.mockResolvedValueOnce({
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
