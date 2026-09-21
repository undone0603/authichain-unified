import { describe, expect, it } from "vitest";
import { applyCapture, applyCycle } from "./cycle";
import { closeOrder, closePriority, scoreLead } from "./metrics";
import type { Lead } from "./types";

function lead(partial: Partial<Lead> & Pick<Lead, "id" | "email" | "stage" | "score">): Lead {
  const now = "2026-09-21T14:00:00.000Z";
  return {
    name: "Alex Founder",
    title: "CEO",
    company: partial.company ?? "Acme Co",
    domain: "authichain",
    value: 15000,
    city: "Detroit",
    notes: "",
    lastTouch: now,
    createdAt: now,
    draftPending: false,
    activities: [],
    lost: false,
    source: "inbound",
    ...partial,
  };
}

describe("capture merge", () => {
  it("merges duplicate email and bumps score by 6", () => {
    const existing = lead({ id: "ld-1", email: "a@acme.test", stage: "new", score: 40 });
    const { leads, merged, lead: next } = applyCapture([existing], {
      name: "Alex Founder",
      title: "CEO",
      company: "Acme Co",
      email: "A@acme.test",
      domain: "authichain",
      city: "Detroit",
      notes: "",
    });
    expect(merged).toBe(true);
    expect(leads).toHaveLength(1);
    expect(next.score).toBe(46);
    expect(next.draftPending).toBe(true);
    expect(next.lost).toBe(false);
  });

  it("auto-qualifies a new lead scored >= 70", () => {
    const { merged, lead: next } = applyCapture([], {
      name: "Pat Owner",
      title: "Founder & CEO",
      company: "Northlight",
      email: "pat@northlight.test",
      domain: "qron",
      city: "Ann Arbor",
      notes: "Wants a signed living QR sample against the brand URL this week.",
    });
    expect(merged).toBe(false);
    expect(
      scoreLead({
        company: "Northlight",
        title: "Founder & CEO",
        domain: "qron",
        notes: "Wants a signed living QR sample against the brand URL this week.",
      }),
    ).toBeGreaterThanOrEqual(70);
    expect(next.stage).toBe("qualified");
  });
});

describe("cycle skip-lost", () => {
  it("does not score, nurture, or advance lost or converted leads", () => {
    const lost = lead({ id: "ld-lost", email: "lost@x.test", stage: "new", score: 80, lost: true });
    const converted = lead({
      id: "ld-conv",
      email: "done@x.test",
      stage: "converted",
      score: 90,
      company: "Done Co",
    });
    const open = lead({ id: "ld-open", email: "open@x.test", stage: "new", score: 48, company: "Open Co" });
    const { leads, report } = applyCycle([lost, converted, open], Date.parse("2026-09-21T14:00:00.000Z"));
    expect(report.scored).toBe(1);
    expect(leads.find((l) => l.id === "ld-lost")?.score).toBe(80);
    expect(leads.find((l) => l.id === "ld-conv")?.score).toBe(90);
    expect(leads.find((l) => l.id === "ld-open")?.score).toBe(49);
    expect(leads.find((l) => l.id === "ld-lost")?.stage).toBe("new");
    expect(leads.find((l) => l.id === "ld-conv")?.stage).toBe("converted");
  });

  it("advances qualified >= 85 to demoed and skips lost qualified", () => {
    const hot = lead({ id: "ld-hot", email: "hot@x.test", stage: "qualified", score: 86, company: "Hot Co" });
    const lostHot = lead({
      id: "ld-lost-hot",
      email: "losthot@x.test",
      stage: "qualified",
      score: 90,
      lost: true,
      company: "Lost Hot",
    });
    const { leads, report } = applyCycle([hot, lostHot]);
    expect(report.advanced).toBe(1);
    expect(leads.find((l) => l.id === "ld-hot")?.stage).toBe("demoed");
    expect(leads.find((l) => l.id === "ld-lost-hot")?.stage).toBe("qualified");
  });
});

describe("close-order ranking", () => {
  it("ranks signed above a raw high score", () => {
    const signed = lead({
      id: "a",
      email: "a@x.test",
      stage: "signed",
      score: 50,
      lastTouch: "2026-09-20T00:00:00.000Z",
      company: "Signed Co",
      value: 10000,
    });
    const raw = lead({
      id: "b",
      email: "b@x.test",
      stage: "new",
      score: 70,
      company: "Raw Co",
      value: 10000,
      lastTouch: "2026-09-21T00:00:00.000Z",
    });
    expect(closePriority(signed)).toBeGreaterThan(closePriority(raw));
    expect(closeOrder([raw, signed], 2).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("adds draft+18 and stale+14 to the close score", () => {
    const staleDraft = lead({
      id: "c",
      email: "c@x.test",
      stage: "contacted",
      score: 40,
      draftPending: true,
      lastTouch: "2026-09-01T00:00:00.000Z",
      company: "Stale Draft",
    });
    expect(closePriority(staleDraft)).toBe(40 + 18 + 14);
  });
});
