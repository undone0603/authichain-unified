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

  it.each([
    ["complete but unpaid", "complete", "unpaid"],
    ["open but paid", "open", "paid"],
    ["expired and unpaid", "expired", "unpaid"],
  ])("rejects %s even for a DPP plan", async (_label, status, payment_status) => {
    retrieve.mockResolvedValueOnce({
      status,
      payment_status,
      amount_total: 29900,
      metadata: { plan: "dpp_readiness" },
      customer_details: { email: "buyer@example.com" },
      line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    });
    const from = vi.fn();
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_test_non_paid",
        categories: "LMT",
        markets: "DE",
        labeling: "Wh",
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

  it.each([
    ["same-price other product with DPP metadata", "price_other_299", "dpp_readiness"],
    ["amount-only checkout without price identity", null, "dpp_readiness"],
    ["wrong explicit plan with DPP price", "price_1TwmD8GqTruSqV8TpAF8dfyA", "musa_claim_file"],
  ])("rejects %s", async (_label, priceId, plan) => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      amount_total: 29900,
      metadata: { plan },
      line_items: { data: [{ price: priceId ? { id: priceId } : null }] },
      customer_details: { email: "buyer@example.com" },
    });
    const from = vi.fn();
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_paid_other_299",
        categories: "LMT",
        markets: "DE",
        labeling: "Wh",
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

  it.each([
    ["not yet provisioned", null, null, 409],
    ["grant belongs to another checkout", { id: "prof_1", last_grant_session_id: "cs_other" }, null, 409],
    ["profile lookup failed", null, { message: "storage unavailable" }, 503],
  ])("never claims activation when %s", async (_label, profile, lookupError, expectedStatus) => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      metadata: { plan: "dpp_readiness", visit_id: "stripe_visit" },
      customer_details: { email: "buyer@example.com" },
      line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    });
    const eventsInsert = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: profile, error: lookupError }),
            }),
          }),
        };
      }
      return { insert: eventsInsert };
    });
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_checkout",
        visit_id: "attacker_supplied_visit",
        categories: "LMT",
        markets: "DE",
        labeling: "Wh",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(expectedStatus);
    expect(eventsInsert).not.toHaveBeenCalled();
  });

  it("does not trust a body visit_id over Stripe's checkout attribution", async () => {
    retrieve.mockResolvedValueOnce({
      payment_status: "paid",
      status: "complete",
      metadata: { plan: "dpp_readiness", visit_id: "stripe_visit" },
      customer_details: { email: "buyer@example.com" },
      line_items: { data: [{ price: { id: "price_1TwmD8GqTruSqV8TpAF8dfyA" } }] },
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) =>
      table === "profiles"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "prof_1", last_grant_session_id: "cs_checkout" },
                  error: null,
                }),
              }),
            }),
          }
        : {
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
          }
    );
    const { activateDppMerchant } = await import("./dpp-activate");
    const result = await activateDppMerchant({
      body: {
        session_id: "cs_checkout",
        visit_id: "attacker_supplied_visit",
        categories: "LMT",
        markets: "DE",
        labeling: "Wh",
      },
      stripeSecretKey: "sk_test",
      supabase: { from },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit_id).toBe("stripe_visit");
    expect(insert.mock.calls[0]?.[0]?.prospect_id).toBe("stripe_visit");
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
              maybeSingle: async () => ({ data: { id: "prof_1", last_grant_session_id: "cs_dpp" }, error: null }),
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
