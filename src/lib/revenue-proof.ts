/**
 * Revenue-proof totals. Derived from funnel_events at read time.
 * Do not persist a stored total.
 */

import { reconstructLoop, type LoopEventRow } from "./dpp-loop";

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
  revenue_by_surface: Record<string, number>;
  failed_autonomous_actions: number;
  visit_count: number;
};

export type AttestationDecisionRow = { decision?: string | null };
export type AutomationLogRow = { status?: string | null };

export function buildRevenueProof(
  rows: LoopEventRow[],
  automationLogs: AutomationLogRow[] = [],
  attestations: AttestationDecisionRow[] = [],
  now: Date = new Date()
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

  for (const [, visitRows] of byVisit) {
    const loop = reconstructLoop(visitRows);
    if (loop.reached.includes("verification")) verification_requests += 1;
    if (
      loop.reached.includes("dpp_published") &&
      loop.reached.includes("verification")
    ) {
      verified_objects += 1;
    }
    if (
      loop.reached.includes("checkout_started") ||
      loop.reached.includes("attributed_visit")
    ) {
      checkout_visits += 1;
    }
    if (loop.reached.includes("payment_succeeded")) stripe_conversions += 1;
    if (loop.reached.includes("merchant_activated")) activated_merchants += 1;
    if (loop.reached.includes("provisioned")) provisioning_success += 1;
    if (loop.reached.includes("retained")) retained_merchants += 1;

    for (const row of visitRows) {
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
    visit_count: byVisit.size,
  };
}
