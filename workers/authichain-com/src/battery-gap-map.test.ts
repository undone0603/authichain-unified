import { describe, expect, it } from "vitest";
import {
  GAP_MAP_DISCLAIMER,
  GAP_STATUSES,
  annexXiiiRows,
  round1,
  round2,
  scorePack,
  type PackInput,
} from "./battery-gap-map.ts";

const base: PackInput = {
  model: "LMT-36",
  statedWh: 36,
  ah: 10,
  nominalV: 3.6,
  placing: "self",
};

describe("scorePack", () => {
  it("accepts a consistent pack (3.6 V × 10 Ah = 36.0 Wh)", () => {
    const s = scorePack(base);
    expect(s.vTimesAh).toBe(36);
    expect(s.impliedV).toBe(3.6);
    expect(s.deviation).toBe(0);
    expect(s.consistent).toBe(true);
    expect(s.valid).toBe(true);
  });

  it("flags a pack more than 1% off", () => {
    const s = scorePack({ ...base, statedWh: 36.5 });
    expect(s.vTimesAh).toBe(36);
    expect(s.consistent).toBe(false);
    expect(s.deviation).toBeGreaterThan(0.01);
    expect(scorePack({ ...base, statedWh: 35.5 }).consistent).toBe(false);
  });

  it("treats exactly 1% as consistent and just over as not", () => {
    const at = { ...base, nominalV: 10, ah: 10 }; // vTimesAh = 100
    expect(scorePack({ ...at, statedWh: 101 }).consistent).toBe(true);
    expect(scorePack({ ...at, statedWh: 99 }).consistent).toBe(true);
    expect(scorePack({ ...at, statedWh: 101.01 }).consistent).toBe(false);
    // Float-noisy boundary: 36.36 vs 36.0 is exactly 1%.
    expect(scorePack({ ...base, statedWh: 36.36 }).consistent).toBe(true);
    expect(scorePack({ ...base, statedWh: 36.37 }).consistent).toBe(false);
  });

  it("rounds vTimesAh to 1 dp and impliedV to 2 dp", () => {
    const s = scorePack({ ...base, nominalV: 3.7, ah: 2.5, statedWh: 9.25 });
    expect(s.vTimesAh).toBe(9.3); // 9.25 → 9.3
    expect(s.impliedV).toBe(3.7);
    const t = scorePack({ ...base, nominalV: 36.3, ah: 13.4, statedWh: 486 });
    expect(t.vTimesAh).toBe(486.4); // 486.42
    expect(t.impliedV).toBe(36.27); // 36.2686…
    expect(round1(1.05)).toBe(1.1);
    expect(round2(1.005)).toBe(1.01);
  });

  it("handles zero, negative and non-numeric input without NaN or Infinity", () => {
    const bad = [
      { ...base, ah: 0 },
      { ...base, ah: -5 },
      { ...base, nominalV: 0 },
      { ...base, statedWh: -1 },
      { ...base, statedWh: Number.NaN, ah: Number.POSITIVE_INFINITY },
      { ...base, ah: "abc" as unknown as number },
      { ...base, cyclesLow: -1, cyclesHigh: Number.NaN },
    ];
    for (const b of bad) {
      const s = scorePack(b);
      const json = JSON.stringify(s);
      expect(json).not.toMatch(/NaN|Infinity/);
      for (const v of Object.values(s))
        if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    }
    const z = scorePack({ ...base, ah: 0 });
    expect(z.vTimesAh).toBeNull();
    expect(z.impliedV).toBeNull();
    expect(z.consistent).toBe(false);
    expect(z.valid).toBe(false);
    expect(z.errors.length).toBeGreaterThan(0);
  });
});

describe("annexXiiiRows", () => {
  it("only ever uses the four statuses and covers each of them", () => {
    for (const placing of ["self", "cell_maker", "unknown"] as const) {
      const rows = annexXiiiRows({
        ...base,
        placing,
        cyclesLow: 800,
        cyclesHigh: 1200,
      });
      for (const r of rows) expect(GAP_STATUSES).toContain(r.status);
      expect(new Set(rows.map(r => r.status))).toEqual(new Set(GAP_STATUSES));
    }
    expect(GAP_STATUSES).toEqual([
      "user_provided",
      "needs_operator",
      "not_public",
      "not_art77",
    ]);
  });

  it("marks typed figures user_provided and never invents identifiers", () => {
    const rows = annexXiiiRows({ ...base, cyclesLow: 800, cyclesHigh: 1200 });
    const by = Object.fromEntries(rows.map(r => [r.id, r]));
    for (const id of ["model", "energy", "capacity", "voltage", "cycles"])
      expect(by[id].status).toBe("user_provided");
    expect(by.model.value).toBe("LMT-36");
    expect(by.energy.value).toBe("36 Wh");
    expect(by.cycles.value).toBe("800–1200 cycles");
    expect(by.unique_id.status).toBe("needs_operator");
    expect(by.unique_id.value).toBeUndefined();
    for (const r of rows)
      if (r.status !== "user_provided") expect(r.value).toBeUndefined();
  });

  it("moves an omitted cycle range to needs_operator", () => {
    const rows = annexXiiiRows(base);
    expect(rows.find(r => r.id === "cycles")!.status).toBe("needs_operator");
  });

  it("words operator items for self, cell_maker and unknown", () => {
    const note = (placing: PackInput["placing"]) =>
      annexXiiiRows({ ...base, placing }).find(r => r.id === "conformity")!
        .note;
    expect(note("self")).toMatch(/^You place this battery on the EU market/);
    expect(note("cell_maker")).toMatch(
      /cell maker places this battery.*request/
    );
    expect(note("unknown")).toMatch(/^Confirm who places this battery/);
    expect(
      new Set([note("self"), note("cell_maker"), note("unknown")]).size
    ).toBe(3);
    const weird = annexXiiiRows({ ...base, placing: "x" as never });
    expect(weird.find(r => r.id === "conformity")!.note).toBe(note("unknown"));
  });

  it("keeps restricted and out-of-scope items out of the public layer", () => {
    const rows = annexXiiiRows(base);
    expect(rows.find(r => r.id === "test_reports")!.status).toBe("not_public");
    expect(rows.find(r => r.id === "commercial")!.status).toBe("not_art77");
  });
});

describe("GAP_MAP_DISCLAIMER", () => {
  it("is the exact approved text", () => {
    expect(GAP_MAP_DISCLAIMER).toBe(
      "Unofficial gap map from figures you typed. Not issued as a battery passport. No identifier here is live. Not legal advice. Confirm against Regulation (EU) 2023/1542 and counsel."
    );
  });
});
