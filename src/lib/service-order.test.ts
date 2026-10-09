import { describe, expect, it } from "vitest";
import {
  appendServiceOrderEventOnce,
  serviceOrderKey,
  validateServiceOrderSession,
} from "./service-order";

function fakeFunnel() {
  const rows: Array<Record<string, unknown>> = [];
  const supabase = {
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
  return { supabase, rows };
}

describe("service-order lifecycle", () => {
  it("uses a deterministic plan and Stripe-session key", () => {
    expect(serviceOrderKey("musa_claim_file", "cs_123")).toBe(
      "service_order:musa_claim_file:cs_123"
    );
    expect(() => serviceOrderKey("musa_claim_file", " ")).toThrow(/session id/);
  });

  it("deduplicates serial lifecycle writes without changing the funnel schema", async () => {
    const { supabase, rows } = fakeFunnel();
    const input = {
      plan: "strainchain_passport" as const,
      sessionId: "cs_passport",
      stage: "payment_succeeded" as const,
    };
    expect(await appendServiceOrderEventOnce(supabase, input)).toMatchObject({
      recorded: true,
    });
    expect(await appendServiceOrderEventOnce(supabase, input)).toMatchObject({
      recorded: false,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      prospect_id: "service_order:strainchain_passport:cs_passport",
      stage: "complete_checkout",
      event_type: "service_order:payment_succeeded",
      metadata: { service_order_stage: "payment_succeeded" },
    });
  });

  it("rejects a session whose configured price does not match the plan", () => {
    expect(() =>
      validateServiceOrderSession("musa_claim_file", {
        id: "cs_wrong",
        metadata: { plan: "musa_claim_file" },
        line_items: { data: [{ price: { id: "price_wrong" } }] },
      })
    ).toThrow(/price does not match/);
  });
});
