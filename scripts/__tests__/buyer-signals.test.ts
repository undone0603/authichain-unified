// scripts/__tests__/buyer-signals.test.ts
import { describe, expect, it } from "vitest";
import { PLANS } from "../../src/lib/plans";
import {
  OFFERS,
  collect,
  dccLeads,
  dedupe,
  earLeads,
  earParty,
  earRows,
  jsfButton,
  jsfForm,
  fetchAts,
  parseAshby,
  parseGreenhouse,
  parseLever,
  ftcLeads,
  cbpLeads,
  cbpUsOrigin,
  fetchCbp,
  cbpUrl,
  fedregLeads,
  fedregUrl,
  newsLeads,
  newsUrl,
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

describe("Federal Register", () => {
  it("names the ordered company and pitches its competitors", () => {
    const url = new URL(fedregUrl(SINCE));
    expect(url.searchParams.get("conditions[agencies][]")).toBe(
      "federal-trade-commission"
    );
    expect(url.searchParams.get("conditions[publication_date][gte]")).toBe(
      "2026-09-21"
    );
    const leads = fedregLeads({
      results: [
        {
          document_number: "2026-19001",
          title: "Acme Tools, Inc.; Analysis To Aid Public Comment",
          publication_date: "2026-09-25",
          html_url: "https://www.federalregister.gov/d/2026-19001",
          abstract: "Consent agreement over Made in USA claims.",
        },
        {
          document_number: "2026-19002",
          title: "Data Broker LLC; Analysis To Aid Public Comment",
          publication_date: "2026-09-25",
          html_url: "https://www.federalregister.gov/d/2026-19002",
          abstract: "Privacy.",
        },
      ],
    });
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: "fedreg:2026-19001",
      org: "Competitors of Acme Tools, Inc.",
      offer: "musa_claim_file",
    });
    expect(opener(leads[0])).toContain("every brand in that category");
  });
});

describe("CBP origin rulings", () => {
  it("keeps recent origin rulings and links each one", () => {
    expect(
      new URL(cbpUrl("substantial transformation")).searchParams.get("term")
    ).toBe("substantial transformation");
    const leads = cbpLeads(
      {
        rulings: [
          {
            rulingNumber: "H345678",
            subject:
              "Country of origin of a cordless drill; substantial transformation",
            rulingDate: "2026-09-10T00:00:00",
          },
          {
            rulingNumber: "N345000",
            subject: "The tariff classification of a steel bracket",
            rulingDate: "2026-09-10T00:00:00",
          },
          {
            rulingNumber: "H300000",
            subject: "Country of origin of gloves",
            rulingDate: "2025-01-01T00:00:00",
          },
        ],
      },
      new Date("2026-08-15T00:00:00Z")
    );
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: "cbp:H345678",
      url: "https://rulings.cbp.gov/ruling/H345678",
      offer: "musa_claim_file",
      date: "2026-09-10",
    });
    expect(opener(leads[0])).toContain("all or virtually all");
  });
});

