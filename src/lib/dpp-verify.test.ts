import { describe, expect, it, vi } from "vitest";

vi.mock("./dpp-loop", () => ({
  recordDppLoopEventOnce: vi.fn().mockResolvedValue({ recorded: true }),
}));

import { verifyDpp } from "./dpp-verify";
import { recordDppLoopEventOnce } from "./dpp-loop";

describe("verifyDpp", () => {
  it("returns 400 without dpp_id", async () => {
    const result = await verifyDpp({
      dppId: "",
      visitId: "dpp_1",
      source: "direct",
      supabase: { from: vi.fn() },
    });
    expect(result).toMatchObject({ ok: false, status: 400, error: "dpp_id required" });
  });

  it("returns 500 when Supabase is missing", async () => {
    const result = await verifyDpp({
      dppId: "prod_1",
      visitId: null,
      source: "direct",
      supabase: null,
    });
    expect(result).toMatchObject({ ok: false, status: 500, error: "Database not configured" });
  });

  it("returns 404 when the product is missing or unpublished", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      })),
    };
    const result = await verifyDpp({
      dppId: "prod_missing",
      visitId: "dpp_1",
      source: "direct",
      supabase,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 404,
      error: "not_found",
      event_recorded: false,
    });
    expect(recordDppLoopEventOnce).not.toHaveBeenCalled();
  });

  it("records verification only when the passport is published", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "prod_1",
                name: "Widget",
                brand: "Acme",
                status: "published",
                metadata: { dpp: true },
              },
            }),
          }),
        }),
      })),
    };
    const result = await verifyDpp({
      dppId: "prod_1",
      visitId: "dpp_1",
      source: "direct",
      supabase,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("verified");
      expect(result.product).toEqual({ name: "Widget", brand: "Acme" });
      expect(result.event_recorded).toBe(true);
      expect(result.proves).toMatch(/published/);
    }
    expect(recordDppLoopEventOnce).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        visitId: "dpp_1",
        stage: "verification",
        dedupeKey: "verify:prod_1",
      }),
    );
  });
});
