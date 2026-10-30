/**
 * Revenue-proof totals. Derived from funnel_events at read time.
 * Do not persist a stored total.
 */

import {
  isDemoVisit,
  reconstructLoop,
  stageOf,
  type LoopEventRow,
} from "./dpp-loop";

export const REVENUE_PROOF_SIGNALS = [
  "verification_requests",
  "verified_objects",
  "failed_counterfeit_review",
  "checkout_visits",
  "stripe_conversions",
  "activated_merchants",
  "provisioning_success",
  "retained_merchants",
  "revenue_by_surface",
  "failed_autonomous_actions",
] as const;

/**
 * What a visit is, for the purpose of counting revenue.
 *  - demo: the loop marked it `is_demo` / `demo` (smoke checkout, demo promo).
 *  - test: a row carries Stripe `livemode: false`.
 *  - founder: a row carries an email on the founder list.
 * Only `real` visits count toward any signal. One class per visit, in the
 * order above, so the excluded counts partition the visits.
 */
export type VisitClass = "real" | "demo" | "test" | "founder";

/** Founder entries are exact emails, or "@domain" to cover a whole domain. */
function matchesFounder(email: unknown, founders: Set<string>): boolean {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!e) return false;
  if (founders.has(e)) return true;
  const at = e.lastIndexOf("@");
  return at >= 0 && founders.has(e.slice(at));
}

export function classifyVisit(
  visitRows: LoopEventRow[],
  founderEmails: readonly string[] = []
): VisitClass {
  if (isDemoVisit(visitRows)) return "demo";
  if (visitRows.some(r => r.metadata?.livemode === false)) return "test";
  const founders = new Set(
    founderEmails.map(e => e.trim().toLowerCase()).filter(Boolean)
  );
  if (
    founders.size > 0 &&
    visitRows.some(r => matchesFounder(r.metadata?.email, founders))
  ) {
    return "founder";
  }
  return "real";
}

export type RevenueProof = {
  generated_at: string;
  verification_requests: number;
  verified_objects: number;
  failed_counterfeit_review: number;
  checkout_visits: number;
  stripe_conversions: number;
  activated_merchants: number;
  provisioning_success: number;
  retained_merchants: number;
  /** Count of payment_succeeded loop events by surface. Not Stripe cash. */
  revenue_by_surface: Record<string, number>;
  failed_autonomous_actions: number;
  /** Visits in the window that count toward the signals above. */
  visit_count: number;
  /** Visits left out of every count above, by reason. */
  excluded: { demo: number; test: number; founder: number };
};

export type BuildRevenueProofOptions = {
  /** Exact emails, or "@domain" entries. Empty means no founder exclusion. */
  founderEmails?: readonly string[];
};

export type AttestationDecisionRow = { decision?: string | null };
export type AutomationLogRow = { status?: string | null };

export function buildRevenueProof(
  rows: LoopEventRow[],
  automationLogs: AutomationLogRow[] = [],
  attestations: AttestationDecisionRow[] = [],
  now: Date = new Date(),
  options: BuildRevenueProofOptions = {}
): RevenueProof {
  const byVisit = new Map<string, LoopEventRow[]>();
  for (const row of rows ?? []) {
    const id = String(
      (row as LoopEventRow & { prospect_id?: string }).prospect_id ?? "unknown"
    );
    const list = byVisit.get(id) ?? [];
    list.push(row);
    byVisit.set(id, list);
  }

  let verification_requests = 0;
  let verified_objects = 0;
  let checkout_visits = 0;
  let stripe_conversions = 0;
  let activated_merchants = 0;
  let provisioning_success = 0;
  let retained_merchants = 0;
  const revenue_by_surface: Record<string, number> = {};
  const excluded = { demo: 0, test: 0, founder: 0 };
  let visit_count = 0;

  for (const [, visitRows] of byVisit) {
    const kind = classifyVisit(visitRows, options.founderEmails);
    if (kind !== "real") {
      excluded[kind] += 1;
      continue;
    }
    visit_count += 1;
    const loop = reconstructLoop(visitRows);
    if (loop.reached.includes("verification")) verification_requests += 1;
    if (
      loop.reached.includes("dpp_published") &&
      loop.reached.includes("verification")
    ) {
      verified_objects += 1;
    }
    if (loop.reached.includes("checkout_started")) checkout_visits += 1;
    if (loop.reached.includes("payment_succeeded")) stripe_conversions += 1;
    if (loop.reached.includes("merchant_activated")) activated_merchants += 1;
    if (loop.reached.includes("provisioned")) provisioning_success += 1;
    if (loop.reached.includes("retained")) retained_merchants += 1;

    for (const row of visitRows) {
      if (stageOf(row) !== "payment_succeeded") continue;
      const meta = row.metadata as { surface?: string } | undefined;
      const surface = String(meta?.surface ?? "direct");
      revenue_by_surface[surface] = (revenue_by_surface[surface] ?? 0) + 1;
    }
  }

  const failed_counterfeit_review = (attestations ?? []).filter(a =>
    ["blocked", "warning", "counterfeit", "review"].includes(
      String(a.decision ?? "").toLowerCase()
    )
  ).length;

  const failed_autonomous_actions = (automationLogs ?? []).filter(
    l => l.status === "failure" || l.status === "failed"
  ).length;

  return {
    generated_at: now.toISOString(),
    verification_requests,
    verified_objects,
    failed_counterfeit_review,
    checkout_visits,
    stripe_conversions,
    activated_merchants,
    provisioning_success,
    retained_merchants,
    revenue_by_surface,
    failed_autonomous_actions,
    visit_count,
    excluded,
  };
}
