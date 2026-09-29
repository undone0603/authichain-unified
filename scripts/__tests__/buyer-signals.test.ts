// scripts/__tests__/buyer-signals.test.ts
import { describe, expect, it } from "vitest";
import { PLANS } from "../../src/lib/plans";
import {
  OFFERS,
  collect,
  dedupe,
  ftcLeads,
  idsFromBody,
  opener,
  parseArbeitnow,
  parseRemotive,
  parseRss,
  parseTed,
  pickText,
  render,
  tedQuery,
  withMarker,
} from "../growth/buyer-signals.mjs";

const NOW = new Date("2026-09-29T12:00:00Z");
const SINCE = new Date("2026-09-21T12:00:00Z");

describe("offers", () => {
  it("quote the same prices as src/lib/plans.ts", () => {
    for (const [id, offer] of Object.entries(OFFERS)) {
      expect(PLANS.find(p => p.id === id)?.price, id).toBe(offer.price);
    }
  });

  it("never link a raw Payment Link", () => {
    for (const o of Object.values(OFFERS))
      expect(new URL(o.url).hostname).not.toBe("buy.stripe.com");
  });
});

describe("TED", () => {
  it("builds a phrase query bounded by publication date", () => {
    const q = tedQuery(SINCE);
    expect(q).toContain('FT ~ ("digital product passport")');
    expect(q).toMatch(/PD >= 20260921$/);
  });

  it("reads multilingual fields and builds the notice link", () => {
    const [lead] = parseTed({
      notices: [
        {
          "publication-number": "612345-2026",
          "notice-title": {
            deu: "Produktpass",
            eng: "Digital product passport platform",
          },
          "buyer-name": { eng: ["City of Graz"] },
          "buyer-country": ["AUT"],
          "publication-date": "2026-09-24+02:00",
          "deadline-receipt-tender-date-lot": ["2026-10-30+01:00"],
        },
      ],
    });
    expect(lead).toMatchObject({
      id: "ted:612345-2026",
      org: "City of Graz",
      title: "Digital product passport platform",
      country: "AUT",
      date: "2026-09-24",
      deadline: "2026-10-30",
      url: "https://ted.europa.eu/en/notice/-/detail/612345-2026",
      offer: "dpp_readiness",
    });
  });

  it("pickText falls back to the first language", () => {
    expect(pickText({ fra: "Passeport" })).toBe("Passeport");
    expect(pickText(undefined)).toBe("");
  });
});

describe("FTC", () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[FTC Warns Companies Making Questionable 'Made in the USA' Claims]]></title>
      <link>https://www.ftc.gov/x</link><pubDate>Thu, 24 Sep 2026 14:00:00 -0400</pubDate>
      <description>&lt;p&gt;Seven warning letters&lt;/p&gt;</description></item>
    <item><title>FTC sues data broker</title><link>https://www.ftc.gov/y</link>
      <pubDate>Thu, 24 Sep 2026 14:00:00 -0400</pubDate><description>privacy</description></item>
    <item><title>Made in USA settlement</title><link>https://www.ftc.gov/old</link>
      <pubDate>Mon, 01 Jun 2026 14:00:00 -0400</pubDate><description></description></item>
  </channel></rss>`;

  it("keeps only recent origin-claim releases", () => {
    const leads = ftcLeads(parseRss(xml), SINCE);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      url: "https://www.ftc.gov/x",
      offer: "musa_claim_file",
      date: "2026-09-24",
    });
    expect(leads[0].detail).toBe("Seven warning letters");
  });
});

describe("jobs", () => {
  it("maps passport roles to DPP and origin roles to the claim file", () => {
    const remotive = parseRemotive({
      jobs: [
        {
          company_name: "VoltCo",
          title: "ESPR Compliance Lead",
          url: "https://r/1",
          publication_date: "2026-09-25",
          description: "<p>Own our digital product passport</p>",
        },
        {
          company_name: "Acme",
          title: "Frontend dev",
          url: "https://r/2",
          publication_date: "2026-09-25",
          description: "React",
        },
      ],
    });
    expect(remotive).toHaveLength(1);
    expect(remotive[0]).toMatchObject({
      org: "VoltCo",
      offer: "dpp_readiness",
      id: "jobs:https://r/1",
    });

    const arbeit = parseArbeitnow({
      data: [
        {
          company_name: "Forge",
          title: "Trade analyst",
          url: "https://a/1",
          created_at: 1790000000,
          description: "Own country of origin marking for US imports",
        },
      ],
    });
    expect(arbeit[0]).toMatchObject({ org: "Forge", offer: "musa_claim_file" });
  });
});

describe("job noise", () => {
  it("ignores postings that only mention origin or counterfeiting in passing", () => {
    const noisy = parseRemotive({
      jobs: [
        {
          company_name: "PharmaCo",
          title: "Sr. Manager, Quality Assurance",
          url: "https://r/9",
          publication_date: "2026-09-25",
          description:
            "Track country of origin for APIs and anti-counterfeit packaging",
        },
      ],
    });
    expect(noisy).toEqual([]);
  });
});

describe("openers", () => {
  it("frames a tender as a bid decision, not a pitch", () => {
    const text = opener({
      source: "ted",
      offer: "dpp_readiness",
      url: "https://ted.europa.eu/en/notice/-/detail/1-2026",
      deadline: "2026-10-30",
    });
    expect(text).toMatch(/^Bid decision, not a pitch/);
    expect(text).toContain("before 2026-10-30");
  });
});

describe("dedupe", () => {
  const lead = (id: string, org = "Org") => ({
    id,
    org,
    title: "t",
    source: "ted",
    offer: "dpp_readiness",
  });

  it("drops repeats, already-reported ids and withdrawn farms", () => {
    const out = dedupe(
      [lead("a"), lead("a"), lead("b"), lead("c", "Mendo Love Farms")],
      new Set(["b"])
    );
    expect(out.map(l => l.id)).toEqual(["a"]);
  });

  it("round-trips reported ids through the issue marker", () => {
    const body = withMarker("# x", [lead("ted:1"), lead("jobs:https://r/1")]);
    expect(idsFromBody(body)).toEqual(["ted:1", "jobs:https://r/1"]);
    expect(idsFromBody("no marker")).toEqual([]);
  });
});

describe("collect", () => {
  it("reports each source's outcome and skips DCC without credentials", async () => {
    const fetchImpl = async (url: string) => {
      const host = new URL(url).hostname;
      if (host === "api.ted.europa.eu")
        return new Response(JSON.stringify({ notices: [] }));
      if (host === "www.ftc.gov") return new Response("boom", { status: 503 });
      if (host === "remotive.com")
        return new Response(JSON.stringify({ jobs: [] }));
      return new Response(JSON.stringify({ data: [], links: {} }));
    };
    const { leads, status } = await collect({
      now: NOW,
      fetchImpl: fetchImpl as typeof fetch,
      env: {},
    });
    expect(leads).toEqual([]);
    expect(status.ted).toBe("0 found");
    expect(status.ftc).toMatch(/^error: 503/);
    expect(status.jobs).toBe("0 found");
    expect(status.dcc).toMatch(/^skipped: needs DCC_APP_ID/);
  });

  it("renders a drafts-only digest", () => {
    const md = render([], { ted: "0 found" }, "2026-09-29");
    expect(md).toContain("nothing here has been sent");
    expect(md).toContain("No new signals this week.");
  });
});
