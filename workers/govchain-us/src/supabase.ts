/**
 * Read-only Supabase access for the govchain.us edge worker.
 *
 * Talks to PostgREST over plain fetch rather than @supabase/supabase-js: this
 * Worker is deployed standalone (see the repo's "workers are self-contained"
 * rule), and the client library pulls in far more than two GETs need.
 *
 * The key used here is the ANON key, which is public by design — it is shipped
 * in browsers on every Supabase project. That makes row-level security the only
 * thing standing between these queries and the table, so `gov_opportunities`
 * and `gov_proposals` must have an RLS policy granting `anon` SELECT on the
 * columns below. Without one PostgREST answers 200 with an empty array, not an
 * error, so an empty feed here means "no policy" at least as often as it means
 * "no rows" — hence `configured()` and the explicit 503 at the call sites,
 * which at least separate "not wired up" from "nothing to show".
 */

export interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

/**
 * One federal opportunity.
 *
 * Column names follow what the pipeline actually writes — `scripts/ingest-sam.ts`
 * upserts `deadline`/`sam_url`/`status`, and `scripts/score-opportunities.ts`
 * adds `fit_score`/`ai_reasoning`/`recommended_action`. Note `deadline`, not the
 * `due_date` in migration 00008: the ingest script writes the former, so that is
 * the column with data in it.
 */
export interface GovOpportunity {
  notice_id: string;
  title: string | null;
  agency: string | null;
  deadline: string | null;
  naics_code: string | null;
  fit_score: number | null;
  sam_url: string | null;
  status: string | null;
  ai_reasoning: string | null;
  estimated_value: number | null;
  description: string | null;
}

export interface GovStats {
  opportunities_scored: number;
  high_fit: number;
  proposals_drafted: number;
}

const LIST_COLUMNS =
  "notice_id,title,agency,deadline,naics_code,fit_score,sam_url,status";
const DETAIL_COLUMNS = `${LIST_COLUMNS},ai_reasoning,estimated_value,description`;

/** True when both vars are present, i.e. a query is worth attempting. */
export function configured(env: SupabaseEnv): boolean {
  return Boolean(env?.SUPABASE_URL && env?.SUPABASE_ANON_KEY);
}

export class SupabaseUnavailable extends Error {}

async function restGet(
  env: SupabaseEnv,
  path: string,
  query: string,
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  if (!configured(env)) {
    throw new SupabaseUnavailable(
      "SUPABASE_URL / SUPABASE_ANON_KEY are not set"
    );
  }
  let base = env.SUPABASE_URL!;
  while (base.endsWith("/")) base = base.slice(0, -1);
  const key = env.SUPABASE_ANON_KEY!;
  const res = await fetch(`${base}/rest/v1/${path}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...extraHeaders,
    },
  });
  if (!res.ok) {
    throw new SupabaseUnavailable(`Supabase responded ${res.status}`);
  }
  return res;
}

/**
 * Scored opportunities at or above `minFit`, soonest deadline first.
 *
 * Ordering is `deadline.asc.nullslast` so an opportunity with no deadline sinks
 * rather than heading the list — a null sorts first in Postgres ascending order
 * by default, which would put the least actionable rows on top.
 */
export async function fetchOpportunities(
  env: SupabaseEnv,
  opts: { minFit?: number; limit?: number } = {}
): Promise<GovOpportunity[]> {
  const minFit = Number.isFinite(opts.minFit) ? Number(opts.minFit) : 70;
  const limit = Math.min(Math.max(Number(opts.limit) || 12, 1), 100);
  const query = [
    `select=${LIST_COLUMNS}`,
    `fit_score=gte.${minFit}`,
    "order=deadline.asc.nullslast",
    `limit=${limit}`,
  ].join("&");
  const res = await restGet(env, "gov_opportunities", query);
  const rows = (await res.json()) as GovOpportunity[];
  return Array.isArray(rows) ? rows : [];
}

/** A single opportunity by its SAM notice id, or null when there is no such row. */
export async function fetchOpportunity(
  env: SupabaseEnv,
  noticeId: string
): Promise<GovOpportunity | null> {
  const query = [
    `select=${DETAIL_COLUMNS}`,
    `notice_id=eq.${encodeURIComponent(noticeId)}`,
    "limit=1",
  ].join("&");
  const res = await restGet(env, "gov_opportunities", query);
  const rows = (await res.json()) as GovOpportunity[];
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/**
 * Reads an exact row count without transferring the rows.
 *
 * `Prefer: count=exact` plus a single-row Range makes PostgREST report the full
 * match count in Content-Range (`0-0/123`), so a count of 40,000 rows costs one
 * row of body.
 */
async function countRows(
  env: SupabaseEnv,
  table: string,
  filter?: string
): Promise<number> {
  const query = ["select=notice_id", filter, "limit=1"]
    .filter(Boolean)
    .join("&");
  const res = await restGet(env, table, query, {
    Prefer: "count=exact",
    Range: "0-0",
  });
  const total = res.headers.get("content-range")?.split("/")[1];
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The three counters the homepage stats bar reads. */
export async function fetchStats(env: SupabaseEnv): Promise<GovStats> {
  const [scored, highFit, proposals] = await Promise.all([
    countRows(env, "gov_opportunities", "fit_score=not.is.null"),
    countRows(env, "gov_opportunities", "fit_score=gte.70"),
    countRows(env, "gov_proposals"),
  ]);
  return {
    opportunities_scored: scored,
    high_fit: highFit,
    proposals_drafted: proposals,
  };
}
