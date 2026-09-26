import { describe, expect, it, vi } from "vitest";
import {
  DPP_PRICE_ID,
  dppActivateUrl,
  fetchAllLoopEvents,
  isDppDemoSession,
  isDppOffer,
  isDemoVisit,
  recordDppLoopEvent,
  recordEarnedRetention,
  runDppExceptionsReport,
  stallOf,
  summarizeDppLoop,
  reconstructLoop,
  type LoopEventRow,
} from "./dpp-loop";
import { DPP_OFFER_KEY } from "./plans";

/** In-memory funnel_events stand-in for retention writes and cron pagination. */
function fakeFunnel(seed: LoopEventRow[] = []) {
  const rows: Array<Record<string, unknown>> = seed.map(r => ({ ...r }));
  const from = () => {
    const filters: Array<[string, unknown]> = [];
    const builder: Record<string, unknown> = {
      insert: async (row: Record<string, unknown>) => {
        rows.push(row);
        return { error: null };
      },
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      like: () => builder,
      order: () => builder,
      limit: async () => ({
        data: rows.filter(r => filters.every(([c, v]) => r[c] === v)),
        error: null,
      }),
      range: async () => ({ data: [...rows], error: null }),
    };
    return builder;
  };
  return { supabase: { from }, rows };
}

