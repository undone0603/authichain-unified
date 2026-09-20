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
      stage: "not_a_stage",
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

  it("accepts DPP loop stage aliases without breaking attributed_visit", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) };

    const published = await recordFunnelEvent(supabase, {
      prospect_id: "dpp_loop_1",
      stage: "dpp_published",
      source: "direct",
    });
    expect(published).toEqual({
      ok: true,
      prospect_id: "dpp_loop_1",
      stage: "subscribe",
      source: "direct",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        prospect_id: "dpp_loop_1",
        stage: "subscribe",
        event_type: "dpp_loop:dpp_published",
        metadata: { loop_stage: "dpp_published" },
      })
    );

    const verified = await recordFunnelEvent(supabase, {
      prospect_id: "dpp_loop_1",
      stage: "verification",
      source: "direct",
    });
    expect(verified).toMatchObject({ ok: true, stage: "subscribe" });

    const retained = await recordFunnelEvent(supabase, {
      prospect_id: "dpp_loop_1",
      stage: "retained",
      source: "direct",
    });
    expect(retained).toMatchObject({ ok: true, stage: "subscribe" });

    const visit = await recordFunnelEvent(supabase, {
      prospect_id: "dpp_loop_1",
      stage: "attributed_visit",
      source: "seo",
    });
    expect(visit).toMatchObject({
      ok: true,
      stage: "visit_landing_page",
      source: "seo",
    });
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
