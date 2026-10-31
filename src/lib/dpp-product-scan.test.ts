import { describe, it, expect } from "vitest";
import {
  STOREPILOT_PRO_LINK,
  isValidGtin,
  parseProductScanInput,
  scanDppProduct,
} from "./dpp-product-scan";

const NOW = new Date("2026-10-24T00:00:00Z");
const FULL = {
  category: "textiles" as const,
  sellsInEu: true,
  gtin: "4006381333931",
  serialOrBatch: "B-2026-10",
  materials: "80% cotton, 20% polyester",
  recycledContentPct: "20",
  co2eKg: "6.4",
  careRepair: "Wash at 30C. Seams can be re-stitched.",
  dataCarrierUrl: "https://example.com/p/shirt-1",
};

describe("isValidGtin", () => {
  it("accepts a valid GTIN-13 and rejects a bad check digit", () => {
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("abc")).toBe(false);
  });
});

describe("scanDppProduct", () => {
  it("a complete record scores 100 with no gaps", () => {
    const r = scanDppProduct(FULL, { now: NOW });
    expect(r.score).toBe(100);
    expect(r.gaps).toEqual([]);
  });

  it("is deterministic", () => {
    expect(scanDppProduct(FULL, { now: NOW })).toEqual(scanDppProduct(FULL, { now: NOW }));
  });

  it("an empty record lists every field gap and scores 0", () => {
    const r = scanDppProduct({ category: "textiles", sellsInEu: true }, { now: NOW });
    expect(r.score).toBe(0);
    expect(r.gaps).toHaveLength(6);
  });

  it("flags a malformed GTIN distinctly", () => {
    const r = scanDppProduct({ ...FULL, gtin: "4006381333932" }, { now: NOW });
    expect(r.score).toBe(75);
    expect(r.gaps[0]).toMatch(/check digit/);
  });

  it("rejects non-https product pages and out-of-range percentages", () => {
    const r = scanDppProduct({ ...FULL, dataCarrierUrl: "http://x.test", recycledContentPct: "140" }, { now: NOW });
    expect(r.checks.find(c => c.field === "data_carrier")!.ok).toBe(false);
    expect(r.checks.find(c => c.field === "recycled_content")!.ok).toBe(false);
  });

  it("carries the dated battery obligation through scoreDppReadiness", () => {
    const r = scanDppProduct({ ...FULL, category: "battery_passport" }, { now: NOW });
    expect(r.readiness.daysUntilDeadline).not.toBeNull();
  });

  it("links only the new Pro link and never claims conformity", () => {
    const r = scanDppProduct(FULL, { now: NOW });
    const text = JSON.stringify(r);
    expect(r.proReportUrl).toBe(STOREPILOT_PRO_LINK);
    expect(text).not.toContain("eVqeVd1IZf7MeSKbDC1ND3x");
    expect(text).not.toContain("price_1UHlnq");
    expect(text).not.toMatch(/\bcompliant\b|\bcertified\b/i);
  });
});

describe("parseProductScanInput", () => {
  it("returns null without a known category and caps field length", () => {
    expect(parseProductScanInput(() => undefined)).toBeNull();
    const q = new URLSearchParams({ category: "toys", materials: "x".repeat(900) });
    const p = parseProductScanInput(k => q.get(k) ?? undefined)!;
    expect(p.materials).toHaveLength(500);
    expect(p.sellsInEu).toBe(true);
  });
});
