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
    await supabase.from("funnel_events").insert({
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
  event_type?: string | null;
  timestamp?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Stage recorded on a funnel_events row, or null if it is not a loop event. */
export function stageOf(row: LoopEventRow): DppLoopStage | null {
  const fromMeta = row?.metadata?.loop_stage;
  if (typeof fromMeta === "string" && DPP_LOOP_ORDER.includes(fromMeta as DppLoopStage)) {
    return fromMeta as DppLoopStage;
  }
  const type = row?.event_type || "";
  if (type.startsWith("dpp_loop:")) {
    const candidate = type.slice("dpp_loop:".length);
    if (DPP_LOOP_ORDER.includes(candidate as DppLoopStage)) return candidate as DppLoopStage;
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
  const reached = DPP_LOOP_ORDER.filter((s) => firstSeen[s] !== undefined);
  const missing = DPP_LOOP_ORDER.filter((s) => firstSeen[s] === undefined);
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
  input: RecordDppLoopEventInput & { dedupeKey?: string },
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
          key ? row?.metadata?.dedupe_key === key : true,
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
    metadata: { ...(input.metadata || {}), ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}) },
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
  horizonDays: number = RETENTION_HORIZON_DAYS,
): { retained: boolean; reason: string; horizonAt?: string; qualifyingUsageAt?: string } {
  const loop = reconstructLoop(rows);
  const activatedAt = loop.firstSeen.merchant_activated;
  if (!activatedAt) return { retained: false, reason: "not_activated" };

  const horizon = new Date(new Date(activatedAt).getTime() + horizonDays * 86_400_000);
  const horizonAt = horizon.toISOString();

  if (now < horizon) return { retained: false, reason: "horizon_not_reached", horizonAt };

  const qualifying = (usageTimestamps || [])
    .filter((t) => t && new Date(t) >= horizon)
    .sort()[0];

  if (!qualifying) return { retained: false, reason: "no_usage_after_horizon", horizonAt };
  return { retained: true, reason: "usage_after_horizon", horizonAt, qualifyingUsageAt: qualifying };
}

/** Live Stripe price for EU DPP Readiness Audit ($299). */
export const DPP_PRICE_ID = "price_1TwmD8GqTruSqV8TpAF8dfyA";

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
