import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { retrieve } };
  },
}));

function fakeSupabase() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    from: () => {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        limit: async () => ({
          data: rows.filter(row =>
            filters.every(([key, value]) => row[key] === value)
          ),
          error: null,
        }),
        insert: async (row: Record<string, unknown>) => {
          rows.push(row);
          return { error: null };
        },
      };
      return builder;
    },
  };
}

const passportIntake = {
  session_id: "cs_passport",
  plan: "strainchain_passport",
  farm: "North Farm",
  cultivar: "Atlas",
  coa_references: ["coa-001"],
};

describe("activateServiceOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts valid paid passport intake and only records it once", async () => {
    retrieve.mockResolvedValue({
      payment_status: "paid",
      status: "complete",
      metadata: { plan: "strainchain_passport" },
      customer_details: { email: "buyer@example.com" },
      line_items: {
        data: [{ price: { id: "price_1UHjCZGqTruSqV8T35M6AmoJ" } }],
      },
    });
    const supabase = fakeSupabase();
    const { activateServiceOrder } = await import("./service-order-activate");
    const options = {
      body: passportIntake,
      authenticatedUser: { id: "user_1", email: "buyer@example.com" },
      stripeSecretKey: "sk_test",
      supabase,
    };
    expect(await activateServiceOrder(options)).toMatchObject({
      ok: true,
      status: "intake_accepted",
      already_activated: false,
    });
    expect(await activateServiceOrder(options)).toMatchObject({
      ok: true,
      already_activated: true,
    });
    expect(supabase.rows.map(row => row.event_type)).toEqual([
      "service_order:activation_requested",
      "service_order:activated",
    ]);
  });

  it("rejects invalid bundle scope before retrieving Stripe", async () => {
    const { activateServiceOrder } = await import("./service-order-activate");
    const result = await activateServiceOrder({
      body: {
        session_id: "cs_bundle",
        plan: "musa_audit_bundle",
        company: "MUSA Co",
        contact: { name: "Buyer", email: "buyer@example.com" },
        supplier_origin_records: [{ supplier: "Maker", origin: "US" }],
        skuCount: 11,
      },
      authenticatedUser: { id: "user_1", email: "buyer@example.com" },
      stripeSecretKey: "sk_test",
      supabase: fakeSupabase(),
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it.each([
    [
      "farm",
      "strainchain_farm",
      "price_1UHjJWGqTruSqV8TePctYzO5",
      {
        farm_identity: "North Farm LLC",
        contact: { name: "Buyer", email: "buyer@example.com" },
        initial_library_config: "existing cultivar library",
        initial_coa_config: "COAs supplied per batch",
      },
    ],
    [
      "single MUSA claim",
      "musa_claim_file",
      "price_1UL0vVGqTruSqV8T5WYjrq6i",
      {
        sku: "SKU-1",
        company: "MUSA Co",
        contact: { name: "Buyer", email: "buyer@example.com" },
        supplier_origin_records: [{ supplier: "Maker", origin: "US" }],
      },
    ],
    [
      "MUSA bundle",
      "musa_audit_bundle",
      "price_1UL15AGqTruSqV8TQHP3yNiR",
      {
        company: "MUSA Co",
        contact: { name: "Buyer", email: "buyer@example.com" },
        supplier_origin_records: [{ supplier: "Maker", origin: "US" }],
        skuCount: 10,
      },
    ],
  ])(
    "accepts minimally valid %s intake",
    async (_name, plan, priceId, intake) => {
      retrieve.mockResolvedValue({
        payment_status: "paid",
        status: "complete",
        metadata: { plan },
        customer_details: { email: "buyer@example.com" },
        line_items: { data: [{ price: { id: priceId } }] },
      });
      const { activateServiceOrder } = await import("./service-order-activate");
      const result = await activateServiceOrder({
        body: { session_id: `cs_${plan}`, plan, ...intake },
        authenticatedUser: { id: "user_1", email: "buyer@example.com" },
        stripeSecretKey: "sk_test",
        supabase: fakeSupabase(),
      });
      expect(result).toMatchObject({
        ok: true,
        plan,
        status: "intake_accepted",
      });
    }
  );

  it("rejects a paid session when its exact price differs from the plan", async () => {
    retrieve.mockResolvedValue({
      payment_status: "paid",
      status: "complete",
      metadata: { plan: "strainchain_passport" },
      customer_details: { email: "buyer@example.com" },
      line_items: { data: [{ price: { id: "price_other" } }] },
    });
    const { activateServiceOrder } = await import("./service-order-activate");
    const result = await activateServiceOrder({
      body: passportIntake,
      authenticatedUser: { id: "user_1", email: "buyer@example.com" },
      stripeSecretKey: "sk_test",
      supabase: fakeSupabase(),
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
