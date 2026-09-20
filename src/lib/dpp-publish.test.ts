import { describe, expect, it, vi } from "vitest";

vi.mock("./dpp-loop", () => ({
  recordDppLoopEventOnce: vi.fn().mockResolvedValue({ recorded: true }),
}));

import { publishDpp } from "./dpp-publish";
import { recordDppLoopEventOnce } from "./dpp-loop";

describe("publishDpp", () => {
  it("returns 400 without visit_id", async () => {
    const result = await publishDpp({
      body: { name: "Widget" },
      supabase: { from: vi.fn() },
    });
    expect(result).toMatchObject({ ok: false, status: 400, error: "visit_id required" });
    expect(recordDppLoopEventOnce).not.toHaveBeenCalled();
  });

  it("returns 400 without name", async () => {
    const result = await publishDpp({
      body: { visit_id: "dpp_1" },
      supabase: { from: vi.fn() },
    });
    expect(result).toMatchObject({ ok: false, status: 400, error: "name required" });
  });

  it("returns 500 when Supabase is missing", async () => {
    const result = await publishDpp({
      body: { visit_id: "dpp_1", name: "Widget" },
      supabase: null,
    });
    expect(result).toMatchObject({ ok: false, status: 500, error: "Database not configured" });
  });

  it("returns 409 when the visit is not activated", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({ data: [] }),
            }),
          }),
        }),
      })),
    };
    const result = await publishDpp({
      body: { visit_id: "dpp_1", name: "Widget" },
      supabase,
    });
    expect(result).toMatchObject({ ok: false, status: 409, error: "not_activated" });
    expect(recordDppLoopEventOnce).not.toHaveBeenCalled();
  });

  it("inserts a products row then records dpp_published", async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "prod_1" }, error: null }),
      }),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "funnel_events") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: async () => ({
                    data: [{ id: "evt_1", metadata: { profile_id: "prof_1" } }],
                  }),
                }),
              }),
            }),
          };
        }
        return { insert };
      }),
    };

    const result = await publishDpp({
      body: { visit_id: "dpp_1", name: "Widget", gtin: "012" },
      supabase,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dpp_id).toBe("prod_1");
      expect(result.verify_url).toContain("dpp_id=prod_1");
      expect(result.verify_url).toContain("visit_id=dpp_1");
      expect(result.event_recorded).toBe(true);
    }
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Widget",
        status: "published",
        metadata: expect.objectContaining({ dpp: true, visit_id: "dpp_1", gtin: "012" }),
      }),
    );
    expect(recordDppLoopEventOnce).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        visitId: "dpp_1",
        stage: "dpp_published",
        profileId: "prof_1",
        dedupeKey: "dpp:prod_1",
      }),
    );
  });
});
