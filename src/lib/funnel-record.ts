/**
 * Shared POST /api/funnel insert.
 *
 * The DPP landing (`workers/authichain-com`) posts attributed_visit here.
 * Next `src/app/api/funnel/route.ts` is not mounted on authichain-edge-router;
 * worker-app must call this helper or the first loop stage 404s.
 *
 * DPP loop aliases (`dpp_published` / `verification` / `retained` /
 * `attributed_visit`) map onto the funnel_events enum. Product insert +
 * verify still live in Next `/api/dpp/publish` and `/api/dpp/verify`
 * (not mounted on the edge).
 */

export const FUNNEL_STAGES = [
  "proposal_sent",
  "email_opened",
  "link_clicked",
  "visit_landing_page",
  "start_checkout",
  "complete_checkout",
  "subscribe",
] as const;

export const FUNNEL_SOURCES = [
  "gov_engine",
  "linkedin_post",
  "reddit_post",
  "seo",
  "direct",
  "email",
  "affiliate",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export type FunnelSource = (typeof FUNNEL_SOURCES)[number];

/** DPP loop stages the edge funnel hook accepts without a new mount. */
export const DPP_FUNNEL_STAGE_ALIASES = {
  attributed_visit: "visit_landing_page",
  dpp_published: "subscribe",
  verification: "subscribe",
  retained: "subscribe",
} as const;

export type DppFunnelStageAlias = keyof typeof DPP_FUNNEL_STAGE_ALIASES;

export type FunnelEventInput = {
  prospect_id?: unknown;
  stage?: unknown;
  source?: unknown;
  event_type?: unknown;
  metadata?: unknown;
};

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type FunnelRecordOk = {
  ok: true;
  prospect_id: string;
  stage: FunnelStage;
  source: FunnelSource;
};
export type FunnelRecordErr = {
  ok: false;
  status: 400 | 500;
  error: string;
  detail?: string;
};
export type FunnelRecordResult = FunnelRecordOk | FunnelRecordErr;

function isFunnelStage(value: string): value is FunnelStage {
  return (FUNNEL_STAGES as readonly string[]).includes(value);
}

function isFunnelSource(value: string): value is FunnelSource {
  return (FUNNEL_SOURCES as readonly string[]).includes(value);
}

export async function recordFunnelEvent(
  supabase: SupabaseLike | null | undefined,
  body: FunnelEventInput
): Promise<FunnelRecordResult> {
  const prospectId =
    typeof body.prospect_id === "string" ? body.prospect_id.trim() : "";
  const rawStage = typeof body.stage === "string" ? body.stage.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";

  if (!prospectId || !rawStage || !source) {
    return {
      ok: false,
      status: 400,
      error: "Missing required fields: prospect_id, stage, source",
    };
  }

  const alias =
    rawStage in DPP_FUNNEL_STAGE_ALIASES
      ? (rawStage as DppFunnelStageAlias)
      : null;
  const stage: FunnelStage | string = alias
    ? DPP_FUNNEL_STAGE_ALIASES[alias]
    : rawStage;

  if (!isFunnelStage(stage)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid stage. Must be one of: ${FUNNEL_STAGES.join(", ")}, or DPP aliases ${Object.keys(DPP_FUNNEL_STAGE_ALIASES).join(", ")}`,
    };
  }
  if (!isFunnelSource(source)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid source. Must be one of: ${FUNNEL_SOURCES.join(", ")}`,
    };
  }
  if (!supabase) {
    return {
      ok: false,
      status: 500,
      error: "Funnel store is not configured",
    };
  }

  const eventType =
    typeof body.event_type === "string"
      ? body.event_type
      : alias
        ? `dpp_loop:${alias}`
        : null;
  const metadata =
    body.metadata &&
    typeof body.metadata === "object" &&
    !Array.isArray(body.metadata)
      ? { ...(body.metadata as Record<string, unknown>) }
      : {};
  if (alias && metadata.loop_stage == null) {
    metadata.loop_stage = alias;
  }

  const { error } = await supabase.from("funnel_events").insert({
    prospect_id: prospectId,
    stage,
    source,
    event_type: eventType,
    metadata,
    timestamp: new Date().toISOString(),
  });

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to record funnel event",
      detail: error.message,
    };
  }

  return { ok: true, prospect_id: prospectId, stage, source };
}
