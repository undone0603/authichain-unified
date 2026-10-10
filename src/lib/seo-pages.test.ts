import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { listSeoPages, listSeoSlugs, getSeoPageBySlug } from "./seo-pages";
import { planById } from "./plans";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

describe("seo-pages loader", () => {
  it("loads committed pages with required fields", () => {
    const pages = listSeoPages();
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) {
      expect(p.slug).toBeTruthy();
      expect(p.title.length).toBeLessThanOrEqual(60);
      expect(p.metaDescription.length).toBeLessThanOrEqual(160);
      expect(p.bodyHtml).not.toContain("<script");
      const jsonLd: Record<string, unknown> = p.jsonLd;
      const graph = jsonLd["@graph"];
      const entity = Array.isArray(graph) ? asRecord(graph[0]) : jsonLd;
      // Article belongs here: two committed pages are explainers rather than
      // offerings ("What Is a Digital Product Passport?", "EU DPP Compliance
      // Checklist"). Typing editorial content as Product would be inaccurate
      // structured data, which search engines penalise — so the assertion
      // widens rather than the content changing to match it.
      expect(["Product", "Service", "Article"]).toContain(entity?.["@type"]);
    }
  });

  it("has unique slugs", () => {
    const slugs = listSeoSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("getSeoPageBySlug returns a page or null", () => {
    const first = listSeoSlugs()[0];
    expect(getSeoPageBySlug(first)?.slug).toBe(first);
    expect(getSeoPageBySlug("does-not-exist")).toBeNull();
  });

  it("includes the authentic agentic economy brief", () => {
    const page = getSeoPageBySlug("authentic-agentic-economy");
    expect(page).not.toBeNull();
    expect(page?.title).toBe("Authentic Agentic Economy | AuthiChain");
    expect(page?.jsonLd["@type"]).toBe("Article");
    expect(page?.bodyHtml).toContain("authentic agentic economy");
    expect(page?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(page?.bodyHtml).toContain('name="email"');
    expect(page?.bodyHtml).toContain(
      'href="https://authichain.govchain.us/x402"'
    );
    expect(page?.bodyHtml).not.toContain("GET /api/checkout");
    expect(page?.jsonLd.url).toBe(
      "https://authichain.com/authentic-agentic-economy"
    );
  });

  it("cannabis CoA hub offers Passport and not Farm checkout", () => {
    const page = getSeoPageBySlug("cannabis-coa-verification-blockchain");
    expect(page).not.toBeNull();
    expect(page?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(page?.bodyHtml).not.toContain(
      "https://authichain.com/checkout/strainchain_farm"
    );
  });
});

const GENERATED_HOW_IT_WORKS =
  "Issue a unique identifier per unit and link it to a signed record";

// Mirrors scripts/gen-seo-pages.cjs PROTECTED_SEED_SLUGS — hand-authored pages
// that must not be rewritten when the generator runs.
const PROTECTED_SEED_SLUGS = new Set([
  "ai-qr-code-art-generator",
  "anti-counterfeit-qr-verification",
  "authentic-agentic-economy",
  "battery-passport-due-diligence-requirement",
  "biotrack-integration-blockchain-provenance",
  "blockchain-product-authentication",
  "cannabis-blockchain-provenance",
  "cannabis-coa-verification-blockchain",
  "counterfeit-detection-with-ai",
  "digital-product-passport-access-rights",
  "dispensary-qr-provenance-scanning",
  "dscsa-compliance-blockchain-serialization",
  "editable-qr-code-no-reprint",
  "eu-dpp-compliance-checklist",
  "government-document-verification-blockchain",
  "government-rfp-award-verification-blockchain",
  "living-qr-code-art-generator",
  "metrc-compliance-blockchain",
  "offline-permit-certificate-qr-verification",
  "partner-program",
  "ppwr-digital-labelling-qr-code",
  "sbir-svip-blockchain-document-verification",
  "untp-digital-product-passport",
  "w3c-verifiable-credentials-product-authentication",
  "what-is-a-digital-product-passport",
]);

const PROTECTED_SEED_MARKERS: Record<string, string> = {
  "blockchain-product-authentication": "the manufacturer holds the keys, not us",
  "cannabis-blockchain-provenance": "What you get",
  "what-is-a-digital-product-passport": "What a DPP contains",
};

describe("generated SEO money-path CTAs", () => {
  it("places a live checkout or pricing CTA after How it works and before FAQ", () => {
    const generated = listSeoPages().filter(
      p =>
        p.bodyHtml.includes(GENERATED_HOW_IT_WORKS) &&
        !PROTECTED_SEED_SLUGS.has(p.slug)
    );
    expect(generated.length).toBeGreaterThan(0);

    for (const p of generated) {
      const how = p.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = p.bodyHtml.indexOf("<h2>Get started</h2>");
      const faq = p.bodyHtml.indexOf("<h2>FAQ</h2>");
      expect(how).toBeGreaterThan(-1);
      expect(cta).toBeGreaterThan(how);
      // A page with no FAQs (e.g. the noindex QFS explainer) omits the section.
      if (faq !== -1) expect(faq).toBeGreaterThan(cta);
    }
  });

  it("does not sell the $299 checkout as a written assessment or a Basic credit", () => {
    const banned = [
      "sample $299 battery assessment",
      "credited toward AuthiChain Basic",
      "written readiness assessment",
      "written EU DPP readiness assessment",
      "written plan for your product line",
      "Want to see the deliverable first?",
    ];
    for (const page of listSeoPages()) {
      const blob = `${page.bodyHtml}\n${JSON.stringify(page.jsonLd)}`;
      for (const phrase of banned) {
        expect(blob, `${page.slug} ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it("links AuthiChain DPP / battery / textiles hubs to live DPP checkout", () => {
    const batteries = getSeoPageBySlug("eu-digital-product-passport-batteries");
    const textiles = getSeoPageBySlug("eu-digital-product-passport-textiles");
    expect(batteries?.bodyHtml).toContain('name="email"');
    expect(batteries?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(batteries?.bodyHtml).not.toContain('href="/api/checkout');
    expect(batteries?.bodyHtml).toContain(
      'href="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(textiles?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(batteries?.bodyHtml).toContain(
      'href="https://authichain.com/pricing"'
    );
    expect(batteries?.bodyHtml).toContain(
      'href="https://authichain.com/dpp-check"'
    );
  });

  it("links Made in USA / origin-claim hubs to DPP checkout and the Made in America brief", () => {
    const musa = getSeoPageBySlug("ftc-made-in-usa-labeling-verification");
    const origin = getSeoPageBySlug(
      "made-in-america-origin-claim-substantiation"
    );
    expect(musa?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(musa?.bodyHtml).toContain(
      'href="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(musa?.bodyHtml).toContain(
      'href="https://authichain.govchain.us/made-in-america"'
    );
    expect(origin?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(origin?.bodyHtml).toContain(
      'href="https://authichain.govchain.us/made-in-america"'
    );
  });

  it("links TruMark hubs to live passport checkout and the TruMark brief", () => {
    const trumark = getSeoPageBySlug("trumark-product-authentication-seal");
    expect(trumark?.bodyHtml).toContain('name="email"');
    expect(trumark?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(trumark?.bodyHtml).not.toContain('href="/api/checkout');
    expect(trumark?.bodyHtml).toContain(
      'href="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(trumark?.bodyHtml).toContain(
      'href="https://authichain.govchain.us/trumark"'
    );
  });

  it("links StrainChain cannabis hubs to live passport checkout and pricing", () => {
    const cannabis = getSeoPageBySlug("blockchain-qr-code-for-cannabis");
    expect(cannabis?.bodyHtml).toContain('name="email"');
    expect(cannabis?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(cannabis?.bodyHtml).not.toContain('href="/api/checkout');
    expect(cannabis?.bodyHtml).toContain(
      'href="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(cannabis?.bodyHtml).toContain(
      'href="https://strainchain.io/pricing"'
    );
  });

  it("links QRON hubs to qron.space/pricing and GovChain hubs to live onboard", () => {
    const qron = getSeoPageBySlug("gs1-digital-link-sunrise-2027");
    const gov = getSeoPageBySlug(
      "product-authentication-for-government-supply-chain"
    );
    expect(qron?.bodyHtml).toContain('href="https://qron.space/pricing"');
    expect(qron?.bodyHtml).not.toContain("/api/checkout/");
    // govchain.us/pricing 404s; /onboard is the live conversion path
    expect(gov?.bodyHtml).toContain('href="https://govchain.us/onboard"');
    expect(gov?.bodyHtml).not.toContain("/api/checkout/");
  });

  it("does not rewrite hand-authored protected seed copy", () => {
    for (const slug of PROTECTED_SEED_SLUGS) {
      const page = getSeoPageBySlug(slug);
      expect(page, slug).toBeTruthy();
    }
    for (const [slug, marker] of Object.entries(PROTECTED_SEED_MARKERS)) {
      expect(getSeoPageBySlug(slug)?.bodyHtml).toContain(marker);
    }
  });

  it("appends a single live money CTA to every protected seed", () => {
    for (const slug of PROTECTED_SEED_SLUGS) {
      const page = getSeoPageBySlug(slug);
      expect(page, slug).toBeTruthy();
      const matches = page?.bodyHtml.match(/<h2>Get started<\/h2>/g) ?? [];
      expect(matches, slug).toHaveLength(1);
    }
  });

  it("routes seed CTAs to the same live money URLs as generated hubs", () => {
    const dpp = getSeoPageBySlug("what-is-a-digital-product-passport");
    expect(dpp?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(dpp?.bodyHtml).toContain('name="email"');
    expect(dpp?.bodyHtml).toContain('href="https://authichain.com/pricing"');
    expect(dpp?.bodyHtml).not.toContain('href="/api/checkout');
    expect(dpp?.bodyHtml).toContain(
      'href="https://authichain.com/checkout/dpp_readiness"'
    );

    const cannabis = getSeoPageBySlug("cannabis-blockchain-provenance");
    expect(cannabis?.bodyHtml).toContain(
      'action="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(cannabis?.bodyHtml).toContain(
      'href="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(cannabis?.bodyHtml).toContain(
      'href="https://strainchain.io/pricing"'
    );

    const gov = getSeoPageBySlug("government-document-verification-blockchain");
    expect(gov?.bodyHtml).toContain('href="https://govchain.us/onboard"');
    expect(gov?.bodyHtml).not.toContain("/api/checkout/");

    const qron = getSeoPageBySlug("ai-qr-code-art-generator");
    expect(qron?.bodyHtml).toContain('href="https://qron.space/pricing"');
    expect(qron?.bodyHtml).not.toContain("/api/checkout/");
  });

  it("no page advertises a price or chain that is not real", () => {
    // $49/mo was never an AuthiChain SKU and nothing anchors to Bitcoin L1.
    // Workers serve pages.json verbatim, so this guards the data itself.
    for (const p of listSeoPages()) {
      const blob = JSON.stringify(p);
      expect(blob, p.slug).not.toMatch(/\$49\s*\/\s*mo/i);
      expect(blob, p.slug).not.toContain("Bitcoin L1");
    }
  });

  it("no page renames the $299 SKU to 'EU DPP Workspace'", () => {
    // Checkout still sells "EU DPP Readiness"; pages.json must match it.
    for (const p of listSeoPages()) {
      expect(JSON.stringify(p), p.slug).not.toMatch(/EU DPP Workspace/i);
    }
  });

  it("seo-data/comparison.cjs (pages.json generator input) never says 'EU DPP Workspace'", async () => {
    const file = path.resolve(__dirname, "../../scripts/seo-data/comparison.cjs");
    expect(fs.readFileSync(file, "utf8")).not.toMatch(/EU DPP Workspace/i);
    const mod = await import(file);
    const data = (mod as { default?: unknown }).default ?? mod;
    expect(JSON.stringify(data)).not.toMatch(/EU DPP Workspace/i);
  });

  it("every stated DPP Readiness price matches src/lib/plans.ts", () => {
    const price = planById("dpp_readiness")?.price;
    expect(price).toBeGreaterThan(0);
    for (const p of listSeoPages()) {
      for (const m of p.bodyHtml.matchAll(
        /EU DPP Readiness is \$(\d+) one-time/g
      )) {
        expect(Number(m[1]), p.slug).toBe(price);
      }
    }
  });

  it("RES-12: no AuthiChain or GovChain page claims Polygon anchoring or offline operation", () => {
    for (const p of listSeoPages()) {
      const text = JSON.stringify(p);
      if (p.brand === "AuthiChain") {
        expect(text, p.slug).not.toMatch(
          /anchored (on|to) Polygon|anchors (certificates|unit-level verification) on Polygon|Polygon anchoring/i
        );
      }
      if (p.brand === "GovChain") {
        expect(text, p.slug).not.toMatch(
          /works? offline|offline-capable|without connectivity|low-connectivity/i
        );
      }
    }
  });

  it("RES-13: no page claims Polygon or blockchain anchoring in the present tense", () => {
    for (const p of listSeoPages()) {
      const text = JSON.stringify(p);
      expect(text, p.slug).not.toMatch(
        /anchored (on|to) Polygon|Polygon-anchored|Polygon anchoring|blockchain-anchored|hashes and anchors/i
      );
      expect(text, p.slug).not.toMatch(/offline-verification problem GovChain/i);
    }
  });

  it("CFA-155: no SEO page claims a contract live or deployed on Polygon, or links 0x4da4", () => {
    const banned = /(live|deployed) on Polygon|0x4da4/i;
    for (const p of listSeoPages()) {
      expect(JSON.stringify(p), p.slug).not.toMatch(banned);
    }
    for (const slug of [
      "blockchain-product-authentication",
      "counterfeit-detection-with-ai",
      "blockchain-qr-code-for-luxury",
      "vechain-alternative-without-tokens-or-gas-fees",
    ]) {
      const page = getSeoPageBySlug(slug);
      expect(page, slug).toBeTruthy();
      expect(JSON.stringify(page), slug).not.toMatch(banned);
    }
  });

  it("CFA-155: the generator data files do not carry the Polygon contract claim", () => {
    const dir = path.join(process.cwd(), "scripts", "seo-data");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".cjs"));
    expect(files.length).toBeGreaterThan(0);
    const sources = [
      ...files.map((f) => path.join(dir, f)),
      path.join(process.cwd(), "scripts", "gen-seo-pages.cjs"),
    ];
    for (const f of sources) {
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(
        /(live|deployed) on Polygon|0x4da4/i
      );
    }
  });

  it("DPP explainer seed does not advertise $49/mo or Bitcoin L1", () => {
    const dpp = getSeoPageBySlug("what-is-a-digital-product-passport");
    expect(dpp?.bodyHtml).toContain("What a DPP contains");
    expect(dpp?.bodyHtml).toContain("EU DPP Readiness is $299 one-time.");
    expect(dpp?.bodyHtml).not.toContain("Ed25519-signed");
    expect(dpp?.bodyHtml).not.toContain("anchored on Polygon");
    expect(dpp?.bodyHtml).not.toContain("$49/mo");
    expect(dpp?.bodyHtml).not.toContain("Bitcoin L1");
    expect(dpp?.jsonLd.url).toBe(
      "https://authichain.com/p/what-is-a-digital-product-passport"
    );
  });
  it("RES-100: footwear page has no unsourced forecasts or live-issuance claims", () => {
    const p = getSeoPageBySlug("eu-digital-product-passport-footwear");
    expect(p).not.toBeNull();
    const text = JSON.stringify(p);
    expect(text).not.toMatch(/feasibility/i);
    expect(text).not.toMatch(/follow the textiles/i);
    expect(text).not.toMatch(/can even be proposed/i);
    expect(text).not.toMatch(/link it to a signed record/i);
    expect(text).not.toMatch(/signed record published now/i);
    expect(p?.bodyHtml).toContain("Signed records are in development.");
    expect(p?.bodyHtml).toContain("a Commission study on footwear due by the end of 2027.</p>");
    expect(p?.metaDescription.endsWith("by the end of 2027.")).toBe(true);
  });

  it("RES-103: no page claims records are already issuing or offers proof of origin", () => {
    for (const p of listSeoPages()) {
      const text = JSON.stringify(p);
      expect(text, p.slug).not.toMatch(/already issuing/i);
      expect(text, p.slug).not.toMatch(/proof of origin/i);
    }
  });
});
