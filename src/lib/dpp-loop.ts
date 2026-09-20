/**
 * Autonomous DPP revenue-loop event recording.
 *
 * Maps loop stages onto existing funnel_events enum values and stores the
 * canonical loop stage in metadata.loop_stage so smoke/reporting can reconstruct
 * attributed_visit → … → retained without a schema migration.
 */

import { DPP_OFFER_KEY } from "./plans";

export type DppLoopStage =
  | "attributed_visit"
  | "checkout_started"
  | "payment_succeeded"
  | "provisioned"
  | "merchant_activated"
  | "dpp_published"
  | "verification"
  | "retained";

type FunnelStage =
  "visit_landing_page" | "start_checkout" | "complete_checkout" | "subscribe";

const STAGE_TO_FUNNEL: Record<DppLoopStage, FunnelStage> = {
  attributed_visit: "visit_landing_page",
  checkout_started: "start_checkout",
  payment_succeeded: "complete_checkout",
  provisioned: "complete_checkout",
  merchant_activated: "subscribe",
  dpp_published: "subscribe",
  verification: "subscribe",
  retained: "subscribe",
};

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export interface RecordDppLoopEventInput {
  visitId: string;
  stage: DppLoopStage;
  source?: string;
  email?: string | null;
  profileId?: string | null;
  stripeSessionId?: string | null;
  metadata?: Record<string, unknown>;
}

function normalizeSource(
  source: string | undefined
):
  | "seo"
  | "direct"
  | "email"
  | "affiliate"
  | "linkedin_post"
  | "reddit_post"
  | "gov_engine" {
  const allowed = new Set([
    "gov_engine",
    "linkedin_post",
    "reddit_post",
    "seo",
    "direct",
    "email",
    "affiliate",
  ]);
  if (source && allowed.has(source)) {
    return source as
      | "seo"
      | "direct"
      | "email"
      | "affiliate"
      | "linkedin_post"
      | "reddit_post"
      | "gov_engine";
  }
  return "direct";
}

/** Persist one observable loop stage. Never throws — logging only on failure. */
export async function recordDppLoopEvent(
  supabase: SupabaseLike,
  input: RecordDppLoopEventInput
): Promise<void> {
  const visitId = input.visitId?.trim();
  if (!visitId) return;

  try {
    const { error } = await supabase.from("funnel_events").insert({
      prospect_id: visitId,
      stage: STAGE_TO_FUNNEL[input.stage],
      source: normalizeSource(input.source),
      event_type: `dpp_loop:${input.stage}`,
      metadata: {
        offer: DPP_OFFER_KEY,
        loop_stage: input.stage,
        ...(input.email ? { email: input.email } : {}),
        ...(input.profileId ? { profile_id: input.profileId } : {}),
        ...(input.stripeSessionId
          ? { stripe_session_id: input.stripeSessionId }
          : {}),
        ...(input.metadata || {}),
      },
      timestamp: new Date().toISOString(),
    });
    if (error) {
      console.error("[dpp-loop] record failed:", input.stage, error);
    }
  } catch (err) {
    console.error("[dpp-loop] record failed:", input.stage, err);
  }
}

/** Canonical order of the loop. Index position is the stage's rank. */
export const DPP_LOOP_ORDER: readonly DppLoopStage[] = [
  "attributed_visit",
  "checkout_started",
  "payment_succeeded",
  "provisioned",
  "merchant_activated",
  "dpp_published",
  "verification",
  "retained",
] as const;

/**
 * Days after activation before a return visit counts as retention.
 *
 * A buyer clicking around on day 0 is finishing onboarding, not returning.
 * Retention must be earned by a dated usage event at or beyond this horizon.
 */
export const RETENTION_HORIZON_DAYS = 7;

