import { describe, expect, it, vi } from "vitest";
import {
  DPP_PRICE_ID,
  classifyRetrievedDppCheckout,
  countEconomicStates,
  dppActivateUrl,
  fetchAllLoopEvents,
  dppSmokeRequestAuthorized,
  isDppDemoSession,
  isDppOffer,
  isDemoVisit,
  recordDppLoopEvent,
  recordDppLoopEventOnce,
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
  it("strict activation event insertion fails closed when storage rejects a write", async () => {
    const from = vi.fn(() => ({
      insert: async () => ({ error: { message: "db sensitive details" } }),
    }));
    await expect(
      recordDppLoopEvent(
        { from },
        { visitId: "visit_1", stage: "merchant_activated", stripeSessionId: "cs_test_1" },
        { strict: true },
      )
    ).rejects.toThrow("DPP event storage unavailable");
    expect(from).toHaveBeenCalledWith("funnel_events");
  });

  it("optional analytics loop writes still do not block application flow", async () => {
    const from = vi.fn(() => ({
      insert: async () => ({ error: { message: "db unavailable" } }),
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(recordDppLoopEvent(
        { from },
        { visitId: "visit_1", stage: "attributed_visit" },
      )).resolves.toBeUndefined();
    } finally {
      log.mockRestore();
    }
  });


  it.each(["returned error", "thrown error"])(
    "does not claim event_recorded when the analytics insert fails (%s)",
    async failure => {
      const insert = vi.fn(async () => {
        if (failure === "thrown error") throw new Error("database unavailable");
        return { error: { message: "database unavailable" } };
      });
      const query = {
        select: () => query,
        eq: () => query,
        contains: () => query,
        limit: async () => ({ data: [], error: null }),
        insert,
      };
      const from = vi.fn(() => query);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const result = await recordDppLoopEventOnce(
          { from },
          { visitId: "visit_write_failed", stage: "dpp_published", dedupeKey: "dpp_1" }
        );
        expect(result).toEqual({ recorded: false, reason: "storage_unavailable" });
        expect(insert).toHaveBeenCalledTimes(1);
      } finally {
        log.mockRestore();
      }
    }
  );

  it("reports event_recorded only after a successful analytics insert", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const query = {
      select: () => query,
      eq: () => query,
      contains: () => query,
      limit: async () => ({ data: [], error: null }),
      insert,
    };
    const result = await recordDppLoopEventOnce(
      { from: () => query },
      { visitId: "visit_written", stage: "verification", dedupeKey: "dpp_2" }
    );
    expect(result).toEqual({ recorded: true });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("dedupes a checkout beyond 25 prior events using an exact database filter", async () => {
    const rows = [
      ...Array.from({ length: 30 }, (_, i) => ({
        prospect_id: "visit_many",
        event_type: "dpp_loop:payment_succeeded",
        metadata: { dedupe_key: `cs_other_${i}` },
      })),
      {
        prospect_id: "visit_many",
        event_type: "dpp_loop:payment_succeeded",
        metadata: { dedupe_key: "cs_target" },
      },
    ];
    const filters: Array<[string, string]> = [];
    let exactKey: string | undefined;
    const insert = vi.fn(async () => ({ error: null }));
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        filters.push([column, value]);
        return query;
      },
      contains: vi.fn((column: string, value: { dedupe_key: string }) => {
        expect(column).toBe("metadata");
        exactKey = value.dedupe_key;
        return query;
      }),
      limit: vi.fn(async (n: number) => ({
        data: rows
          .filter(row =>
            filters.every(([column, value]) =>
              row[column as "prospect_id" | "event_type"] === value
            )
          )
          .filter(row => !exactKey || row.metadata.dedupe_key === exactKey)
          .slice(0, n),
        error: null,
      })),
      insert,
    };
    const from = vi.fn(() => query);
    const result = await recordDppLoopEventOnce(
      { from },
      { visitId: "visit_many", stage: "payment_succeeded", dedupeKey: "cs_target" }
    );
    expect(result).toEqual({ recorded: false, reason: "already_recorded" });
    expect(query.contains).toHaveBeenCalledWith("metadata", {
      dedupe_key: "cs_target",
    });
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it("detects offer by metadata and price id", () => {
    expect(isDppOffer({ offer: DPP_OFFER_KEY })).toBe(true);
    expect(isDppOffer({ plan: "dpp_readiness" })).toBe(true);
    expect(isDppOffer({}, DPP_PRICE_ID)).toBe(true);
    expect(isDppOffer({ plan: "starter" })).toBe(false);
  });

  it("authorizes the smoke promo only with a matching secret", () => {
    const secret = "smoke-secret-value";
    expect(dppSmokeRequestAuthorized(secret, secret)).toBe(true);
    expect(dppSmokeRequestAuthorized("smoke-secret-other", secret)).toBe(false);
    expect(dppSmokeRequestAuthorized(secret, "short")).toBe(false);
    expect(dppSmokeRequestAuthorized(secret, "")).toBe(false);
    expect(dppSmokeRequestAuthorized(secret, null)).toBe(false);
    expect(dppSmokeRequestAuthorized(null, secret)).toBe(false);
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

  it("encodes untrusted visit attribution within the canonical activation URL", () => {
    const link = dppActivateUrl("cs_test_1", "</script><script>alert(1)</script>");
    const parsed = new URL(link);
    expect(parsed.origin).toBe("https://authichain.com");
    expect(parsed.pathname).toBe("/dpp/activate");
    expect(parsed.searchParams.get("session_id")).toBe("cs_test_1");
    expect(parsed.searchParams.get("visit_id")).toBe("</script><script>alert(1)</script>");
    expect(link).not.toContain("<script>");
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

  it("does not count fully discounted DPP checkouts as paying customers without demo metadata", () => {
    const zeroCash = {
      prospect_id: "discounted_1",
      event_type: "dpp_loop:payment_succeeded",
      timestamp: "2026-09-16T00:00:00.000Z",
      metadata: { loop_stage: "payment_succeeded", amount_total: 0 },
    };
    const collectedCash = {
      prospect_id: "customer_1",
      event_type: "dpp_loop:payment_succeeded",
      timestamp: "2026-09-16T00:00:00.000Z",
      metadata: { loop_stage: "payment_succeeded", amount_total: 29900 },
    };
    expect(isDemoVisit([zeroCash])).toBe(true);
    expect(isDemoVisit([collectedCash])).toBe(false);
    expect(isDemoVisit([{
      ...zeroCash,
      event_type: "dpp_loop:checkout_started",
      metadata: { loop_stage: "checkout_started", amount_total: 0 },
    }])).toBe(false);
    const summary = summarizeDppLoop([zeroCash, collectedCash]);
    expect(summary.demoVisits).toBe(1);
    expect(summary.visits).toBe(1);
    expect(summary.funnel.payment_succeeded).toBe(1);
    const economic = countEconomicStates([zeroCash, collectedCash]);
    expect(economic.demoVisits).toBe(1);
    expect(economic.visits).toBe(1);
    expect(economic.reached.PAID).toBe(1);
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

describe("economic state", () => {
  function loopRow(
    visit: string,
    stage: string,
    metadata: Record<string, unknown> = {}
  ): LoopEventRow {
    return {
      prospect_id: visit,
      event_type: `dpp_loop:${stage}`,
      timestamp: "2026-10-01T00:00:00.000Z",
      metadata: { loop_stage: stage, ...metadata },
    };
  }

  it("reports the highest evidenced state and does not invent churn", async () => {
    const { economicStateOf, reconstructLoop } = await import("./dpp-loop");
    const paid = reconstructLoop([
      loopRow("v", "attributed_visit"),
      loopRow("v", "checkout_started"),
      loopRow("v", "payment_succeeded"),
    ]);
    expect(economicStateOf(paid)).toBe("PAID");
    expect(economicStateOf(reconstructLoop([]))).toBeNull();
    const published = reconstructLoop([
      loopRow("v", "dpp_published"),
      loopRow("v", "verification"),
    ]);
    expect(economicStateOf(published)).toBe("FIRST_VALUE");
  });

  it("names the largest drop and leaves demos out", async () => {
    const { countEconomicStates } = await import("./dpp-loop");
    const report = countEconomicStates([
      loopRow("a", "attributed_visit"),
      loopRow("b", "attributed_visit"),
      loopRow("b", "checkout_started"),
      loopRow("c", "attributed_visit"),
      loopRow("c", "checkout_started"),
      loopRow("c", "payment_succeeded", { amount_total: 29900 }),
      loopRow("demo", "attributed_visit", { demo: true }),
      loopRow("demo", "payment_succeeded", { demo: true }),
    ]);
    expect(report.visits).toBe(3);
    expect(report.demoVisits).toBe(1);
    expect(report.reached.VISITOR).toBe(3);
    expect(report.reached.CHECKOUT_STARTED).toBe(2);
    expect(report.reached.PAID).toBe(1);
    expect(report.reached.RETAINED).toBe(0);
    expect(report.leak).toEqual({
      from: "PAID",
      to: "PROVISIONED",
      entered: 1,
      continued: 0,
      drop: 1,
    });
  });

  it("keeps zero-cash and unknown-total checkouts out of the paid economic funnel", () => {
    const rows = [
      loopRow("unknown", "attributed_visit"),
      loopRow("unknown", "checkout_started"),
      loopRow("unknown", "payment_succeeded"),
      loopRow("unknown", "provisioned"),
      loopRow("zero", "attributed_visit"),
      loopRow("zero", "payment_succeeded", { amount_total: 0 }),
      loopRow("zero", "provisioned"),
      loopRow("genuine", "attributed_visit"),
      loopRow("genuine", "checkout_started"),
      loopRow("genuine", "payment_succeeded", { amount_total: 29900 }),
      loopRow("genuine", "provisioned"),
    ];
    const result = countEconomicStates(rows);
    // A complimentary workspace can be granted, but it isn't cash revenue.
    // An unknown payment total must remain unverified for revenue reporting.
    expect(result.demoVisits).toBe(1);
    expect(result.visits).toBe(2);
    expect(result.reached.CHECKOUT_STARTED).toBe(2);
    expect(result.reached.PAID).toBe(1);
    expect(result.reached.PROVISIONED).toBe(1);
  });

  it("does not accept negative, fractional or string totals as cash evidence", () => {
    for (const amount_total of [-100, 0.1, "29900", null, undefined]) {
      const result = countEconomicStates([
        loopRow("uncertain", "attributed_visit"),
        loopRow("uncertain", "payment_succeeded", { amount_total }),
        loopRow("uncertain", "merchant_activated"),
      ]);
      expect(result.reached.PAID).toBe(0);
      expect(result.reached.ACTIVATED).toBe(0);
    }
  });

  it("keeps a larger top-of-funnel drop ahead of a smaller paid drop", async () => {
    const { largestFunnelLeak } = await import("./dpp-loop");
    expect(
      largestFunnelLeak({
        VISITOR: 10,
        CHECKOUT_STARTED: 2,
        PAID: 1,
        PROVISIONED: 1,
        ACTIVATED: 1,
        FIRST_VALUE: 1,
        RETAINED: 1,
      })
    ).toEqual({
      from: "VISITOR",
      to: "CHECKOUT_STARTED",
      entered: 10,
      continued: 2,
      drop: 8,
    });
    expect(largestFunnelLeak({})).toBeNull();
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

describe("classifyRetrievedDppCheckout (authoritative line items)", () => {
  const paid = {
    status: "complete",
    payment_status: "paid",
    mode: "payment",
    metadata: { offer: DPP_OFFER_KEY, plan: "dpp_readiness" },
    line_items: {
      data: [{ price: { id: DPP_PRICE_ID }, quantity: 1 }],
      has_more: false,
    },
  };

  it("accepts only the canonical single-unit DPP price", () => {
    expect(classifyRetrievedDppCheckout(paid)).toBe("dpp");
    expect(
      classifyRetrievedDppCheckout({
        ...paid,
        metadata: {},
      })
    ).toBe("dpp");
  });

  it("holds a forged DPP offer with another $299 price", () => {
    expect(
      classifyRetrievedDppCheckout({
        ...paid,
        line_items: { data: [{ price: { id: "price_other_299" } }] },
      })
    ).toBe("reconciliation_required");
  });

  it("holds absent, paginated, and mixed line-item evidence", () => {
    expect(
      classifyRetrievedDppCheckout({ ...paid, line_items: undefined })
    ).toBe("reconciliation_required");
    expect(
      classifyRetrievedDppCheckout({
        ...paid,
        line_items: { ...paid.line_items, has_more: true },
      })
    ).toBe("reconciliation_required");
    expect(
      classifyRetrievedDppCheckout({
        ...paid,
        line_items: {
          data: [
            { price: { id: DPP_PRICE_ID } },
            { price: { id: "price_other" } },
          ],
        },
      })
    ).toBe("reconciliation_required");
  });

  it("holds subscription, conflicting plan, and multiple units", () => {
    expect(
      classifyRetrievedDppCheckout({ ...paid, mode: "subscription" })
    ).toBe("reconciliation_required");
    expect(
      classifyRetrievedDppCheckout({
        ...paid,
        metadata: { plan: "other_plan" },
      })
    ).toBe("reconciliation_required");
    expect(
      classifyRetrievedDppCheckout({
        ...paid,
        line_items: {
          data: [{ price: { id: DPP_PRICE_ID }, quantity: 2 }],
        },
      })
    ).toBe("reconciliation_required");
  });

  it("holds missing, null, zero or fractional DPP item quantity", () => {
    for (const quantity of [undefined, null, 0, 0.5, 2]) {
      expect(classifyRetrievedDppCheckout({
        ...paid,
        line_items: { data: [{ price: { id: DPP_PRICE_ID }, quantity }], has_more: false },
      })).toBe("reconciliation_required");
    }
    expect(classifyRetrievedDppCheckout(paid)).toBe("dpp");
  });

  it("never authorizes complete-but-unpaid or open-but-paid", () => {
    expect(
      classifyRetrievedDppCheckout({ ...paid, payment_status: "unpaid" })
    ).toBe("not_paid");
    expect(
      classifyRetrievedDppCheckout({ ...paid, status: "open" })
    ).toBe("not_paid");
  });

  it("leaves unrelated paid catalog SKUs to their own fulfillment path", () => {
    expect(
      classifyRetrievedDppCheckout({
        ...paid,
        metadata: { plan: "starter" },
        line_items: { data: [{ price: { id: "price_starter" } }] },
      })
    ).toBe("other");
  });
});

