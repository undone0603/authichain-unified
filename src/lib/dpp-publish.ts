/**
 * POST /api/dpp/publish — insert a products row, then record dpp_published.
 * Shared by Next and worker-app so apex checkout origin can finish the loop.
 */

import { recordDppLoopEventOnce } from "./dpp-loop";

export type DppPublishInput = {
  visit_id?: unknown;
  name?: unknown;
  brand?: unknown;
  category?: unknown;
  serial_number?: unknown;
  gtin?: unknown;
  markets?: unknown;
  source?: unknown;
};

export type DppPublishOk = {
  ok: true;
  dpp_id: string;
  visit_id: string;
  event_recorded: boolean;
  verify_url: string;
};

export type DppPublishErr = {
  ok: false;
  status: 400 | 409 | 500;
  error: string;
  detail?: string;
};

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export async function publishDpp(opts: {
  body: DppPublishInput;
  supabase: SupabaseLike | null;
}): Promise<DppPublishOk | DppPublishErr> {
  const visitId = String(opts.body.visit_id || "").trim();
  const name = String(opts.body.name || "").trim();

  if (!visitId) {
    return { ok: false, status: 400, error: "visit_id required" };
  }
  if (!name) {
    return { ok: false, status: 400, error: "name required" };
  }
  if (!opts.supabase) {
    return { ok: false, status: 500, error: "Database not configured" };
  }

  const { data: activated } = await opts.supabase
    .from("funnel_events")
    .select("id, metadata")
    .eq("prospect_id", visitId)
    .eq("event_type", "dpp_loop:merchant_activated")
    .limit(1);

  if (!Array.isArray(activated) || activated.length === 0) {
    return {
      ok: false,
      status: 409,
      error: "not_activated",
      detail: "No merchant_activated event for this visit.",
    };
  }

  const profileId =
    (activated[0]?.metadata as { profile_id?: string } | undefined)?.profile_id ??
    null;

  const publishedAt = new Date().toISOString();
  const dppPayload = {
    name,
    brand: String(opts.body.brand || "").trim() || null,
    category: String(opts.body.category || "").trim() || null,
    serial_number: String(opts.body.serial_number || "").trim() || null,
    status: "published",
    metadata: {
      dpp: true,
      offer: "dpp_readiness_2026",
      visit_id: visitId,
      gtin: String(opts.body.gtin || "").trim() || null,
      markets: opts.body.markets ?? null,
      published_at: publishedAt,
    },
  };

  const { data: inserted, error } = await opts.supabase
    .from("products")
    .insert(dppPayload)
    .select("id")
    .single();

  if (error || !inserted?.id) {
    console.error("[dpp/publish] insert failed:", error);
    return {
      ok: false,
      status: 500,
      error: "publish_failed",
      detail: error?.message ?? "no row returned",
    };
  }

  const dppId = inserted.id as string;
  const { recorded } = await recordDppLoopEventOnce(opts.supabase, {
    visitId,
    stage: "dpp_published",
    source: String(opts.body.source || "direct"),
    profileId,
    dedupeKey: `dpp:${dppId}`,
    metadata: {
      dpp_id: dppId,
      product_name: name,
      gtin: dppPayload.metadata.gtin,
      published_at: publishedAt,
    },
  });

  return {
    ok: true,
    dpp_id: dppId,
    visit_id: visitId,
    event_recorded: recorded,
    verify_url: `/api/dpp/verify?dpp_id=${encodeURIComponent(dppId)}&visit_id=${encodeURIComponent(visitId)}`,
  };
}