export type LoopEventRow = {
  prospect_id?: string | null;
  event_type?: string | null;
  timestamp?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Page size for reconstructing the loop. Never use a single hard cap. */
export const LOOP_EVENT_PAGE_SIZE = 1000;

const PAID_INDEX = DPP_LOOP_ORDER.indexOf("payment_succeeded");

/**
 * How long a paid stage may sit without the next event before it is an
 * exception. Bounce/abandon stages have no threshold: they are funnel counts.
 */
export const STALL_THRESHOLDS_MS: Partial<Record<DppLoopStage, number>> = {
  payment_succeeded: 2 * 3_600_000,
  provisioned: 24 * 3_600_000,
  merchant_activated: 72 * 3_600_000,
  dpp_published: 24 * 3_600_000,
  verification: RETENTION_HORIZON_DAYS * 86_400_000,
};

export type StallReport = {
  kind: "funnel" | "exception" | null;
  stalledAt: DppLoopStage | null;
  nextExpected: DppLoopStage | null;
  hours: number | null;
  reason: string;
  holes: DppLoopStage[];
};

function hoursSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Decide whether a reconstructed loop is a bounce (funnel), a paid stall
 * (founder exception), or still in-flight.
 *
 * Holes (a later stage without a prior required stage) are exceptions once
 * payment has succeeded — they mean an event is not being recorded.
 */
export function stallOf(
  loop: LoopReconstruction,
  now: Date = new Date()
): StallReport {
  if (loop.complete) {
    return {
      kind: null,
      stalledAt: null,
      nextExpected: null,
      hours: null,
      reason: "complete",
      holes: [],
    };
  }

  if (!loop.furthest) {
    return {
      kind: null,
      stalledAt: null,
      nextExpected: "attributed_visit",
      hours: null,
      reason: "no_events",
      holes: [],
    };
  }

  const furthestIdx = DPP_LOOP_ORDER.indexOf(loop.furthest);
  const paid = furthestIdx >= PAID_INDEX;
  const holes = loop.missing.filter(s => {
    const i = DPP_LOOP_ORDER.indexOf(s);
    // Only paid-chain gaps are holes. Missing visit/checkout is bounce, not a stall.
    return i < furthestIdx && i >= PAID_INDEX;
  });
  const hours = hoursSince(loop.firstSeen[loop.furthest], now);
  const ageMs = hours === null ? 0 : hours * 3_600_000;
  const nextAfterFurthest = DPP_LOOP_ORDER[furthestIdx + 1] ?? null;

  if (holes.length) {
    return {
      kind: paid ? "exception" : "funnel",
      stalledAt: holes[0],
      nextExpected: holes[0],
      hours,
      reason: "missing_prior_stage",
      holes,
    };
  }

  const threshold = STALL_THRESHOLDS_MS[loop.furthest];
  if (threshold == null) {
    return {
      kind: "funnel",
      stalledAt: loop.furthest,
      nextExpected: nextAfterFurthest,
      hours,
      reason: "awaiting_next",
      holes: [],
    };
  }

  if (ageMs >= threshold) {
    return {
      kind: paid ? "exception" : "funnel",
      stalledAt: loop.furthest,
      nextExpected: nextAfterFurthest,
      hours,
      reason: "threshold_exceeded",
      holes: [],
    };
  }

  return {
    kind: null,
    stalledAt: null,
    nextExpected: nextAfterFurthest,
    hours,
    reason: "within_threshold",
    holes: [],
  };
}

export function isDemoVisit(rows: LoopEventRow[]): boolean {
  return rows.some(row => {
    const meta = row.metadata;
    return meta?.is_demo === true || meta?.demo === true;
  });
}

export type DppException = {
  visitId: string;
  furthest: DppLoopStage | null;
  stall: StallReport;
};

export type DppLoopSummary = {
  visits: number;
  demoVisits: number;
  funnel: Partial<Record<DppLoopStage | "none", number>>;
  exceptions: DppException[];
};

export function summarizeDppLoop(
  rows: LoopEventRow[],
  now: Date = new Date()
): DppLoopSummary {
  const byVisit = new Map<string, LoopEventRow[]>();
  for (const row of rows || []) {
    const id = row.prospect_id?.trim();
    if (!id) continue;
    const list = byVisit.get(id) || [];
    list.push(row);
    byVisit.set(id, list);
  }

  const funnel: Partial<Record<DppLoopStage | "none", number>> = {};
  const exceptions: DppException[] = [];
  let visits = 0;
  let demoVisits = 0;

  for (const [visitId, visitRows] of byVisit) {
    if (isDemoVisit(visitRows)) {
      demoVisits += 1;
      continue;
    }
    visits += 1;
    const loop = reconstructLoop(visitRows);
    const stall = stallOf(loop, now);
    const bucket = loop.furthest ?? "none";
    funnel[bucket] = (funnel[bucket] || 0) + 1;
    if (stall.kind === "exception") {
      exceptions.push({ visitId, furthest: loop.furthest, stall });
    }
  }

  return { visits, demoVisits, funnel, exceptions };
}

export async function fetchAllLoopEvents(
  supabase: SupabaseLike
): Promise<LoopEventRow[]> {
  const all: LoopEventRow[] = [];
  let from = 0;
  for (;;) {
    const to = from + LOOP_EVENT_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("funnel_events")
      .select("prospect_id, event_type, timestamp, metadata")
      .like("event_type", "dpp_loop:%")
      .order("timestamp", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    all.push(...batch);
    if (batch.length < LOOP_EVENT_PAGE_SIZE) break;
    from += LOOP_EVENT_PAGE_SIZE;
  }
  return all;
}

/** Stage recorded on a funnel_events row, or null if it is not a loop event. */
export function stageOf(row: LoopEventRow): DppLoopStage | null {
  const fromMeta = row?.metadata?.loop_stage;
  if (
    typeof fromMeta === "string" &&
    DPP_LOOP_ORDER.includes(fromMeta as DppLoopStage)
  ) {
    return fromMeta as DppLoopStage;
  }
  const type = row?.event_type || "";
  if (type.startsWith("dpp_loop:")) {
    const candidate = type.slice("dpp_loop:".length);
    if (DPP_LOOP_ORDER.includes(candidate as DppLoopStage))
      return candidate as DppLoopStage;
  }
  return null;
}

export type LoopReconstruction = {
  reached: DppLoopStage[];
  missing: DppLoopStage[];
  furthest: DppLoopStage | null;
  complete: boolean;
  firstSeen: Partial<Record<DppLoopStage, string>>;
};

/**
 * Rebuild the loop from raw funnel_events rows.
 *
 * Reports only what the events actually show. A stage is never inferred from a
 * later stage being present: if `verification` exists without `dpp_published`,
 * the gap is reported rather than backfilled, because a hole there means an
 * event is genuinely not being recorded.
 */
export function reconstructLoop(rows: LoopEventRow[]): LoopReconstruction {
  const firstSeen: Partial<Record<DppLoopStage, string>> = {};
  for (const row of rows || []) {
    const stage = stageOf(row);
    if (!stage) continue;
    const ts = row.timestamp || "";
    const prior = firstSeen[stage];
    if (!prior || (ts && ts < prior)) firstSeen[stage] = ts;
  }
  const reached = DPP_LOOP_ORDER.filter(s => firstSeen[s] !== undefined);
  const missing = DPP_LOOP_ORDER.filter(s => firstSeen[s] === undefined);
  return {
    reached,
    missing,
    furthest: reached.length ? reached[reached.length - 1] : null,
    complete: missing.length === 0,
    firstSeen,
  };
}

/**
 * Record a stage at most once per (visit, stage, dedupeKey).
 *
 * Returns whether it wrote. Provisioning and webhooks can fire more than once;
 * the loop must not report two publications because Stripe retried a delivery.
 */
export async function recordDppLoopEventOnce(
  supabase: SupabaseLike,
  input: RecordDppLoopEventInput & { dedupeKey?: string }
): Promise<{ recorded: boolean; reason?: string }> {
  const visitId = input.visitId?.trim();
  if (!visitId) return { recorded: false, reason: "no_visit_id" };

  try {
    const { data } = await supabase
      .from("funnel_events")
      .select("id, metadata")
      .eq("prospect_id", visitId)
      .eq("event_type", `dpp_loop:${input.stage}`)
      .limit(25);

    const key = input.dedupeKey;
    const duplicate = Array.isArray(data)
      ? data.some((row: { metadata?: Record<string, unknown> }) =>
          key ? row?.metadata?.dedupe_key === key : true
        )
      : false;

    if (duplicate) return { recorded: false, reason: "already_recorded" };
  } catch (err) {
    // Read failure must not block the write: a missing event is worse than a
    // duplicate one, and duplicates are visible in reporting.
    console.error("[dpp-loop] dedupe check failed:", input.stage, err);
  }

  await recordDppLoopEvent(supabase, {
    ...input,
    metadata: {
      ...(input.metadata || {}),
      ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}),
    },
  });
  return { recorded: true };
}

