import { describe, expect, it, vi } from "vitest";
import {
  DPP_PRICE_ID,
  dppActivateUrl,
  fetchAllLoopEvents,
  isDppDemoSession,
  isDppOffer,
  isDemoVisit,
  recordDppLoopEvent,
  stallOf,
  summarizeDppLoop,
  reconstructLoop,
} from "./dpp-loop";
import { DPP_OFFER_KEY } from "./plans";

describe("dpp-loop", () => {
  it("detects offer by metadata and price id", () => {
    expect(isDppOffer({ offer: DPP_OFFER_KEY })).toBe(true);
    expect(isDppOffer({ plan: "dpp_readiness" })).toBe(true);
    expect(isDppOffer({}, DPP_PRICE_ID)).toBe(true);
    expect(isDppOffer({ plan: "starter" })).toBe(false);
  });

  it("detects demo/smoke metadata without treating it as a non-offer", () => {
    expect(isDppDemoSession({ is_demo: "true" })).toBe(true);
    expect(isDppDemoSession({ is_demo: true })).toBe(true);
    expect(isDppDemoSession({ promo: "DPP-SMOKE-E2E" })).toBe(true);
    expect(isDppDemoSession({ offer: DPP_OFFER_KEY })).toBe(false);
    expect(isDppOffer({ offer: DPP_OFFER_KEY, is_demo: "true" })).toBe(true);
  });

  it("builds activate URL with session and visit", () => {
    expect(dppActivateUrl("cs_test_1", "dpp_abc")).toBe(
      "https://authichain.com/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc"
    );
  });

  it("records loop events onto funnel_events with loop_stage metadata", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({ insert })),
    };

    await recordDppLoopEvent(supabase, {
      visitId: "dpp_visit_1",
      stage: "provisioned",
      source: "seo",
      email: "buyer@example.com",
      profileId: "prof_1",
      stripeSessionId: "cs_123",
    });

    expect(supabase.from).toHaveBeenCalledWith("funnel_events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        prospect_id: "dpp_visit_1",
        stage: "complete_checkout",
        source: "seo",
        event_type: "dpp_loop:provisioned",
        metadata: expect.objectContaining({
          offer: DPP_OFFER_KEY,
          loop_stage: "provisioned",
          email: "buyer@example.com",
          profile_id: "prof_1",
          stripe_session_id: "cs_123",
        }),
      })
    );
  });

  it("does not treat bounce/abandon as founder exceptions", () => {
    const visitOnly = reconstructLoop([
      {
        event_type: "dpp_loop:attributed_visit",
        timestamp: "2026-09-01T00:00:00.000Z",
        metadata: { loop_stage: "attributed_visit" },
      },
    ]);
    const visitStall = stallOf(visitOnly, new Date("2026-09-03T00:00:00.000Z"));
    expect(visitStall.kind).toBe("funnel");
    expect(visitStall.stalledAt).toBe("attributed_visit");

    const checkout = reconstructLoop([
      {
        event_type: "dpp_loop:checkout_started",
        timestamp: "2026-09-01T00:00:00.000Z",
        metadata: { loop_stage: "checkout_started" },
      },
    ]);
    const checkoutStall = stallOf(
      checkout,
      new Date("2026-09-01T12:00:00.000Z")
    );
    expect(checkoutStall.kind).toBe("funnel");
    expect(checkoutStall.stalledAt).toBe("checkout_started");
  });

  it("reports an exception after payment when provisioning never arrives", () => {
    const loop = reconstructLoop([
      {
        event_type: "dpp_loop:payment_succeeded",
        timestamp: "2026-09-01T00:00:00.000Z",
        metadata: { loop_stage: "payment_succeeded" },
      },
    ]);
    const stall = stallOf(loop, new Date("2026-09-01T03:00:00.000Z"));
    expect(stall.kind).toBe("exception");
    expect(stall.stalledAt).toBe("payment_succeeded");
    expect(stall.nextExpected).toBe("provisioned");
    expect(stall.reason).toBe("threshold_exceeded");
  });

  it("flags a hole when a later stage is recorded without a prior required stage", () => {
    const loop = reconstructLoop([
      {
        event_type: "dpp_loop:payment_succeeded",
        timestamp: "2026-09-01T00:00:00.000Z",
        metadata: { loop_stage: "payment_succeeded" },
      },
      {
        event_type: "dpp_loop:verification",
        timestamp: "2026-09-02T00:00:00.000Z",
        metadata: { loop_stage: "verification" },
      },
    ]);
    const stall = stallOf(loop, new Date("2026-09-03T00:00:00.000Z"));
    expect(stall.kind).toBe("exception");
    expect(stall.reason).toBe("missing_prior_stage");
    expect(stall.holes).toContain("dpp_published");
    expect(stall.nextExpected).toBe("provisioned");
  });

  it("does not stall a paid visit still inside its threshold", () => {
    const loop = reconstructLoop([
      {
        event_type: "dpp_loop:payment_succeeded",
        timestamp: "2026-09-01T00:00:00.000Z",
        metadata: { loop_stage: "payment_succeeded" },
      },
    ]);
    const stall = stallOf(loop, new Date("2026-09-01T00:30:00.000Z"));
    expect(stall.kind).toBeNull();
    expect(stall.reason).toBe("within_threshold");
  });

  it("excludes demo visits from exception and customer funnel counts", () => {
    const rows = [
      {
        prospect_id: "demo_1",
        event_type: "dpp_loop:payment_succeeded",
        timestamp: "2026-09-01T00:00:00.000Z",
        metadata: { loop_stage: "payment_succeeded", is_demo: true },
      },
      {
        prospect_id: "paid_1",
        event_type: "dpp_loop:payment_succeeded",
        timestamp: "2026-09-01T00:00:00.000Z",
        metadata: { loop_stage: "payment_succeeded" },
      },
    ];
    expect(isDemoVisit(rows.slice(0, 1))).toBe(true);
    const summary = summarizeDppLoop(
      rows,
      new Date("2026-09-01T04:00:00.000Z")
    );
    expect(summary.visits).toBe(1);
    expect(summary.exceptions).toHaveLength(1);
    expect(summary.exceptions[0].visitId).toBe("paid_1");
    expect(summary.demoVisits).toBe(1);
  });

  it("pages through funnel_events instead of a single limit(5000)", async () => {
    const pages: number[] = [];
    const supabase = {
      from: () => ({
        select: () => ({
          like: () => ({
            order: () => ({
              range: async (from: number, to: number) => {
                pages.push(to - from + 1);
                if (from === 0) {
                  return {
                    data: Array.from({ length: 1000 }, (_, i) => ({
                      prospect_id: `v${i}`,
                      event_type: "dpp_loop:attributed_visit",
                      timestamp: "2026-09-01T00:00:00.000Z",
                      metadata: { loop_stage: "attributed_visit" },
                    })),
                    error: null,
                  };
                }
                return {
                  data: [
                    {
                      prospect_id: "v1000",
                      event_type: "dpp_loop:attributed_visit",
                      timestamp: "2026-09-01T00:00:00.000Z",
                      metadata: { loop_stage: "attributed_visit" },
                    },
                  ],
                  error: null,
                };
              },
            }),
          }),
        }),
      }),
    };

    const rows = await fetchAllLoopEvents(supabase);
    expect(rows).toHaveLength(1001);
    expect(pages[0]).toBe(1000);
    expect(pages.length).toBeGreaterThan(1);
  });
});
