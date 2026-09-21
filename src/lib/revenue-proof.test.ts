import { describe, expect, it } from "vitest";
import { buildRevenueProof } from "./revenue-proof";
import type { LoopEventRow } from "./dpp-loop";

function row(
  visit: string,
  stage: string,
  extra: Partial<LoopEventRow> = {}
): LoopEventRow {
  return {
    prospect_id: visit,
    event_type: `dpp_loop:${stage}`,
    timestamp: "2026-09-21T00:00:00.000Z",
    metadata: { loop_stage: stage, surface: "authichain.com" },
    ...extra,
  };
}

describe("buildRevenueProof", () => {
  it("derives loop counts from events, not stored totals", () => {
    const rows: LoopEventRow[] = [
      row("v1", "attributed_visit"),
      row("v1", "checkout_started"),
      row("v1", "payment_succeeded"),
      row("v1", "provisioned"),
      row("v1", "merchant_activated"),
      row("v1", "dpp_published"),
      row("v1", "verification"),
      row("v1", "retained"),
      row("v2", "attributed_visit"),
      row("v2", "checkout_started"),
    ];
    const proof = buildRevenueProof(
      rows,
      [{ status: "failure" }, { status: "success" }],
      [{ decision: "blocked" }, { decision: "verified" }],
      new Date("2026-09-21T12:00:00.000Z")
    );
    expect(proof.visit_count).toBe(2);
    expect(proof.verification_requests).toBe(1);
    expect(proof.verified_objects).toBe(1);
    expect(proof.checkout_visits).toBe(2);
    expect(proof.stripe_conversions).toBe(1);
    expect(proof.activated_merchants).toBe(1);
    expect(proof.provisioning_success).toBe(1);
    expect(proof.retained_merchants).toBe(1);
    expect(proof.failed_counterfeit_review).toBe(1);
    expect(proof.failed_autonomous_actions).toBe(1);
    expect(proof.revenue_by_surface["authichain.com"]).toBe(10);
    expect(proof.generated_at).toBe("2026-09-21T12:00:00.000Z");
  });
});