/**
 * Decide whether a buyer has earned `retained`.
 *
 * Requires an activation to anchor the horizon and a dated usage event at or
 * after it. Returns the reason when it declines, so the smoke run and the daily
 * report can show why a buyer is not retained instead of silently omitting them.
 */
export function evaluateRetention(
  rows: LoopEventRow[],
  usageTimestamps: string[],
  now: Date = new Date(),
  horizonDays: number = RETENTION_HORIZON_DAYS
): {
  retained: boolean;
  reason: string;
  horizonAt?: string;
  qualifyingUsageAt?: string;
} {
  const loop = reconstructLoop(rows);
  const activatedAt = loop.firstSeen.merchant_activated;
  if (!activatedAt) return { retained: false, reason: "not_activated" };

  const horizon = new Date(
    new Date(activatedAt).getTime() + horizonDays * 86_400_000
  );
  const horizonAt = horizon.toISOString();

  if (now < horizon)
    return { retained: false, reason: "horizon_not_reached", horizonAt };

  const qualifying = (usageTimestamps || [])
    .filter(t => t && new Date(t) >= horizon)
    .sort()[0];

  if (!qualifying)
    return { retained: false, reason: "no_usage_after_horizon", horizonAt };
  return {
    retained: true,
    reason: "usage_after_horizon",
    horizonAt,
    qualifyingUsageAt: qualifying,
  };
}

