import { describe, it, expect } from "vitest";
import {
  buildPortfolio,
  loadPortfolioRows,
  type DppProductRow,
} from "./compliance-portfolio";

const NOW = new Date("2026-10-01T00:00:00Z");

function row(over: Partial<DppProductRow>): DppProductRow {
  return {
    id: "d1",
    name: "Pack A",
    brand: "Acme",
    category: "battery_passport",
    serial_number: "SN-1",
    created_at: "2026-09-29T10:00:00Z",
    metadata: {
      dpp: true,
      visit_id: "v1",
      published_at: "2026-09-29T10:00:01Z",
    },
    ...over,
  };
}

describe("buildPortfolio", () => {
  it("derives legal status and days to the legal date from dpp-readiness", () => {
    const p = buildPortfolio([row({})], NOW);
    const item = p.items[0];
    expect(item.obligation).toBe("law");
    expect(item.legalDate).toBe("2027-02-18");
    expect(item.daysToLegalDate).toBe(140);
    expect(item.publishedAt).toBe("2026-09-29T10:00:01Z");
    expect(item.verifyUrl).toBe("/api/dpp/verify?dpp_id=d1&visit_id=v1");
  });

  it("marks categories it does not know as unmapped instead of guessing", () => {
    const item = buildPortfolio([row({ category: "Lithium packs" })], NOW)
      .items[0];
    expect(item.obligation).toBe("unmapped");
    expect(item.categoryLabel).toBe("Lithium packs");
    expect(item.legalDate).toBeNull();
  });

  it("counts by obligation and finds the nearest legal date", () => {
    const p = buildPortfolio(
      [
        row({ id: "a" }),
        row({ id: "b" }),
        row({ id: "c", category: "textiles" }),
        row({ id: "d", category: null, metadata: null }),
      ],
      NOW
    );
    expect(p.counts).toEqual({ law: 2, expected: 1, none: 0, unmapped: 1 });
    expect(p.nearestLegal).toEqual({
      date: "2027-02-18",
      days: 140,
      products: 2,
    });
    expect(p.items[3].verifyUrl).toBeNull();
  });

  it("has no nearest legal date when nothing is law", () => {
    expect(
      buildPortfolio([row({ category: "textiles" })], NOW).nearestLegal
    ).toBeNull();
    expect(buildPortfolio([], NOW).counts).toEqual({
      law: 0,
      expected: 0,
      none: 0,
      unmapped: 0,
    });
  });
});

describe("loadPortfolioRows", () => {
  function fakeAdmin(tables: Record<string, unknown[]>) {
    const filters: string[] = [];
    const builder = (table: string) => {
      const chain = {
        select: () => chain,
        eq: (c: string, v: string) => (
          filters.push(`${table}.${c}=${v}`),
          chain
        ),
        in: (c: string, v: string[]) => (
          filters.push(`${table}.${c} in ${v.join(",")}`),
          chain
        ),
        order: () => chain,
        limit: () => chain,
        then: (resolve: (r: { data: unknown[] }) => void) =>
          resolve({ data: tables[table] ?? [] }),
      };
      return chain;
    };
    return { admin: { from: builder }, filters };
  }

  it("scopes a subscriber to passports their profile published", async () => {
    const { admin, filters } = fakeAdmin({
      funnel_events: [
        { metadata: { dpp_id: "d1" } },
        { metadata: { dpp_id: "d1" } },
        { metadata: {} },
      ],
      products: [row({})],
    });
    const rows = await loadPortfolioRows(admin, {
      allowed: true,
      reason: "plan",
      profileId: "p1",
    });
    expect(rows).toHaveLength(1);
    expect(filters).toContain("funnel_events.metadata->>profile_id=p1");
    expect(filters).toContain("products.id in d1");
  });

  it("returns nothing for a subscriber with no published passports", async () => {
    const { admin, filters } = fakeAdmin({ funnel_events: [] });
    expect(
      await loadPortfolioRows(admin, {
        allowed: true,
        reason: "plan",
        profileId: "p1",
      })
    ).toEqual([]);
    expect(filters.some(f => f.startsWith("products."))).toBe(false);
  });

  it("shows the owner every published passport", async () => {
    const { admin, filters } = fakeAdmin({
      products: [row({}), row({ id: "d2" })],
    });
    const rows = await loadPortfolioRows(admin, {
      allowed: true,
      reason: "owner",
      profileId: null,
    });
    expect(rows).toHaveLength(2);
    expect(filters).toEqual(["products.metadata->>dpp=true"]);
  });
});
