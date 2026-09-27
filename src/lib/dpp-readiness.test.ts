import { describe, expect, it } from "vitest";
import {
  DPP_CATEGORIES,
  DPP_QUESTIONS,
  parseDppReadinessInput,
  scoreDppReadiness,
} from "./dpp-readiness";

const allYes = Object.fromEntries(DPP_QUESTIONS.map(q => [q.id, true]));
const NOW = new Date("2026-09-27T00:00:00Z");

describe("scoreDppReadiness", () => {
  it("question weights sum to 100", () => {
    expect(DPP_QUESTIONS.reduce((s, q) => s + q.weight, 0)).toBe(100);
  });

  it("only the battery passport is stated as law with a date", () => {
    const law = DPP_CATEGORIES.filter(c => c.status === "law");
    expect(law.map(c => c.id)).toEqual(["battery_passport"]);
    expect(law[0].date).toBe("2027-02-18");
    for (const c of DPP_CATEGORIES.filter(c => c.status !== "law"))
      expect(c.date).toBeUndefined();
  });

  it("counts down to 18 Feb 2027 for in-scope batteries", () => {
    const r = scoreDppReadiness(
      { category: "battery_passport", sellsInEu: true, answers: {} },
      { now: NOW }
    );
    expect(r.daysUntilDeadline).toBe(144);
    expect(r.score).toBe(0);
    expect(r.band).toBe("not_started");
    expect(r.gaps).toHaveLength(DPP_QUESTIONS.length);
    expect(r.nextStep).toContain("144 days left");
    expect(r.nextStep).toContain("$299");
  });

  it("scores all-yes as mostly ready with no gaps", () => {
    const r = scoreDppReadiness({
      category: "textiles",
      sellsInEu: true,
      answers: allYes,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("mostly_ready");
    expect(r.gaps).toEqual([]);
    expect(r.daysUntilDeadline).toBeNull();
    expect(r.nextStep).toContain("expected, not yet law");
  });

  it("does not sell the audit when there is no EU duty", () => {
    const off = scoreDppReadiness({
      category: "battery_passport",
      sellsInEu: false,
      answers: {},
    });
    expect(off.inScope).toBe(false);
    expect(off.daysUntilDeadline).toBeNull();
    expect(off.nextStep).not.toContain("$");
    const none = scoreDppReadiness({
      category: "other",
      sellsInEu: true,
      answers: {},
    });
    expect(none.inScope).toBe(false);
    expect(none.nextStep).not.toContain("$");
  });

  it("bands at 40 and 75", () => {
    const pick = (ids: string[]) =>
      scoreDppReadiness({
        category: "tyres",
        sellsInEu: true,
        answers: Object.fromEntries(ids.map(id => [id, true])),
      }).band;
    expect(pick(["unique_id", "footprint"])).toBe("not_started"); // 35
    expect(pick(["unique_id", "supplier_data"])).toBe("partly_ready"); // 40
    expect(pick(["unique_id", "supplier_data", "footprint", "data_host"])).toBe(
      "partly_ready"
    ); // 70
    expect(
      pick([
        "unique_id",
        "supplier_data",
        "footprint",
        "data_host",
        "market_role",
      ])
    ).toBe("mostly_ready"); // 85
  });
});

describe("parseDppReadinessInput", () => {
  it("returns null without a known category", () => {
    expect(parseDppReadinessInput(() => undefined)).toBeNull();
    expect(
      parseDppReadinessInput(k => (k === "category" ? "nope" : undefined))
    ).toBeNull();
  });

  it("reads form strings and MCP booleans", () => {
    const form = new URLSearchParams(
      "category=furniture&sells_in_eu=no&unique_id=yes&footprint=on"
    );
    const a = parseDppReadinessInput(k => form.get(k) ?? undefined)!;
    expect(a.category).toBe("furniture");
    expect(a.sellsInEu).toBe(false);
    expect(a.answers.unique_id).toBe(true);
    expect(a.answers.footprint).toBe(true);
    expect(a.answers.supplier_data).toBe(false);

    const args: Record<string, unknown> = {
      category: "toys",
      supplier_data: true,
    };
    const b = parseDppReadinessInput(k => args[k])!;
    expect(b.sellsInEu).toBe(true);
    expect(b.answers.supplier_data).toBe(true);
  });
});