function activatedRow(
  visitId: string,
  timestamp: string,
  extra: Record<string, unknown> = {}
): LoopEventRow {
  return {
    prospect_id: visitId,
    event_type: "dpp_loop:merchant_activated",
    timestamp,
    metadata: { loop_stage: "merchant_activated", ...extra },
  };
}

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
      "https://authichain.govchain.us/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc"
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

  it("records retained when activation plus usage past the horizon earn it", async () => {
    const activatedAt = "2026-09-01T00:00:00.000Z";
    const usageAt = "2026-09-09T10:00:00.000Z";
    const now = new Date("2026-09-20T00:00:00.000Z");
    const { supabase, rows: stored } = fakeFunnel();

    const result = await recordEarnedRetention(supabase, {
      rows: [activatedRow("paid_1", activatedAt)],
      usageByVisit: { paid_1: [usageAt] },
      now,
    });

    expect(result).toEqual([
      {
        visitId: "paid_1",
        recorded: true,
        reason: "usage_after_horizon",
        qualifyingUsageAt: usageAt,
        horizonAt: "2026-09-08T00:00:00.000Z",
      },
    ]);
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prospect_id: "paid_1",
          stage: "subscribe",
          event_type: "dpp_loop:retained",
          metadata: expect.objectContaining({
            loop_stage: "retained",
            qualifying_usage_at: usageAt,
          }),
        }),
      ])
    );
  });

  it("does not infer usage from loop rows", async () => {
    const activatedAt = "2026-09-01T00:00:00.000Z";
    const { supabase, rows: stored } = fakeFunnel();
    const result = await recordEarnedRetention(supabase, {
      rows: [
        activatedRow("paid_1", activatedAt),
        {
          prospect_id: "paid_1",
          event_type: "dpp_loop:verification",
          timestamp: "2026-09-09T10:00:00.000Z",
          metadata: { loop_stage: "verification" },
        },
      ],
      usageByVisit: {},
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    expect(result[0]).toMatchObject({
      visitId: "paid_1",
      recorded: false,
      reason: "no_usage_after_horizon",
    });
    expect(
      stored.filter(r => r.event_type === "dpp_loop:retained")
    ).toHaveLength(0);
  });

  it("does not record retained before the horizon or for same-day usage", async () => {
    const activatedAt = "2026-09-01T00:00:00.000Z";
    const { supabase, rows: stored } = fakeFunnel();

    const tooEarly = await recordEarnedRetention(supabase, {
      rows: [activatedRow("paid_1", activatedAt)],
      usageByVisit: { paid_1: ["2026-09-09T10:00:00.000Z"] },
      now: new Date("2026-09-02T00:00:00.000Z"),
    });
    expect(tooEarly[0]).toMatchObject({
      recorded: false,
      reason: "horizon_not_reached",
    });

    const sameDay = await recordEarnedRetention(supabase, {
      rows: [activatedRow("paid_2", activatedAt)],
      usageByVisit: { paid_2: ["2026-09-01T02:00:00.000Z"] },
      now: new Date("2026-09-20T00:00:00.000Z"),
    });
    expect(sameDay[0]).toMatchObject({
      recorded: false,
      reason: "no_usage_after_horizon",
    });
    expect(
      stored.filter(r => r.event_type === "dpp_loop:retained")
    ).toHaveLength(0);
  });

  it("records retained for DPP-SMOKE/demo visits that earned it", async () => {
    const usageAt = "2026-09-09T10:00:00.000Z";
    const { supabase, rows: stored } = fakeFunnel();
    const result = await recordEarnedRetention(supabase, {
      rows: [
        activatedRow("demo_1", "2026-09-01T00:00:00.000Z", { is_demo: true }),
      ],
      usageByVisit: { demo_1: [usageAt] },
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    expect(result[0]).toMatchObject({
      visitId: "demo_1",
      recorded: true,
      reason: "usage_after_horizon",
      qualifyingUsageAt: usageAt,
    });
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prospect_id: "demo_1",
          event_type: "dpp_loop:retained",
        }),
      ])
    );
  });

  it("closes the smoke loop the same day; paid buyers still wait the horizon", async () => {
    const activatedAt = "2026-09-20T12:00:00.000Z";
    const usageAt = "2026-09-20T13:00:00.000Z";
    const now = new Date("2026-09-20T14:00:00.000Z");
    const { supabase, rows: stored } = fakeFunnel();

    const smoke = await recordEarnedRetention(supabase, {
      rows: [activatedRow("dpp_smoke_1", activatedAt, { is_demo: true })],
      usageByVisit: { dpp_smoke_1: [usageAt] },
      now,
    });
    expect(smoke[0]).toMatchObject({
      visitId: "dpp_smoke_1",
      recorded: true,
      reason: "usage_after_horizon",
      qualifyingUsageAt: usageAt,
    });

    const paid = await recordEarnedRetention(supabase, {
      rows: [activatedRow("paid_1", activatedAt)],
      usageByVisit: { paid_1: [usageAt] },
      now,
    });
    expect(paid[0]).toMatchObject({
      visitId: "paid_1",
      recorded: false,
      reason: "horizon_not_reached",
    });
    expect(
      stored.filter(
        r => r.prospect_id === "paid_1" && r.event_type === "dpp_loop:retained"
      )
    ).toHaveLength(0);
  });

  it("does not write retained twice for a visit that already has it", async () => {
    const activatedAt = "2026-09-01T00:00:00.000Z";
    const { supabase, rows: stored } = fakeFunnel();
    const rows: LoopEventRow[] = [
      activatedRow("paid_1", activatedAt),
      {
        prospect_id: "paid_1",
        event_type: "dpp_loop:retained",
        timestamp: "2026-09-10T00:00:00.000Z",
        metadata: { loop_stage: "retained" },
      },
    ];

    const result = await recordEarnedRetention(supabase, {
      rows,
      usageByVisit: { paid_1: ["2026-09-09T10:00:00.000Z"] },
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    expect(result[0]).toMatchObject({
      visitId: "paid_1",
      recorded: false,
      reason: "already_retained",
    });
    expect(stored).toHaveLength(0);
  });

  it("exceptions cron records earned retained and reports the count", async () => {
    const seed: LoopEventRow[] = [
      activatedRow("paid_1", "2026-09-01T00:00:00.000Z"),
      {
        prospect_id: "paid_1",
        event_type: "dpp_loop:verification",
        timestamp: "2026-09-09T10:00:00.000Z",
        metadata: { loop_stage: "verification" },
      },
      activatedRow("demo_1", "2026-09-01T00:00:00.000Z", { is_demo: true }),
      {
        prospect_id: "demo_1",
        event_type: "dpp_loop:verification",
        timestamp: "2026-09-09T10:00:00.000Z",
        metadata: { loop_stage: "verification", is_demo: true },
      },
    ];
    const { supabase, rows: stored } = fakeFunnel(seed);
    const report = await runDppExceptionsReport(
      supabase,
      new Date("2026-09-20T00:00:00.000Z")
    );

    expect(report.ok).toBe(true);
    expect(report.retainedCount).toBe(2);
    expect(report.retained).toEqual(
      expect.arrayContaining([
        {
          visitId: "paid_1",
          qualifyingUsageAt: "2026-09-09T10:00:00.000Z",
        },
        {
          visitId: "demo_1",
          qualifyingUsageAt: "2026-09-09T10:00:00.000Z",
        },
      ])
    );
    expect(report.demoVisits).toBe(1);
    expect(report.visits).toBe(1);
    expect(
      stored.filter(r => r.event_type === "dpp_loop:retained")
    ).toHaveLength(2);
  });
});

describe("dppExceptionAlert", () => {
  it("builds a send-ready founder alert from a paid stall (no live send)", async () => {
    const { dppExceptionAlert } = await import("./dpp-loop");
    const alert = dppExceptionAlert({
      visitId: "term_esc_1",
      furthest: "payment_succeeded",
      stall: {
        kind: "exception",
        stalledAt: "payment_succeeded",
        nextExpected: "provisioned",
        hours: 3.25,
        reason: "threshold_exceeded",
        holes: [],
      },
    });
    expect(alert.kind).toBe("draft");
    expect(alert.title).toContain("term_esc_1");
    expect(alert.title).toContain("payment_succeeded");
    expect(alert.subject).toContain("term_esc_1");
    expect(alert.text).toContain("provisioned");
    expect(alert.text).toContain("threshold_exceeded");
    // publishFounderAlert accepts this shape with fetch stubbed — the
    // report → alert → fan-out path stays covered without secrets.
    const { publishFounderAlert } = await import("./founder-alerts");
    const { NTFY_URL } = await import("./founder-alerts");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await publishFounderAlert(alert);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(NTFY_URL);
    expect(String(fetchMock.mock.calls[0][1].body)).toContain("term_esc_1");
  });
});
