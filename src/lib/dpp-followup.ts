/**
 * One deterministic follow-up for people who ask, on /dpp-check, to have their
 * result emailed to them.
 *
 * Why this exists: /dpp-check logs nothing about a visitor, so someone who
 * finishes the free check and does not open checkout is unreachable. The
 * result page now has an optional "email me this result" form. A row in
 * `lead_captures` with source `dpp-check` and product_interest
 * `dpp_check_followup` exists only if the visitor ticked the consent box, so
 * the row itself is the opt-in (recipient provenance `inbound_optin`).
 *
 * What it deliberately is not: an LLM closer. The older closer
 * (server/agents/closer.ts) writes free-text proposals at off-catalogue pilot
 * prices. This one sends a fixed template that names the plan exactly as
 * src/lib/plans.ts does, at most once per address, and every message still
 * goes through guardedSend (provenance, MX, postal address, opt-out, claims).
 */
import { DPP_LOOP_ORDER } from "./dpp-loop";
import { categoryById, type ReadinessBand } from "./dpp-readiness";
import { planById } from "./plans";

/** `lead_captures.source` for rows created by the /dpp-check opt-in form. */
export const DPP_OPTIN_SOURCE = "dpp-check";
/** `lead_captures.product_interest` marking a visitor who ticked the consent box. */
export const DPP_OPTIN_INTEREST = "dpp_check_followup";
/** `automation_logs.workflow_name` written once per follow-up that was sent. */
export const DPP_FOLLOWUP_WORKFLOW = "dpp_followup";

const BANDS: readonly ReadinessBand[] = [
  "not_started",
  "partly_ready",
  "mostly_ready",
];
const BAND_TEXT: Record<ReadinessBand, string> = {
  not_started: "Not started",
  partly_ready: "Partly ready",
  mostly_ready: "Mostly ready",
};

export interface DppOptInResult {
  category: string;
  score: number;
  band: ReadinessBand;
}

/**
 * The structured `message` stored with the lead: `dpp-check:<category>:<score>:<band>`.
 * It carries the shape of the result and nothing the visitor typed.
 */
export function dppOptInMessage(r: DppOptInResult): string {
  return `${DPP_OPTIN_SOURCE}:${r.category}:${Math.round(r.score)}:${r.band}`;
}

export function parseDppOptInMessage(
  message: string | null | undefined
): DppOptInResult | null {
  const m = /^dpp-check:([a-z0-9_]+):(\d{1,3}):([a-z_]+)$/.exec(
    (message ?? "").trim()
  );
  if (!m) return null;
  const score = Number(m[2]);
  const band = m[3] as ReadinessBand;
  if (score > 100 || !BANDS.includes(band) || !categoryById(m[1])) return null;
  return { category: m[1], score, band };
}

export interface DppFollowupEmail {
  subject: string;
  body: string;
}

export const DPP_CHECK_URL = "https://authichain.com/dpp-check";
export const DPP_CHECKOUT_URL = "https://authichain.com/checkout/dpp_readiness";

/**
 * Fixed template. Facts come from the stored result and from plans.ts; there
 * is no model call and no free text, so there is nothing here to hallucinate.
 */
export function buildDppFollowup(r: DppOptInResult): DppFollowupEmail {
  const category = categoryById(r.category);
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const name = plan?.name ?? "EU DPP Workspace";
  const generations = plan?.generations ?? 50;
  const label = category?.label ?? r.category;

  const lines = [
    "Hello,",
    "",
    "This is the email you asked for on the AuthiChain free EU DPP readiness check.",
    "",
    `Category: ${label}`,
    `Score: ${r.score}/100 (${BAND_TEXT[r.band]})`,
  ];
  if (category?.status === "law" && category.date) {
    lines.push(`Dated obligation: ${category.date}`);
  } else if (category?.status === "expected") {
    lines.push("Obligation: expected, not yet law for this category");
  }
  lines.push(
    "",
    `Your gaps and the sources behind them are on the check page, ready to reopen: ${DPP_CHECK_URL}?category=${encodeURIComponent(r.category)}&sells_in_eu=yes`,
    "",
    `If you want to try AuthiChain itself, the ${name} is a one-time $${price}: a self-serve workspace. ${DPP_CHECKOUT_URL}`,
    "It is not an audit, not a certification and not legal advice, and it does not register a product in EUDAMED.",
    "",
    "This is the only follow-up we will send. Replies go to hello@authichain.com.",
    "",
    "AuthiChain"
  );

  return {
    subject: `Your EU DPP readiness result: ${r.score}/100`,
    body: lines.join("\n"),
  };
}

export interface OptInRow {
  id?: number | string;
  email: string;
  source?: string | null;
  product_interest?: string | null;
  message?: string | null;
  created_at?: string | null;
}

export interface DueFollowup {
  email: string;
  result: DppOptInResult;
  createdAt: string;
}

export interface SelectOptions {
  now?: Date;
  /** Wait at least this long after the opt-in, so the email is not instant. */
  minAgeHours?: number;
  /** Do not email a stale opt-in. */
  maxAgeDays?: number;
  /** Cap per run. */
  limit?: number;
}

/**
 * Which opt-ins are due: right source and interest, a parseable result, old
 * enough, not stale, not already followed up. Oldest first, one per address.
 * `alreadySent` holds lower-cased addresses that have a logged follow-up or an
 * opt-out; anything in it is skipped.
 */
export function selectDueFollowups(
  rows: readonly OptInRow[],
  alreadySent: ReadonlySet<string>,
  opts: SelectOptions = {}
): DueFollowup[] {
  const now = (opts.now ?? new Date()).getTime();
  const minAge = (opts.minAgeHours ?? 4) * 3_600_000;
  const maxAge = (opts.maxAgeDays ?? 14) * 86_400_000;
  const seen = new Set<string>();
  const due: DueFollowup[] = [];

  const sorted = [...rows].sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  );
  for (const row of sorted) {
    if (row.source !== DPP_OPTIN_SOURCE) continue;
    if (row.product_interest !== DPP_OPTIN_INTEREST) continue;
    const email = (row.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email) || alreadySent.has(email)) continue;
    const result = parseDppOptInMessage(row.message);
    if (!result) continue;
    const created = Date.parse(row.created_at ?? "");
    if (!Number.isFinite(created)) continue;
    const age = now - created;
    if (age < minAge || age > maxAge) continue;
    seen.add(email);
    due.push({ email, result, createdAt: row.created_at as string });
    if (opts.limit !== undefined && due.length >= opts.limit) break;
  }
  return due;
}

/** `funnel_events.event_type` values for every loop stage after the first visit. */
export const DPP_PAST_CHECKOUT_EVENT_TYPES: readonly string[] =
  DPP_LOOP_ORDER.slice(1).map(stage => `dpp_loop:${stage}`);

/**
 * Addresses that have already started checkout or paid, taken from the
 * `funnel_events` rows of those stages. The follow-up is for people who have
 * not reached checkout: a buyer must never be pitched the thing they bought,
 * and an abandoned checkout already has its own recovery email.
 */
export function emailsPastCheckout(
  rows: readonly { metadata?: { email?: unknown } | null }[]
): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    const email = row?.metadata?.email;
    if (typeof email === "string" && email.trim()) {
      out.add(email.trim().toLowerCase());
    }
  }
  return out;
}
