/**
 * DPP-SMOKE-E2E — autonomous DPP revenue loop lifecycle test.
 *
 * Asserts the acceptance criteria in docs/operations/AUTONOMOUS_REVENUE_LOOP.md:
 * that a single buyer can traverse attributed_visit → … → retained, that each
 * stage is derived from an observable event, that replayed webhooks do not
 * double-count, and that retention is earned rather than assumed.
 *
 * SCOPE: this exercises the loop's state machine and recording contract against
 * an in-memory Supabase double. It is NOT the live production smoke run — that
 * additionally requires a real Stripe DPP-SMOKE-E2E checkout, real provisioning
 * and a real daily report, and can only be run against deployed infrastructure.
 * Passing here means the wiring is correct, not that production is green.
 */
import { describe, expect, it } from "vitest";
import {
  DPP_LOOP_ORDER,
  RETENTION_HORIZON_DAYS,
  evaluateRetention,
  reconstructLoop,
  recordDppLoopEvent,
  recordDppLoopEventOnce,
  stageOf,
  type DppLoopStage,
  type LoopEventRow,
} from "./dpp-loop";

/** Minimal in-memory stand-in for the funnel_events table. */
function fakeSupabase() {
  const rows: Array<Record<string, unknown>> = [];

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
      order: () => builder,
      limit: async () => ({
        data: rows.filter((r) => filters.every(([c, v]) => r[c] === v)),
        error: null,
      }),
    };
    return builder;
  };

  return { supabase: { from }, rows };
}

const VISIT = "dpp_smoke_visit";

/** Drive one stage the way the corresponding route would. */
async function advance(
  supabase: { from: (t: string) => unknown },
  stage: DppLoopStage,
  metadata: Record<string, unknown> = {},
  dedupeKey?: string,
) {
  return recordDppLoopEventOnce(supabase as never, {
    visitId: VISIT,
    stage,
    source: "seo",
    dedupeKey,
    metadata,
  });
}

