import { describe, expect, it } from "vitest";
import { checkClaims } from "../../server/outreach/claims";
import { DPP_CATEGORIES } from "./dpp-readiness";
import {
  buildDppFollowup,
  DPP_CHECKOUT_URL,
  DPP_OPTIN_INTEREST,
  DPP_OPTIN_SOURCE,
  DPP_PAST_CHECKOUT_EVENT_TYPES,
  dppOptInMessage,
  emailsPastCheckout,
  parseDppOptInMessage,
  selectDueFollowups,
  type OptInRow,
} from "./dpp-followup";
import { planById } from "./plans";

const NOW = new Date("2026-10-14T12:00:00Z");
const hoursAgo = (h: number) =>
  new Date(NOW.getTime() - h * 3_600_000).toISOString();

function row(over: Partial<OptInRow> = {}): OptInRow {
  return {
    id: 1,
    email: "buyer@example.com",
    source: DPP_OPTIN_SOURCE,
    product_interest: DPP_OPTIN_INTEREST,
    message: dppOptInMessage({
      category: "battery_passport",
      score: 40,
      band: "partly_ready",
    }),
    created_at: hoursAgo(6),
    ...over,
  };
}

describe("opt-in message", () => {
  it("round-trips the shape of a result and nothing else", () => {
    const m = dppOptInMessage({
      category: "battery_passport",
      score: 40,
      band: "partly_ready",
    });
    expect(m).toBe("dpp-check:battery_passport:40:partly_ready");
    expect(parseDppOptInMessage(m)).toEqual({
      category: "battery_passport",
      score: 40,
      band: "partly_ready",
    });
  });

  it("rejects anything that is not exactly that shape", () => {
    for (const bad of [
      null,
      "",
      "hello",
      "dpp-check:battery_passport:40",
      "dpp-check:battery_passport:140:partly_ready",
      "dpp-check:nonsense_category:40:partly_ready",
      "dpp-check:battery_passport:40:amazing",
      "dpp-check:battery_passport:40:partly_ready extra words",
    ]) {
      expect(parseDppOptInMessage(bad), String(bad)).toBeNull();
    }
  });
});

describe("buildDppFollowup", () => {
  const plan = planById("dpp_readiness")!;

  it("names the plan exactly as plans.ts does and never calls it an audit", () => {
    const { subject, body } = buildDppFollowup({
      category: "battery_passport",
      score: 40,
      band: "partly_ready",
    });
    expect(subject).toBe("Your EU DPP readiness result: 40/100");
    expect(body).toContain(plan.name);
    expect(body).toContain(`$${plan.price}`);
    expect(body).toContain(`${plan.generations} workspace generations`);
    expect(body).toContain(DPP_CHECKOUT_URL);
    expect(body).toContain(
      "not an audit, not a certification and not legal advice"
    );
    expect(body).toContain("does not register a product in EUDAMED");
    // "audit" may appear only in the disclaimer.
    expect(body.replace("not an audit", "").toLowerCase()).not.toContain(
      "audit"
    );
    expect(body.toLowerCase()).not.toContain("written plan");
  });

  it("states the dated obligation only for a category that is law", () => {
    const battery = buildDppFollowup({
      category: "battery_passport",
      score: 40,
      band: "partly_ready",
    });
    expect(battery.body).toContain("Dated obligation: 2027-02-18");
    const expected = DPP_CATEGORIES.find(c => c.status === "expected");
    if (expected) {
      const b = buildDppFollowup({
        category: expected.id,
        score: 10,
        band: "not_started",
      });
      expect(b.body).not.toContain("Dated obligation");
      expect(b.body).toContain("expected, not yet law");
    }
  });

  it("is deterministic", () => {
    const r = {
      category: "battery_passport",
      score: 55,
      band: "partly_ready" as const,
    };
    expect(buildDppFollowup(r)).toEqual(buildDppFollowup(r));
  });

  it("passes the outbound claims filter for every category and band", () => {
    for (const c of DPP_CATEGORIES) {
      for (const band of [
        "not_started",
        "partly_ready",
        "mostly_ready",
      ] as const) {
        const { subject, body } = buildDppFollowup({
          category: c.id,
          score: 42,
          band,
        });
        expect(checkClaims(subject, body), `${c.id}/${band}`).toEqual([]);
      }
    }
  });
});

describe("selectDueFollowups", () => {
  const opts = { now: NOW };

  it("selects a consenting opt-in that is old enough and not yet followed up", () => {
    const due = selectDueFollowups([row()], new Set(), opts);
    expect(due).toHaveLength(1);
    expect(due[0].email).toBe("buyer@example.com");
    expect(due[0].result.score).toBe(40);
  });

  it("skips rows without the consent marker or from other forms", () => {
    expect(
      selectDueFollowups([row({ product_interest: "qron" })], new Set(), opts)
    ).toEqual([]);
    expect(
      selectDueFollowups([row({ source: "website" })], new Set(), opts)
    ).toEqual([]);
    expect(
      selectDueFollowups(
        [row({ message: "free text from a person" })],
        new Set(),
        opts
      )
    ).toEqual([]);
  });

  it("waits, and gives up on stale opt-ins", () => {
    expect(
      selectDueFollowups([row({ created_at: hoursAgo(1) })], new Set(), opts)
    ).toEqual([]);
    expect(
      selectDueFollowups(
        [row({ created_at: hoursAgo(24 * 15) })],
        new Set(),
        opts
      )
    ).toEqual([]);
  });

  it("never selects an address twice or one already sent or opted out", () => {
    const rows = [
      row({ id: 1 }),
      row({ id: 2, email: "BUYER@example.com", created_at: hoursAgo(8) }),
    ];
    expect(selectDueFollowups(rows, new Set(), opts)).toHaveLength(1);
    expect(
      selectDueFollowups(rows, new Set(["buyer@example.com"]), opts)
    ).toEqual([]);
  });

  it("is oldest first and respects the limit", () => {
    const rows = [
      row({ id: 1, email: "b@example.com", created_at: hoursAgo(5) }),
      row({ id: 2, email: "a@example.com", created_at: hoursAgo(9) }),
      row({ id: 3, email: "c@example.com", created_at: hoursAgo(7) }),
    ];
    const due = selectDueFollowups(rows, new Set(), { ...opts, limit: 2 });
    expect(due.map(d => d.email)).toEqual(["a@example.com", "c@example.com"]);
  });
});

describe("people past checkout", () => {
  it("covers every loop stage after the first visit, and not the visit itself", () => {
    expect(DPP_PAST_CHECKOUT_EVENT_TYPES).toContain(
      "dpp_loop:checkout_started"
    );
    expect(DPP_PAST_CHECKOUT_EVENT_TYPES).toContain(
      "dpp_loop:payment_succeeded"
    );
    expect(DPP_PAST_CHECKOUT_EVENT_TYPES).not.toContain(
      "dpp_loop:attributed_visit"
    );
  });

  it("collects lower-cased addresses and ignores rows without one", () => {
    const set = emailsPastCheckout([
      { metadata: { email: " Buyer@Example.com " } },
      { metadata: {} },
      { metadata: null },
      { metadata: { email: 42 } },
    ]);
    expect([...set]).toEqual(["buyer@example.com"]);
  });

  it("is what keeps a buyer out of the follow-up", () => {
    const paid = emailsPastCheckout([
      { metadata: { email: "buyer@example.com" } },
    ]);
    expect(selectDueFollowups([row()], paid, { now: NOW })).toEqual([]);
  });
});
