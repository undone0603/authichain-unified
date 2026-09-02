import { describe, expect, it, vi } from "vitest";
import {
  DPP_PRICE_ID,
  dppActivateUrl,
  isDppOffer,
  recordDppLoopEvent,
} from "./dpp-loop";
import { DPP_OFFER_KEY } from "./plans";

describe("dpp-loop", () => {
  it("detects offer by metadata and price id", () => {
    expect(isDppOffer({ offer: DPP_OFFER_KEY })).toBe(true);
    expect(isDppOffer({ plan: "dpp_readiness" })).toBe(true);
    expect(isDppOffer({}, DPP_PRICE_ID)).toBe(true);
    expect(isDppOffer({ plan: "starter" })).toBe(false);
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
});
