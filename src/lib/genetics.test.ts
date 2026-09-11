import { describe, it, expect } from "vitest";
import {
  DECARB,
  derive,
  getCultivar,
  getDossier,
  timeline,
  toSlug,
  type Certificate,
} from "./genetics";

describe("derive", () => {
  it("recomputes total THCV and THC from the acidic/neutral pair", () => {
    const cert = {
      coa_id: "TEST-1",
      cultivar: "X",
      sample_name_on_coa: "x",
      collected: "2026-01-01",
      cannabinoids_pct: {
        THCVA: 7.721,
        THCV: 4.847,
        THCA: 5.002,
        d9_THC: 2.93,
      },
      totals_pct: { thcv: 11.618, thc: 7.317 },
      ratio_thcv_thc: 1.59,
      arithmetic_check: "pass",
    } as Certificate;

    const d = derive(cert).derived;
    expect(d.totalThcvPct).toBe(11.618);
    expect(d.totalThcPct).toBe(7.317);
    expect(d.ratio).toBe(1.59);
    expect(d.mismatch).toBeNull();
  });

  it("reports an unverifiable certificate as unverifiable, not verified", () => {
    const d = derive({
      coa_id: "TEST-2",
      cultivar: "X",
      sample_name_on_coa: "x",
      collected: "2026-01-01",
      cannabinoids_pct: null,
      totals_pct: { thcv: 8.814, thc: 0.97 },
      ratio_thcv_thc: 9.09,
      arithmetic_check: "not_possible_without_raw_values",
    } as Certificate).derived;

    expect(d.totalThcvPct).toBeNull();
    expect(d.ratio).toBeNull();
    expect(d.mismatch).toBeNull();
  });

  it("flags a panel missing a compound the published total requires", () => {
    // LT-35 #10: published THC 1.31% but only THCA 1.058% in the panel.
    const d = derive({
      coa_id: "260715S011-001",
      cultivar: "LT-35",
      sample_name_on_coa: "LT-35 #10",
      collected: "2026-07-15",
      cannabinoids_pct: { THCVA: 8.827, THCV: 3.492, THCA: 1.058 },
      totals_pct: { thcv: 11.233, thc: 1.31 },
      ratio_thcv_thc: 8.58,
      arithmetic_check: "fail",
    } as Certificate).derived;

    expect(d.mismatch).not.toBeNull();
    expect(d.mismatch!.field).toBe("thc");
    // 1.31 published - (1.058 THCA * 0.877) = 0.382 of unaccounted-for d9-THC.
    expect(d.mismatch!.impliedMissingPct).toBeCloseTo(0.382, 3);
  });
});

describe("the Mendo Love Farms dossier", () => {
  const farm = "mendo-love-farms";

  it("loads, and every certificate either reconciles or is flagged", () => {
    const d = getDossier(farm)!;
    expect(d).not.toBeNull();
    expect(d.certificates).toHaveLength(12);

    for (const c of d.certificates) {
      if (c.arithmetic_check === "pass") {
        expect(c.derived.mismatch, `${c.coa_id} should reconcile`).toBeNull();
      }
      if (c.arithmetic_check === "fail") {
        expect(
          c.derived.mismatch,
          `${c.coa_id} should be flagged`
        ).not.toBeNull();
      }
    }
  });

  it("finds exactly one certificate that does not reconcile", () => {
    const bad = getDossier(farm)!.certificates.filter(c => c.derived.mismatch);
    expect(bad.map(c => c.coa_id)).toEqual(["260715S011-001"]);
  });

  it("ranks VT-26 first on peak THCV — the error the prototypes published", () => {
    const vt26 = getCultivar(farm, "vt-26")!;
    const lt35 = getCultivar(farm, "lt-35")!;
    expect(vt26.thcvRank).toBe(1);
    expect(lt35.thcvRank).toBe(2);
    expect(vt26.peakThcvPct!).toBeGreaterThan(lt35.peakThcvPct!);
  });

  it("does not claim the crosses exceed both parents on absolute THCV", () => {
    const crosses = getCultivar(farm, "vt-26xlt-11")!;
    const vt26 = getCultivar(farm, "vt-26")!;
    const lt11 = getCultivar(farm, "lt-11")!;
    // Above the pollen parent, below the seed parent — the real shape.
    expect(crosses.peakThcvPct!).toBeGreaterThan(lt11.peakThcvPct!);
    expect(crosses.peakThcvPct!).toBeLessThan(vt26.peakThcvPct!);
    // The ratio, however, does exceed both.
    expect(crosses.peakRatio!).toBeGreaterThan(vt26.peakRatio!);
    expect(crosses.peakRatio!).toBeGreaterThan(lt11.peakRatio!);
  });

  it("carries lineage provenance rather than flattening it to a claim", () => {
    const lt11 = getCultivar(farm, "lt-11")!;
    expect(lt11.parentEdges[0].provenance).toBe("confirmed_in_writing");

    const lt35 = getCultivar(farm, "lt-35")!;
    expect(lt35.parentEdges[0].provenance).toBe("none");
  });

  it("surfaces open questions instead of guessing", () => {
    expect(getDossier(farm)!.openQuestions.length).toBeGreaterThanOrEqual(4);
    expect(getCultivar(farm, "lt-35")!.openQuestions.length).toBeGreaterThan(0);
  });

  it("orders the timeline oldest first", () => {
    const t = timeline(farm);
    expect(t[0].collected).toBe("2024-08-07");
    expect(t[t.length - 1].collected).toBe("2026-07-15");
  });

  it("returns null for an unknown farm or cultivar", () => {
    expect(getDossier("nope")).toBeNull();
    expect(getCultivar(farm, "nope")).toBeNull();
  });
});

describe("toSlug", () => {
  it("makes URL segments from cultivar ids", () => {
    expect(toSlug("VT-26")).toBe("vt-26");
    expect(toSlug("VT-26xLT-11")).toBe("vt-26xlt-11");
  });
});

it("uses the standard decarboxylation factor", () => {
  expect(DECARB).toBeCloseTo(314.46 / 358.47, 3);
});