describe("CBP US-origin filter", () => {
  it("keeps only rulings that find US origin", () => {
    expect(
      cbpUsOrigin({
        text: "<p>The country of origin of the finished charger is the United States.</p>",
      })
    ).toBe(true);
    expect(cbpUsOrigin({ text: "The country of origin is China." })).toBe(
      false
    );
  });

  it("reads each ruling's text and drops foreign-origin rulings", async () => {
    const fetchImpl = async (url: string) => {
      if (url.includes("/api/search"))
        return new Response(
          JSON.stringify({
            rulings: [
              {
                rulingNumber: "H1",
                subject: "Country of origin of a drill",
                rulingDate: "2026-09-20",
              },
              {
                rulingNumber: "N2",
                subject: "Country of origin of a broom",
                rulingDate: "2026-09-20",
              },
            ],
          })
        );
      if (url.endsWith("/H1"))
        return new Response(
          JSON.stringify({ text: "the country of origin is the United States" })
        );
      return new Response(
        JSON.stringify({ text: "the country of origin is China" })
      );
    };
    const leads = await fetchCbp({
      now: NOW,
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(leads.map((l: { id: string }) => l.id)).toEqual(["cbp:H1"]);
  });
});

describe("news", () => {
  const xml = `<rss><channel>
    <item><title>Acme pilots a digital product passport for its jackets - Retail Weekly</title>
      <link>https://news.google.com/a</link><pubDate>Fri, 25 Sep 2026 09:00:00 GMT</pubDate></item>
    <item><title>Retail sales rise in September - Retail Weekly</title>
      <link>https://news.google.com/b</link><pubDate>Fri, 25 Sep 2026 09:00:00 GMT</pubDate></item>
  </channel></rss>`;

  it("keeps only headlines that name the regulation, and splits off the outlet", () => {
    expect(newsUrl('"battery passport"')).toContain("when%3A7d");
    const leads = newsLeads(parseRss(xml), "dpp_readiness", SINCE);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      source: "news",
      title: "Acme pilots a digital product passport for its jackets",
      org: "Story in Retail Weekly",
      date: "2026-09-25",
    });
  });

  it("drops market-size releases and explainers", () => {
    const noisy = `<rss><channel>
      <item><title>Digital Product Passport Market to Reach US$ 9.09 Billion by 2035 - openPR.com</title>
        <link>https://news.google.com/c</link><pubDate>Fri, 25 Sep 2026 09:00:00 GMT</pubDate></item>
      <item><title>Digital Product Passport (DPP): What it is and how the EU system works - Regtechtimes</title>
        <link>https://news.google.com/d</link><pubDate>Fri, 25 Sep 2026 09:00:00 GMT</pubDate></item>
    </channel></rss>`;
    expect(newsLeads(parseRss(noisy), "dpp_readiness", SINCE)).toEqual([]);
  });

  it("treats the same headline from two queries as one lead", () => {
    const a = newsLeads(parseRss(xml), "dpp_readiness", SINCE);
    const b = newsLeads(parseRss(xml), "dpp_readiness", SINCE);
    expect(dedupe([...a, ...b])).toHaveLength(1);
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

describe("company career boards", () => {
  const passport = "Own our EU Battery Regulation 2023/1542 passport data";

  it("reads Greenhouse, Lever and Ashby postings", () => {
    expect(
      parseGreenhouse(
        {
          jobs: [
            {
              title: "Compliance Lead",
              absolute_url: "https://gh/1",
              updated_at: "2026-09-25T10:00:00Z",
              content: `&lt;p&gt;${passport}&lt;/p&gt;`,
            },
            { title: "Designer", absolute_url: "https://gh/2", content: "UI" },
          ],
        },
        "VoltCo"
      )
    ).toMatchObject([
      { org: "VoltCo", offer: "dpp_readiness", id: "jobs:https://gh/1" },
    ]);
    expect(
      parseLever(
        [
          {
            text: "Trade Counsel",
            hostedUrl: "https://lv/1",
            createdAt: Date.parse("2026-09-25"),
            descriptionPlain: "Lead Made in USA claims review",
          },
        ],
        "forge"
      )[0]
    ).toMatchObject({
      org: "forge",
      offer: "musa_claim_file",
      date: "2026-09-25",
    });
    expect(
      parseAshby(
        {
          jobs: [
            {
              title: "Sustainability PM",
              jobUrl: "https://ab/1",
              publishedAt: "2026-09-26T00:00:00Z",
              descriptionPlain: "Ship our digital product passport",
            },
          ],
        },
        "loom"
      )[0]
    ).toMatchObject({ org: "loom", offer: "dpp_readiness" });
  });

  it("falls through to the next board and counts what resolved", async () => {
    const fetchImpl = async (url: string) => {
      const host = new URL(url).hostname;
      if (host === "api.lever.co" && url.includes("/postings/known"))
        return new Response(
          JSON.stringify([
            {
              text: "Origin analyst",
              hostedUrl: "https://lv/9",
              createdAt: Date.parse("2026-09-27"),
              descriptionPlain: "Own made in USA claims",
            },
          ])
        );
      if (host === "api.lever.co") return new Response("[]");
      return new Response("not found", { status: 404 });
    };
    const out = await fetchAts({
      since: SINCE,
      fetchImpl: fetchImpl as typeof fetch,
      seeds: ["known", "nobody"],
    });
    expect(out.map(l => l.url)).toEqual(["https://lv/9"]);
    expect(out.resolved).toBe(1);
    expect(out.seeds).toBe(2);
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

describe("DCC", () => {
  const row = (over: Record<string, unknown>) => ({
    licenseNumber: "CCL26-0000401",
    licenseStatus: "Active",
    licenseType: "Cultivation -  Small Outdoor",
    issueDate: "2026-09-28T00:00:00",
    businessLegalName: "Clear Flower LLC",
    businessOwnerName: "Private Person",
    businessEmail: "owner@example.com",
    businessPhone: "(707) 555-0100",
    premiseCounty: "Trinity",
    ...over,
  });

  it("keeps new active cultivation licences, one lead per business", () => {
    const leads = dccLeads(
      [
        row({}),
        row({
          licenseNumber: "CCL26-0000402",
          licenseType: "Cultivation - Nursery",
        }),
        row({
          licenseNumber: "OLD",
          issueDate: "2026-08-01T00:00:00",
          businessLegalName: "Old Farm",
        }),
        row({
          licenseNumber: "X",
          licenseStatus: "Expired",
          businessLegalName: "Gone",
        }),
        row({
          licenseNumber: "P",
          licenseType: "Cultivation -  Processor",
          businessLegalName: "Trim Co",
        }),
        row({
          licenseNumber: "R",
          licenseType: "Commercial -  Retailer",
          businessLegalName: "Shop",
        }),
      ],
      SINCE
    );
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: "dcc:CCL26-0000401",
      org: "Clear Flower LLC",
      title: "New cultivation licence CCL26-0000401: Small Outdoor",
      country: "Trinity County",
      date: "2026-09-28",
      offer: "strainchain_passport",
      licences: ["CCL26-0000401", "CCL26-0000402"],
    });
  });

  it("never carries owner names or contact details into the public digest", () => {
    const md = render(dccLeads([row({})], SINCE), {}, "2026-09-29");
    expect(md).not.toMatch(/Private Person|owner@example\.com|555-0100/);
  });

  it("drops the farm that declined", () => {
    const leads = dccLeads(
      [row({ businessLegalName: "Mendo Love Farms LLC" })],
      SINCE
    );
    expect(dedupe(leads)).toEqual([]);
  });
});

describe("German battery register", () => {
  const page = `
    <form id="formId" action="/ear-verzeichnis/battghersteller.jsf;jsessionid=A.b" method="post">
      <input type="hidden" name="formId" value="formId" />
      <input id="formId:herstellername" type="text" name="formId:herstellername" />
      <select name="formId:batterieart"><option value="" selected="selected">- -</option><option value="X">X</option></select>
      <input type="hidden" name="javax.faces.ViewState" value="1:2&amp;3" />
      <input type="submit" name="formId:j_idt62" value="Hersteller/Bevollm&auml;chtigten anzeigen" />
      <input type="submit" name="formId:j_idt66:j_idt220" value="&lt;&lt;" disabled="disabled" />
      <input type="submit" name="formId:j_idt66:j_idt259" value="100" />
    </form>
    <table><tbody>
      <tr><td>
        99999872</td><td>ECOPV-EU GmbH, Frankfurter Str. 70, 65760 Eschborn, Deutschland f\u00fcr Volt Cells B.V., 1 Road, Utrecht, Niederlande</td>
        <td>Ger\u00e4tebatterien</td><td>Landbell</td><td></td></tr>
      <tr><td>99999691</td><td>Gone Ltd, Street 1, Shenzhen</td><td>Ger\u00e4tebatterien</td><td></td><td>23.08.2025</td></tr>
      <tr><td>99994470</td><td>Miraja AB, Sn\u00e5rvindev\u00e4gen 109, 16574 H\u00e4sselby, Schweden</td><td>Industriebatterien</td><td></td><td></td></tr>
      <tr><td>99994300</td><td>Shenzhen Seller Co., Ltd., 5 Road, Shenzhen, China</td><td>Ger\u00e4tebatterien</td><td></td><td></td></tr>
      <tr><td>99994200</td><td>Erika Mustermann, Hauptstr. 1, 10115 Berlin, Deutschland</td><td>Ger\u00e4tebatterien</td><td></td><td></td></tr>
    </tbody></table>`;

  it("posts the whole form back with one button", () => {
    const { action, fields } = jsfForm(page);
    expect(action).toBe("/ear-verzeichnis/battghersteller.jsf;jsessionid=A.b");
    expect(fields).toContainEqual(["javax.faces.ViewState", "1:2&3"]);
    expect(fields).toContainEqual(["formId:batterieart", ""]);
    expect(fields.map(([k]) => k)).not.toContain("formId:j_idt62");
    expect(jsfButton(page, "100")).toBe("formId:j_idt66:j_idt259");
    expect(jsfButton(page, "<<")).toBeNull();
  });

  it("keeps active European companies by name only, never the address", () => {
    const leads = earLeads(earRows(page));
    expect(leads.map(l => l.org)).toEqual(["Volt Cells B.V.", "Miraja AB"]);
    expect(leads[1].country).toBe("Schweden");
    expect(leads[0]).toMatchObject({
      id: "ear:99999872",
      title: "Battery registrant 99999872: Ger\u00e4tebatterien",
      detail: "registered via ECOPV-EU GmbH",
      offer: "dpp_readiness",
      channel: "no-email",
    });
    const md = render(leads, {}, "2026-09-29");
    expect(md).not.toMatch(/Frankfurter|Road|109|Mustermann/);
  });

  it("drafts a call or letter, never an email", () => {
    const [lead] = earLeads(earRows(page));
    const text = opener(lead);
    expect(text).toMatch(/^No email/);
    expect(text).not.toMatch(/@/);
  });

  it("splits representative and producer", () => {
    expect(earParty("Rep GmbH, x f\u00fcr Maker Ltd, y, Irland")).toEqual({
      org: "Maker Ltd",
      land: "Irland",
      via: "Rep GmbH",
    });
    expect(earParty("Solo AG, x, Schweiz")).toEqual({
      org: "Solo AG",
      land: "Schweiz",
      via: "",
    });
  });

  it("caps the register after dedupe so each week surfaces new names", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `ear:${i}`,
      source: "ear",
      org: `Org ${i}`,
      title: "t",
      offer: "dpp_readiness",
    }));
    const seen = new Set(many.slice(0, 15).map(l => l.id));
    expect(dedupe(many).length).toBe(15);
    expect(dedupe(many, seen).map(l => l.id)).toEqual(
      many.slice(15).map(l => l.id)
    );
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
  it("reports each source's outcome", async () => {
    const fetchImpl = async (url: string) => {
      const host = new URL(url).hostname;
      if (host === "api.ted.europa.eu")
        return new Response(JSON.stringify({ notices: [] }));
      if (host === "www.ftc.gov") return new Response("boom", { status: 503 });
      if (host === "remotive.com")
        return new Response(JSON.stringify({ jobs: [] }));
      if (host === "api.lever.co") return new Response("[]");
      if (host === "boards-api.greenhouse.io" || host === "api.ashbyhq.com")
        return new Response("nf", { status: 404 });
      if (host === "as-dcc-pub-cann-w-p-002.azurewebsites.net")
        return new Response(JSON.stringify({ metadata: {}, data: [] }));
      return new Response(JSON.stringify({ data: [], links: {} }));
    };
    const { leads, status } = await collect({
      now: NOW,
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(leads).toEqual([]);
    expect(status.ted).toBe("0 found");
    expect(status.ftc).toMatch(/^error: 503/);
    expect(status.jobs).toBe("0 found");
    expect(status.fedreg).toBe("0 found");
    expect(status.cbp).toBe("0 found");
    expect(status.news).toBe("0 found");
    expect(status.dcc).toBe("0 found");
    expect(status.boards).toMatch(/^0 found on 0 of \d+ company boards$/);
  });

  it("renders a drafts-only digest", () => {
    const md = render([], { ted: "0 found" }, "2026-09-29");
    expect(md).toContain("nothing here has been sent");
    expect(md).toContain("No new signals this week.");
  });
});
