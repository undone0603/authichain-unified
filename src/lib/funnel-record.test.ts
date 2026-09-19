import { describe, expect, it, vi } from "vitest";
import { recordFunnelEvent } from "./funnel-record";

describe("recordFunnelEvent", () => {
  it("rejects missing fields", async () => {
    const result = await recordFunnelEvent(null, {
      stage: "visit_landing_page",
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects invalid stage/source", async () => {
    const badStage = await recordFunnelEvent(null, {
      prospect_id: "dpp_1",
      stage: "attributed_visit",
      source: "direct",
    });
    expect(badStage).toMatchObject({ ok: false, status: 400 });

    const badSource = await recordFunnelEvent(null, {
      prospect_id: "dpp_1",
      stage: "visit_landing_page",
      source: "twitter",
    });
    expect(badSource).toMatchObject({ ok: false, status: 400 });
  });

  it("fails closed when Supabase is missing", async () => {
    const result = await recordFunnelEvent(null, {
      prospect_id: "dpp_1",
      stage: "visit_landing_page",
      source: "direct",
    });
    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "Funnel store is not configured",
    });
  });

  it("inserts a DPP attributed_visit payload", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) };

    const result = await recordFunnelEvent(supabase, {
      prospect_id: "dpp_abc",
      stage: "visit_landing_page",
      source: "seo",
      event_type: "dpp_loop:attributed_visit",
      metadata: { loop_stage: "attributed_visit" },
    });

    expect(result).toEqual({
      ok: true,
      prospect_id: "dpp_abc",
      stage: "visit_landing_page",
      source: "seo",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        prospect_id: "dpp_abc",
        stage: "visit_landing_page",
        source: "seo",
        event_type: "dpp_loop:attributed_visit",
        metadata: { loop_stage: "attributed_visit" },
      })
    );
  });
});
