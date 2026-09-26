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

    // LT-35 read as "no parentage on file" until the breeder's 2026-09-10
    // "Lineage" email was processed. It is a VT-26 x VT-41 female, confirmed
    // in writing, and a full sibling of the LT males.
    const lt35 = getCultivar(farm, "lt-35")!;
    expect(lt35.parentEdges[0].provenance).toBe("confirmed_in_writing");
    expect(lt35.parentEdges[0].parents).toEqual(["VT-26", "VT-41"]);
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

describe("source PDF ingest — 2026-09-21", () => {
  const farm = "mendo-love-farms";

  it("recovers 251104R041-001 from the printed panel, not invented chemistry", () => {
    const cert = getDossier(farm)!.certificates.find(
      c => c.coa_id === "251104R041-001"
    )!;
    expect(cert.sample_name_on_coa).toBe("VT-26 Clone 11-3");
    expect(cert.cultivar).toBe("VT-26");
    expect(cert.cannabinoids_pct).toEqual({
      THCVA: 12.968,
      THCA: 7.825,
      CBGA: 0.71,
      CBCA: 0.13,
    });
    expect(cert.cannabinoids_pct).not.toHaveProperty("THCV");
    expect(cert.cannabinoids_pct).not.toHaveProperty("d9_THC");
    expect(cert.derived.totalThcvPct).toBe(11.373);
    expect(cert.derived.totalThcPct).toBe(6.863);
    expect(cert.derived.ratio).toBe(1.66);
    expect(cert.derived.mismatch).toBeNull();
    expect(cert.arithmetic_check).toBe("pass");
    expect(cert.source_pdf_sha256).toBe(
      "86bc4d288ced18f81accbd210ab31bb858c2b61d7e0e1ad293d665b33af43830"
    );
  });

  it("verifies 240823Q009-001 against the printed panel", () => {
    const cert = getDossier(farm)!.certificates.find(
      c => c.coa_id === "240823Q009-001"
    )!;
    expect(cert.sample_name_on_coa).toBe("VT-41 N9 x 6.75 #3");
    expect(cert.cultivar).toBe("VT-41");
    expect(cert.batch).toBe("VT-41");
    expect(cert.matrix).toBe("flower");
    expect(cert.cannabinoids_pct).toEqual({
      THCVA: 7.05,
      THCA: 1.572,
      THCV: 0.417,
      CBCA: 0.18,
    });
    expect(cert.derived.totalThcvPct).toBe(6.6);
    expect(cert.derived.totalThcPct).toBe(1.379);
    expect(cert.derived.mismatch).toBeNull();
    expect(cert.source_pdf_sha256).toBe(
      "4aaf9691c996d7ea7b7a92c86b9cf224943c82a8b3b025d68ee27312f91f681f"
    );
  });

  it("does not attach either ingested CoA to LT-63", () => {
    const lt63 = getCultivar(farm, "lt-63")!;
    expect(lt63.cultivar.coa_ids).toEqual([]);
    expect(lt63.certificates).toEqual([]);
    expect(lt63.peakThcvPct).toBeNull();
    const ids = getDossier(farm)!.certificates.map(c => c.coa_id);
    expect(ids).toContain("240823Q009-001");
    expect(ids).toContain("251104R041-001");
  });
});

describe("LT-63 — known, licensable, and untested", () => {
  const farm = "mendo-love-farms";

  it("is recorded even though no certificate exists for it", () => {
    const lt63 = getCultivar(farm, "lt-63")!;
    expect(lt63).not.toBeNull();
    expect(lt63.certificates).toEqual([]);
    expect(lt63.peakThcvPct).toBeNull();
  });

  it("carries confirmed parentage despite having no chemistry", () => {
    // The cultivar actually offered for licensing has no lab data on file.
    // That gap is the point: it must stay visible, not be inferred away.
    const lt63 = getCultivar(farm, "lt-63")!;
    expect(lt63.parentEdges[0].provenance).toBe("confirmed_in_writing");
  });

  it("ranks last on THCV rather than corrupting the ordering", () => {
    const lt63 = getCultivar(farm, "lt-63")!;
    expect(lt63.thcvRank).toBe(lt63.totalCultivars);
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
