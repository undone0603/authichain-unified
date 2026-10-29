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

  it("rejects a complete session that is not paid", async () => {
    retrieve.mockResolvedValueOnce({
      payment_status: "unpaid",
      status: "complete",
      amount_total: 29900,
      currency: "usd",
      metadata: { plan: "dpp_readiness" },
      line_items: {
        data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }],
      },
    });
    const from = vi.fn();
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_unpaid",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(402);
      expect(result.error).toMatch(/not paid/);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a paid DPP-metadata session that is not 29900 cents", async () => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      amount_total: 1000,
      currency: "usd",
      metadata: { plan: "dpp_readiness", is_demo: "false" },
      line_items: {
        data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }],
      },
    });
    const from = vi.fn();
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_ten",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(402);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a paid $0 demo DPP session", async () => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      amount_total: 0,
      currency: "usd",
      metadata: { plan: "dpp_readiness", is_demo: "true" },
      line_items: { data: [{}] },
    });
    const from = vi.fn();
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_demo",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(402);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([undefined, "eur"])(
    "rejects a paid $299 DPP session with currency %s",
    async (currency) => {
      retrieve.mockResolvedValueOnce({
        payment_status: "paid",
        status: "complete",
        amount_total: 29900,
        currency,
        metadata: { plan: "dpp_readiness" },
        line_items: {
          data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }],
        },
      });
      const from = vi.fn();
      const { activateDppMerchant } = await import("./dpp-activate");
      const result = await activateDppMerchant({
        body: {
          session_id: "cs_wrong_currency",
          categories: "a",
          markets: "b",
          labeling: "c",
        },
        stripeSecretKey: "sk_test",
        supabase: { from },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(402);
      expect(from).not.toHaveBeenCalled();
    }
  );

  it("rejects a paid $299 session with no DPP offer identity", async () => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      currency: "usd",
      metadata: {},
      line_items: { data: [{}] },
    });
    const from = vi.fn();
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_unknown_product",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Not a DPP workspace session/);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 500 when the activation row is not stored", async () => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      currency: "usd",
      metadata: { plan: "dpp_readiness", visit_id: "visit_1" },
      customer_details: { email: "buyer@example.com" },
      line_items: {
        data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }],
      },
    });
    const insert = vi.fn().mockResolvedValue({
      error: { message: "db down" },
    });
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
    });
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_db",
        categories: "a",
        markets: "b",
        labeling: "c",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("Could not store the activation");
      expect(result.error).not.toMatch(/db down/);
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

  it("returns and persists an importer_file on first paid DPP activation", async () => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      currency: "usd",
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
