import { describe, expect, it } from "vitest";
import {
  buildRevenueProof,
  classifyVisit,
  type VisitClass,
} from "./revenue-proof";
import type { LoopEventRow } from "./dpp-loop";

const NOW = new Date("2026-10-22T12:00:00.000Z");

function row(
  visit: string,
  stage: string,
  meta: Record<string, unknown> = {}
): LoopEventRow {
  return {
    prospect_id: visit,
    event_type: `dpp_loop:${stage}`,
    timestamp: "2026-10-22T00:00:00.000Z",
    metadata: { loop_stage: stage, surface: "authichain.com", ...meta },
  };
}

/** A full paid visit: visit, checkout, payment. */
function paidVisit(visit: string, payMeta: Record<string, unknown> = {}) {
  return [
    row(visit, "attributed_visit"),
    row(visit, "checkout_started"),
    row(visit, "payment_succeeded", payMeta),
  ];
}

describe("classifyVisit", () => {
  const cases: Array<[string, LoopEventRow[], string[], VisitClass]> = [
    ["plain paid visit", paidVisit("a"), [], "real"],
    [
      "is_demo on the payment row",
      paidVisit("a", { is_demo: true }),
      [],
      "demo",
    ],
    [
      "demo flag on an earlier row only",
      [
        row("a", "attributed_visit", { demo: true }),
        ...paidVisit("a").slice(1),
      ],
      [],
      "demo",
    ],
    ["stripe livemode false", paidVisit("a", { livemode: false }), [], "test"],
    [
      "stripe livemode true is real",
      paidVisit("a", { livemode: true }),
      [],
      "real",
    ],
    [
      "founder email, exact",
      paidVisit("a", { email: "Zac@Example-Founder.io" }),
      ["zac@example-founder.io"],
      "founder",
    ],
    [
      "founder email, whole domain entry",
      paidVisit("a", { email: "smoke+7@authichain.com" }),
      ["@authichain.com"],
      "founder",
    ],
    [
      "a customer on a different domain is not the founder",
      paidVisit("a", { email: "buyer@authichain.com.evil.io" }),
      ["@authichain.com"],
      "real",
    ],
    [
      "founder list empty means nobody is excluded as founder",
      paidVisit("a", { email: "zac@example-founder.io" }),
      [],
      "real",
    ],
    [
      "blank founder entries match nothing",
      paidVisit("a", { email: "buyer@shop.io" }),
      ["", "  "],
      "real",
    ],
    [
      "string 'true' is not a demo flag (only boolean true counts, as in isDemoVisit)",
      paidVisit("a", { is_demo: "true" }),
      [],
      "real",
    ],
  ];

  it.each(cases)("%s", (_name, rows, founders, expected) => {
    expect(classifyVisit(rows, founders)).toBe(expected);
  });

  it("applies one class per visit in a fixed order: demo, then test, then founder", () => {
    const all = paidVisit("a", {
      is_demo: true,
      livemode: false,
      email: "zac@example-founder.io",
    });
    expect(classifyVisit(all, ["zac@example-founder.io"])).toBe("demo");
    const testAndFounder = paidVisit("a", {
      livemode: false,
      email: "zac@example-founder.io",
    });
    expect(classifyVisit(testAndFounder, ["zac@example-founder.io"])).toBe(
      "test"
    );
  });
});

describe("buildRevenueProof excludes non-revenue visits", () => {
  const founders = ["@authichain.com"];
  const rows: LoopEventRow[] = [
    ...paidVisit("real-1", { email: "buyer@shop.io" }),
    ...paidVisit("demo-1", { is_demo: true }),
    ...paidVisit("test-1", { livemode: false }),
    ...paidVisit("founder-1", { email: "zac@authichain.com" }),
  ];

  it("counts a founder smoke checkout as zero conversions", () => {
    const proof = buildRevenueProof(
      paidVisit("demo-only", { is_demo: true }),
      [],
      [],
      NOW
    );
    expect(proof.stripe_conversions).toBe(0);
    expect(proof.checkout_visits).toBe(0);
    expect(proof.visit_count).toBe(0);
    expect(proof.revenue_by_surface).toEqual({});
    expect(proof.excluded).toEqual({ demo: 1, test: 0, founder: 0 });
  });

  it("keeps only the real visit in every count and reports the rest separately", () => {
    const proof = buildRevenueProof(rows, [], [], NOW, {
      founderEmails: founders,
    });
    expect(proof.stripe_conversions).toBe(1);
    expect(proof.checkout_visits).toBe(1);
    expect(proof.visit_count).toBe(1);
    expect(proof.revenue_by_surface).toEqual({ "authichain.com": 1 });
    expect(proof.excluded).toEqual({ demo: 1, test: 1, founder: 1 });
  });

  it("excluded visits partition the input: real + excluded equals all visits", () => {
    const proof = buildRevenueProof(rows, [], [], NOW, {
      founderEmails: founders,
    });
    const e = proof.excluded;
    expect(proof.visit_count + e.demo + e.test + e.founder).toBe(4);
  });

  it("without a founder list the founder visit counts as real (honest default, visible in excluded.founder = 0)", () => {
    const proof = buildRevenueProof(rows, [], [], NOW);
    expect(proof.stripe_conversions).toBe(2);
    expect(proof.excluded.founder).toBe(0);
  });

  it("an excluded visit contributes to no other signal either", () => {
    const demoFull = [
      row("d", "attributed_visit", { is_demo: true }),
      row("d", "checkout_started"),
      row("d", "payment_succeeded"),
      row("d", "provisioned"),
      row("d", "merchant_activated"),
      row("d", "dpp_published"),
      row("d", "verification"),
      row("d", "retained"),
    ];
    const proof = buildRevenueProof(demoFull, [], [], NOW);
    expect(proof.verification_requests).toBe(0);
    expect(proof.verified_objects).toBe(0);
    expect(proof.activated_merchants).toBe(0);
    expect(proof.provisioning_success).toBe(0);
    expect(proof.retained_merchants).toBe(0);
    expect(proof.excluded.demo).toBe(1);
  });

  it("rows with no prospect id stay in one 'unknown' bucket, as before", () => {
    const orphan: LoopEventRow = {
      event_type: "dpp_loop:payment_succeeded",
      metadata: { loop_stage: "payment_succeeded" },
    };
    const proof = buildRevenueProof([orphan], [], [], NOW);
    expect(proof.visit_count).toBe(1);
  });
});
