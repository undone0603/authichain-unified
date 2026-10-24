import { describe, it, expect } from "vitest";
import { buildPortfolio, capCatalog, type DppProductRow } from "./compliance-portfolio";
import { parseCatalogUpload } from "./catalog-upload";
import { portfolioToJsonLd } from "./dpp-jsonld";

const NOW = new Date("2026-10-24T00:00:00Z");
const rows = (n: number): DppProductRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p-${String(i).padStart(3, "0")}`,
    name: `Product ${i}`,
    brand: "Acme",
    category: i % 2 ? "textiles" : "battery_passport",
    serial_number: `S${i}`,
    created_at: null,
    metadata: null,
  }));

describe("capCatalog", () => {
  it("1 and 200 products pass; 201 is refused with a clear message", () => {
    expect(capCatalog(rows(1)).ok).toBe(true);
    expect(capCatalog(rows(200)).ok).toBe(true);
    const r = capCatalog(rows(201));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.limit).toBe(200);
      expect(r.received).toBe(201);
      expect(r.message).toBe("Your plan covers up to 200 products. This upload has 201. Remove 1 and try again.");
    }
  });
});

describe("portfolioToJsonLd", () => {
  it("parses, has one node per product, and is deterministic", () => {
    const a = portfolioToJsonLd(buildPortfolio(rows(200), NOW));
    const b = portfolioToJsonLd(buildPortfolio([...rows(200)].reverse(), NOW));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const parsed = JSON.parse(JSON.stringify(a));
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed.numberOfItems).toBe(200);
    expect(parsed.itemListElement[0].item["@type"]).toBe("Product");
  });

  it("values are derived from the rows and readiness data", () => {
    const ld = portfolioToJsonLd(buildPortfolio(rows(1), NOW));
    const item = ld.itemListElement[0].item;
    expect(item.productID).toBe("p-000");
    expect(item.serialNumber).toBe("S0");
    const names = item.additionalProperty.map(p => p.name);
    expect(names).toContain("dppObligation");
    expect(names).toContain("dppLegalDate");
  });

  it("makes no conformity or registry claims", () => {
    const { description, ...rest } = portfolioToJsonLd(buildPortfolio(rows(5), NOW));
    expect(description).toContain("is not registered in the EU DPP Registry.");
    const text = JSON.stringify(rest);
    expect(text).not.toMatch(/compliant|certified|registry-ready|registered|EPCIS/i);
  });
});

describe("parseCatalogUpload", () => {
  it("reads CSV with quotes and JSON arrays", () => {
    const csv = 'id,name,brand,category,serial\nA1,"Shirt, blue",Acme,textiles,S1\n';
    const r = parseCatalogUpload(csv);
    expect(r.ok && r.rows[0]).toMatchObject({ id: "A1", name: "Shirt, blue", serial_number: "S1" });
    const j = parseCatalogUpload(JSON.stringify([{ sku: "B2", name: "Lamp" }]), "application/json");
    expect(j.ok && j.rows[0].id).toBe("B2");
  });

  it("rejects rows without a name and bad JSON", () => {
    expect(parseCatalogUpload("id,name\nA1,\n")).toEqual({ ok: false, error: "row 1: name is required" });
    expect(parseCatalogUpload("[oops", "application/json").ok).toBe(false);
  });
});