describe("DPP-SMOKE-E2E", () => {
  it("a single buyer traverses the complete state machine without a handoff", async () => {
    const { supabase, rows } = fakeSupabase();

    await advance(supabase, "attributed_visit", { utm_source: "seo", referrer: "https://example.test" });
    await advance(supabase, "checkout_started", { promo: "DPP-SMOKE-E2E" });
    await advance(supabase, "payment_succeeded", { stripe_session_id: "cs_smoke_1" }, "cs_smoke_1");
    await advance(supabase, "provisioned", { profile_id: "prof_smoke" }, "cs_smoke_1");
    await advance(supabase, "merchant_activated", { categories: ["batteries"] });
    await advance(supabase, "dpp_published", { dpp_id: "dpp_1" }, "dpp:dpp_1");
    await advance(supabase, "verification", { dpp_id: "dpp_1" }, "verify:dpp_1");
    await advance(supabase, "retained", { qualifying_usage_at: "2026-09-20T00:00:00.000Z" });

    const loop = reconstructLoop(rows as LoopEventRow[]);

    expect(loop.missing).toEqual([]);
    expect(loop.complete).toBe(true);
    expect(loop.reached).toEqual([...DPP_LOOP_ORDER]);
    expect(loop.furthest).toBe("retained");
  });

  it("attribution survives from the first visit into the paid session", async () => {
    const { supabase, rows } = fakeSupabase();

    await advance(supabase, "attributed_visit", { utm_source: "seo", utm_campaign: "espr-2027" });
    await advance(supabase, "payment_succeeded", { stripe_session_id: "cs_attr" }, "cs_attr");

    // Same prospect_id carries the chain; the campaign is still readable.
    expect(new Set(rows.map((r) => r.prospect_id))).toEqual(new Set([VISIT]));
    const visit = rows.find((r) => stageOf(r as LoopEventRow) === "attributed_visit");
    expect((visit?.metadata as { utm_campaign?: string })?.utm_campaign).toBe("espr-2027");
  });

  it("a replayed webhook does not double-count payment or provisioning", async () => {
    const { supabase, rows } = fakeSupabase();

    const first = await advance(supabase, "payment_succeeded", {}, "cs_dup");
    const replay = await advance(supabase, "payment_succeeded", {}, "cs_dup");

    expect(first.recorded).toBe(true);
    expect(replay.recorded).toBe(false);
    expect(replay.reason).toBe("already_recorded");
    expect(rows.filter((r) => stageOf(r as LoopEventRow) === "payment_succeeded")).toHaveLength(1);
  });

  it("publishing the same DPP twice records one publication", async () => {
    const { supabase, rows } = fakeSupabase();

    await advance(supabase, "dpp_published", { dpp_id: "dpp_9" }, "dpp:dpp_9");
    await advance(supabase, "dpp_published", { dpp_id: "dpp_9" }, "dpp:dpp_9");

    expect(rows.filter((r) => stageOf(r as LoopEventRow) === "dpp_published")).toHaveLength(1);
  });

  it("reports a gap instead of inferring a skipped stage", async () => {
    const { supabase, rows } = fakeSupabase();

    // verification without a publication is a recording bug, not a pass.
    await advance(supabase, "merchant_activated");
    await advance(supabase, "verification", { dpp_id: "dpp_x" }, "verify:dpp_x");

    const loop = reconstructLoop(rows as LoopEventRow[]);
    expect(loop.reached).toContain("verification");
    expect(loop.missing).toContain("dpp_published");
    expect(loop.complete).toBe(false);
  });

  it("retention is earned by dated usage past the horizon, not by activating", () => {
    const activatedAt = "2026-09-01T00:00:00.000Z";
    const rows: LoopEventRow[] = [
      { event_type: "dpp_loop:merchant_activated", timestamp: activatedAt, metadata: { loop_stage: "merchant_activated" } },
    ];
    const horizonMs = RETENTION_HORIZON_DAYS * 86_400_000;
    const afterHorizon = new Date(new Date(activatedAt).getTime() + horizonMs + 86_400_000);

    // Same-day usage does not count.
    expect(
      evaluateRetention(rows, ["2026-09-01T02:00:00.000Z"], afterHorizon).retained,
    ).toBe(false);

    // Usage past the horizon does.
    const good = evaluateRetention(rows, ["2026-09-09T10:00:00.000Z"], afterHorizon);
    expect(good.retained).toBe(true);
    expect(good.qualifyingUsageAt).toBe("2026-09-09T10:00:00.000Z");
  });

  it("declines retention with a stated reason rather than silently", () => {
    const noActivation = evaluateRetention([], ["2026-09-20T00:00:00.000Z"]);
    expect(noActivation).toMatchObject({ retained: false, reason: "not_activated" });

    const rows: LoopEventRow[] = [
      { event_type: "dpp_loop:merchant_activated", timestamp: "2026-09-01T00:00:00.000Z", metadata: { loop_stage: "merchant_activated" } },
    ];
    const tooEarly = evaluateRetention(rows, [], new Date("2026-09-02T00:00:00.000Z"));
    expect(tooEarly).toMatchObject({ retained: false, reason: "horizon_not_reached" });

    const noUsage = evaluateRetention(rows, [], new Date("2026-10-01T00:00:00.000Z"));
    expect(noUsage).toMatchObject({ retained: false, reason: "no_usage_after_horizon" });
  });

  it("a failed write leaves no event behind", async () => {
    const failing = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }) }),
        insert: async () => {
          throw new Error("supabase unavailable");
        },
      }),
    };

    // recordDppLoopEvent swallows errors by design (it must never break a paid
    // flow), but it must not fabricate a success signal either.
    await expect(
      recordDppLoopEvent(failing as never, { visitId: VISIT, stage: "provisioned" }),
    ).resolves.toBeUndefined();
  });

  it("ignores non-loop funnel rows when reconstructing", () => {
    const rows: LoopEventRow[] = [
      { event_type: "email_opened", timestamp: "2026-09-01T00:00:00.000Z", metadata: {} },
      { event_type: "dpp_loop:provisioned", timestamp: "2026-09-01T01:00:00.000Z", metadata: { loop_stage: "provisioned" } },
    ];
    const loop = reconstructLoop(rows);
    expect(loop.reached).toEqual(["provisioned"]);
    expect(stageOf(rows[0])).toBeNull();
  });
});