/** Dated product usage — not activation, payment, or onboarding clicks. */
const USAGE_STAGES: ReadonlySet<DppLoopStage> = new Set([
  "dpp_published",
  "verification",
]);

/**
 * Collect usage timestamps per visit from publish/verify events.
 *
 * These stay a separate list from the loop rows so `evaluateRetention` can
 * reject same-day onboarding. Presence of `verification` is not retention.
 */
export function usageTimestampsByVisit(
  rows: LoopEventRow[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const row of rows || []) {
    const id = row.prospect_id?.trim();
    const stage = stageOf(row);
    if (!id || !stage || !USAGE_STAGES.has(stage)) continue;
    const ts = row.timestamp;
    if (!ts) continue;
    (out[id] ||= []).push(ts);
  }
  return out;
}

export type RetentionWrite = {
  visitId: string;
  recorded: boolean;
  reason: string;
  qualifyingUsageAt?: string;
  horizonAt?: string;
};

/**
 * Write `dpp_loop:retained` for visits that have earned it.
 *
 * Usage timestamps are supplied by the caller (cron collects publish/verify
 * times; tests pass fixtures). Demo visits and visits that already have
 * `retained` are skipped. Idempotent via `recordDppLoopEventOnce`.
 */
export async function recordEarnedRetention(
  supabase: SupabaseLike,
  opts: {
    rows: LoopEventRow[];
    usageByVisit: Record<string, string[]>;
    now?: Date;
  }
): Promise<RetentionWrite[]> {
  const now = opts.now ?? new Date();
  const out: RetentionWrite[] = [];

  for (const [visitId, visitRows] of Object.entries(
    groupLoopEventsByVisit(opts.rows)
  )) {
    if (isDemoVisit(visitRows)) {
      out.push({ visitId, recorded: false, reason: "demo" });
      continue;
    }

    const loop = reconstructLoop(visitRows);
    if (loop.firstSeen.retained) {
      out.push({ visitId, recorded: false, reason: "already_retained" });
      continue;
    }

    const decision = evaluateRetention(
      visitRows,
      opts.usageByVisit[visitId] || [],
      now
    );
    if (!decision.retained) {
      out.push({
        visitId,
        recorded: false,
        reason: decision.reason,
        horizonAt: decision.horizonAt,
      });
      continue;
    }

    const write = await recordDppLoopEventOnce(supabase, {
      visitId,
      stage: "retained",
      metadata: {
        qualifying_usage_at: decision.qualifyingUsageAt,
        horizon_at: decision.horizonAt,
        retention_reason: decision.reason,
      },
    });
    out.push({
      visitId,
      recorded: write.recorded,
      reason: write.recorded
        ? decision.reason
        : (write.reason ?? decision.reason),
      qualifyingUsageAt: decision.qualifyingUsageAt,
      horizonAt: decision.horizonAt,
    });
  }

  return out;
}

