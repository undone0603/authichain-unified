import { describe, expect, it } from "vitest";
import {
  buildSparqlQuery,
  extractPublishedEmails,
  isRoleAddress,
  parseSparqlCompanies,
  registrableDomain,
  scoreProspect,
} from "../prospecting/lib/open-prospecting.mjs";

const binding = (
  qid: string,
  name: string,
  site: string,
  country?: string
) => ({
  c: { value: `http://www.wikidata.org/entity/${qid}` },
  cLabel: { value: name },
  site: { value: site },
  ...(country ? { countryLabel: { value: country } } : {}),
});

describe("registrableDomain", () => {
  it("strips subdomains and handles two-part suffixes", () => {
    expect(registrableDomain("https://www.r-m.de/")).toBe("r-m.de");
    expect(registrableDomain("shop.r-m.de")).toBe("r-m.de");
    expect(registrableDomain("https://www.gtech.co.uk")).toBe("gtech.co.uk");
  });
});

describe("buildSparqlQuery", () => {
  it("excludes dissolved companies and requires a website", () => {
    const q = buildSparqlQuery(["Q924724"], 50);
    expect(q).toContain("wd:Q924724");
    expect(q).toContain("wdt:P856");
    expect(q).toContain("FILTER NOT EXISTS { ?c wdt:P576");
    expect(q).toContain("LIMIT 50");
  });
});

describe("parseSparqlCompanies", () => {
  it("merges storefront rows per company and prefers a bare https site", () => {
    const [batavus] = parseSparqlCompanies({
      results: {
        bindings: [
          binding(
            "Q3501397",
            "Batavus",
            "http://www.batavus.nl/",
            "Netherlands"
          ),
          binding(
            "Q3501397",
            "Batavus",
            "https://www.batavus.com/",
            "Netherlands"
          ),
        ],
      },
    });
    expect(batavus.sites).toHaveLength(2);
    expect(batavus.site).toBe("https://www.batavus.com/");
    expect(batavus.domain).toBe("batavus.com");
  });

  it("drops items with no English label, since they can't be addressed by name", () => {
    const out = parseSparqlCompanies({
      results: {
        bindings: [
          binding("Q18696657", "Q18696657", "http://www.monty.es/", "Spain"),
        ],
      },
    });
    expect(out).toEqual([]);
  });
});

describe("extractPublishedEmails", () => {
  const page = "https://www.r-m.de/impressum";

  it("keeps only addresses on the company's own domain, with provenance", () => {
    const html = `
      <a href="mailto:jana.beispiel@r-m.de?subject=Hi">Jana</a>
      Kontakt: info&#64;r-m.de
      <script>dsn="https://abc@o123.ingest.sentry.io/1"</script>
      Agentur: hello@agency.example
      <img src="logo@2x.png">`;
    const out = extractPublishedEmails(html, page, "r-m.de");
    expect(out.map(e => e.email).sort()).toEqual([
      "info@r-m.de",
      "jana.beispiel@r-m.de",
    ]);
    const named = out.find(e => e.email === "jana.beispiel@r-m.de")!;
    expect(named).toMatchObject({
      via: "mailto",
      sourceUrl: page,
      roleInbox: false,
    });
    expect(out.find(e => e.email === "info@r-m.de")!.roleInbox).toBe(true);
  });

  it("accepts subdomains of the company domain", () => {
    const out = extractPublishedEmails("press@news.r-m.de", page, "r-m.de");
    expect(out).toHaveLength(1);
  });
});

describe("isRoleAddress", () => {
  it("catches non-English role inboxes the shared gate misses", () => {
    expect(isRoleAddress("kontakt@firma.de")).toBe(true);
    expect(isRoleAddress("datenschutz@firma.de")).toBe(true);
    expect(isRoleAddress("info@firma.de")).toBe(true);
    expect(isRoleAddress("jana@firma.de")).toBe(false);
  });
});

describe("scoreProspect", () => {
  it("ranks an EU company with a named contact above a non-EU one", () => {
    const eu = scoreProspect({ country: "Germany" }, [{ roleInbox: false }]);
    const us = scoreProspect({ country: "United States" }, [
      { roleInbox: true },
    ]);
    expect(eu.score).toBeGreaterThan(us.score);
    expect(eu.reasons.join(" ")).toMatch(/2023\/1542/);
  });

  it("does not claim 'no address published' for a site it never fetched", () => {
    const { reasons } = scoreProspect({ country: "Germany" }, [], {
      pagesFetched: 0,
    });
    expect(reasons.join(" ")).toMatch(/not crawled/);
  });
});