export type DppExceptionsReport = {
  ok: true;
  generatedAt: string;
  visits: number;
  demoVisits: number;
  funnel: DppLoopSummary["funnel"];
  exceptionCount: number;
  exceptions: DppException[];
  retainedCount: number;
  retained: Array<{ visitId: string; qualifyingUsageAt?: string }>;
};

/**
 * Daily DPP exception report + retained auto-write.
 *
 * Shared by Next and worker-app GET `/api/cron/dpp-exceptions`.
 */
export async function runDppExceptionsReport(
  supabase: SupabaseLike,
  now: Date = new Date()
): Promise<DppExceptionsReport> {
  const rows = await fetchAllLoopEvents(supabase);
  const retention = await recordEarnedRetention(supabase, {
    rows,
    usageByVisit: usageTimestampsByVisit(rows),
    now,
  });
  const recorded = retention.filter(r => r.recorded);
  const summary = summarizeDppLoop(
    [
      ...rows,
      ...recorded.map(r => ({
        prospect_id: r.visitId,
        event_type: "dpp_loop:retained" as const,
        timestamp: now.toISOString(),
        metadata: { loop_stage: "retained" },
      })),
    ],
    now
  );

  return {
    ok: true,
    generatedAt: now.toISOString(),
    visits: summary.visits,
    demoVisits: summary.demoVisits,
    funnel: summary.funnel,
    exceptionCount: summary.exceptions.length,
    exceptions: summary.exceptions,
    retainedCount: recorded.length,
    retained: recorded.map(r => ({
      visitId: r.visitId,
      qualifyingUsageAt: r.qualifyingUsageAt,
    })),
  };
}

/** Adapter used by `scripts/revenue-cycle.ts --phase=report`. */
export type LoopStall = {
  visitId: string;
  furthest: DppLoopStage | null;
  nextExpected: DppLoopStage | null;
  hoursStalled: number;
};

export function groupLoopEventsByVisit(
  rows: LoopEventRow[]
): Record<string, LoopEventRow[]> {
  const out: Record<string, LoopEventRow[]> = {};
  for (const row of rows || []) {
    const id = (row.prospect_id || "").trim();
    if (!id) continue;
    (out[id] ||= []).push(row);
  }
  return out;
}

/** Paid exceptions only — bounce/abandon and demos are omitted. */
export function findStalledLoops(
  visits: Record<string, LoopEventRow[]>,
  now: Date = new Date()
): LoopStall[] {
  return summarizeDppLoop(Object.values(visits).flat(), now)
    .exceptions.map(e => ({
      visitId: e.visitId,
      furthest: e.furthest,
      nextExpected: e.stall.nextExpected,
      hoursStalled: Math.round((e.stall.hours ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.hoursStalled - a.hoursStalled);
}

/** Live Stripe price for EU DPP Readiness Audit ($299). */
export const DPP_PRICE_ID = "price_1TwmD8GqTruSqV8TpAF8dfyA";

/** Query/promo code that creates a $0 Checkout session (no live charge). */
export const DPP_SMOKE_PROMO = "DPP-SMOKE-E2E";

export function isDppSmokePromo(value: string | null | undefined): boolean {
  return (value || "").trim().toUpperCase() === DPP_SMOKE_PROMO;
}

/**
 * Stripe metadata flag for DPP-SMOKE / $0 checkout. Demo may skip Resend
 * and customer-funnel counts. It must never skip fulfill or access grant.
 * Stripe metadata is stringly typed (`"true"`), so accept both forms.
 */
export function isDppDemoSession(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  const demo = metadata?.is_demo ?? metadata?.demo;
  if (demo === true || demo === "true" || demo === "1") return true;
  return isDppSmokePromo(String(metadata?.promo || ""));
}

export function isDppOffer(
  metadata: Record<string, unknown> | null | undefined,
  priceId?: string | null
): boolean {
  const offer = String(metadata?.offer || metadata?.offer_key || "");
  const plan = String(metadata?.plan || "");
  if (offer === DPP_OFFER_KEY || plan === "dpp_readiness") return true;
  if (priceId && priceId === DPP_PRICE_ID) return true;
  return false;
}

export function dppActivateUrl(
  sessionId: string,
  visitId?: string | null
): string {
  const base = "https://authichain.com/dpp/activate";
  const params = new URLSearchParams({ session_id: sessionId });
  if (visitId) params.set("visit_id", visitId);
  return `${base}?${params.toString()}`;
}
