import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const buildEntry = require(path.join(root, "scripts/seo-data/build-entry.cjs"));
const claims = require(path.join(root, "scripts/seo-data/claim-goals.cjs"));
const generator = require(path.join(root, "scripts/gen-seo-pages.cjs"));

const {
  assembleCatalogue,
  assertStatusLegal,
  firstParagraph,
  ownerForSlug,
  recordsForSlug,
} = buildEntry;

const DENYLIST = [
  "Issue EU Digital Product Passports",
  "Provide EU Digital Product Passports",
  "Generate EU Digital Product Passports",
  "Generate EU Battery Passports",
  "Create EU Digital Product Passports",
  "EPCIS 2.0 + JSON-LD registry export",
  "EPCIS events export into a W3C Verifiable Credential without a schema rewrite",
  "EPCIS-compatible event data at the unit level",
  "Every required field check runs before a record is accepted",
  "Genuine-part verification runs offline",
  "verification confirms whether a specific part is OEM-genuine",
  "A signature proves a part was issued by the manufacturer",
  "a signed record a scanner checks offline does that",
  "unit-level serialization this protocol issues",
  "confirm what they received is genuine",
  "AuthiChain issues that record as a signed Verifiable Credential",
  "AuthiChain already issues DPP records for six of these categories",
  "AuthiChain already solves",
  "the same signed-record format AuthiChain already issues",
  "METRC and BioTrack sync",
  "METRC/BioTrack-synced provenance",
  "medicine is genuine and unexpired",
  "confirm a part is genuine OEM by scanning it",
  "Issue a unique identifier per unit and link it to a signed record",
];

function page(slug: string, html: string) {
  return {
    slug,
    keyword: slug.replace(/-/g, " "),
    brand: "AuthiChain",
    domain: "authichain.com",
    title: "Title",
    metaDescription: "Meta",
    h1: "Heading",
    bodyHtml: html,
    jsonLd: { url: `https://authichain.com/p/${slug}` },
  };
}

function dataEntry(keyword: string, lead: string) {
  return {
    keyword,
    brand: "authichain",
    schemaType: "Service",
    lead,
    bullets: [] as string[],
    faqs: [] as { q: string; a: string }[],
  };
}

function slugsFromSetSource(source: string): string[] {
  const match = source.match(/const PROTECTED_SEED_SLUGS = new Set\(\[([\s\S]*?)\]\)/);
  if (!match) throw new Error("PROTECTED_SEED_SLUGS not found");
  return [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]).sort();
}

describe("claim goal ledger", () => {
  it("throws when a held page would emit a banned currentSentence", () => {
    const synthetic = [
      {
        id: "held-ban",
        class: "copy-only",
        emit: "hold",
        status: "open",
        limitPermanent: false,
        publicGoal: true,
        currentSentence: "BANNED HELD LEAD",
        goalSentence: "Our goal: a later check.",
        bannedRestorations: [],
        slugs: ["held-slug"],
        blockedBy: "none",
      },
    ];
    expect(() =>
      assembleCatalogue({
        data: [dataEntry("held slug", "A replacement lead.")],
        existing: [page("held-slug", "<p>BANNED HELD LEAD</p>")],
        claims: synthetic,
        protectedSeedSlugs: new Set(),
        outLabel: "memory",
      })
    ).toThrow(/banned currentSentence/);
  });

  it("throws when a goal page would emit a banned currentSentence", () => {
    const synthetic = [
      {
        id: "goal-ban",
        class: "copy-only",
        emit: "goal",
        status: "open",
        limitPermanent: false,
        publicGoal: true,
        currentSentence: "BANNED GOAL LEAD",
        goalSentence: "Our goal: a later check.",
        bannedRestorations: [],
        slugs: ["goal-slug"],
        blockedBy: "none",
      },
    ];
    expect(() =>
      assembleCatalogue({
        data: [dataEntry("goal slug", "BANNED GOAL LEAD stays in DATA.")],
        existing: [page("goal-slug", "<p>already replaced</p>")],
        claims: synthetic,
        protectedSeedSlugs: new Set(),
        outLabel: "memory",
      })
    ).toThrow(/banned currentSentence/);
  });

  it("throws when a permanent limit is missing", () => {
    const synthetic = [
      {
        id: "missing-limit",
        class: "copy-only",
        emit: "hold",
        status: "open",
        limitPermanent: true,
        publicGoal: true,
        currentSentence: "This limit must stay.",
        goalSentence: "Our goal: later.",
        bannedRestorations: [],
        slugs: ["limit-slug"],
        blockedBy: "none",
      },
    ];
    expect(() =>
      assembleCatalogue({
        data: [dataEntry("limit slug", "Other lead.")],
        existing: [page("limit-slug", "<p>The limit was deleted.</p>")],
        claims: synthetic,
        protectedSeedSlugs: new Set(),
        outLabel: "memory",
      })
    ).toThrow(/permanent limit missing/);
  });

  it("copy-only cannot be done", () => {
    expect(() =>
      assertStatusLegal([
        {
          id: "copy-done",
          class: "copy-only",
          status: "done",
          blockedBy: "none",
        },
      ])
    ).toThrow(/copy-only cannot be status done/);
  });

  it("deleting a published limit fails even if status is done", () => {
    const synthetic = [
      {
        id: "done-but-deleted",
        class: "behavior-later",
        emit: "hold",
        status: "done",
        limitPermanent: true,
        publicGoal: true,
        currentSentence: "This published limit stays.",
        goalSentence: "Our goal: later.",
        bannedRestorations: [],
        slugs: ["done-slug"],
        blockedBy: "none",
      },
    ];
    expect(() => assertStatusLegal(synthetic)).not.toThrow();
    expect(() =>
      assembleCatalogue({
        data: [dataEntry("done slug", "Other lead.")],
        existing: [page("done-slug", "<p>The published limit was deleted.</p>")],
        claims: synthetic,
        protectedSeedSlugs: new Set(),
        outLabel: "memory",
      })
    ).toThrow(/permanent limit missing/);
  });

  it("gives each generated slug one public goal", () => {
    const catalogue = generator.loadCatalogue();
    expect(catalogue.generated.length).toBeGreaterThan(0);
    for (const page of catalogue.generated) {
      const owners = recordsForSlug(claims, page.slug).filter(
        (record: { publicGoal?: boolean }) => record.publicGoal === true
      );
      expect(owners.length, page.slug).toBeLessThanOrEqual(1);
      expect(ownerForSlug(claims, page.slug).id, page.slug).toBeTruthy();
    }
  });

  it("owns every denylist hit with a currentSentence", () => {
    const dir = path.join(root, "scripts", "seo-data");
    const files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".cjs"))
      .map((name) => path.join(dir, name));
    files.push(path.join(root, "scripts", "gen-seo-pages.cjs"));
    files.push(path.join(root, "content", "seo", "pages.json"));
    const corpus = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    for (const phrase of DENYLIST) {
      if (!corpus.includes(phrase)) continue;
      const owner = claims.find(
        (record: { currentSentence?: string }) =>
          record.currentSentence != null && record.currentSentence.includes(phrase)
      );
      expect(owner, phrase).toBeTruthy();
    }
    const how = claims.find((record: { id: string }) => record.id === "generated-how-it-works");
    expect(how.status).toBe("open");
    expect(how.limitPermanent).toBe(false);
  });

  it("matches the protected seed set in seo-pages.test.ts", () => {
    const fromTest = slugsFromSetSource(
      fs.readFileSync(path.join(root, "src/lib/seo-pages.test.ts"), "utf8")
    );
    const fromGenerator = [...generator.PROTECTED_SEED_SLUGS].sort();
    expect(fromGenerator).toEqual(fromTest);
  });

  it("leaves held JSON leads in place", () => {
    const pagesPath = path.join(root, "content", "seo", "pages.json");
    const before = fs.readFileSync(pagesPath);
    const pages = JSON.parse(before.toString("utf8"));
    const catalogue = generator.loadCatalogue(pages);
    expect(fs.readFileSync(pagesPath).equals(before)).toBe(true);
    for (const slug of Object.keys(claims.GROUP_D_LEADS)) {
      const committed = pages.find((entry: { slug: string }) => entry.slug === slug);
      const held = catalogue.generated.find((entry: { slug: string }) => entry.slug === slug);
      expect(committed, slug).toBeTruthy();
      expect(held, slug).toBeTruthy();
      expect(firstParagraph(held.bodyHtml), slug).toBe(firstParagraph(committed.bodyHtml));
    }
  });

  it("permanent limits stay on the published surface", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "seo", "pages.json"), "utf8")
    );
    const notAnother = claims.find(
      (record: { id: string }) => record.id === "seed-cannabis-not-another-compliance-tool"
    );
    expect(notAnother.limitPermanent).toBe(true);
    const permanentSentences = claims
      .filter((record: { limitPermanent?: boolean }) => record.limitPermanent === true)
      .map((record: { currentSentence?: string }) => record.currentSentence || "");
    expect(permanentSentences.join("\n")).toContain(
      "This page is not another compliance tool."
    );
    for (const record of claims) {
      if (record.limitPermanent !== true || !record.currentSentence) continue;
      if (record.checkFile) {
        const text = fs.readFileSync(path.join(root, record.checkFile), "utf8");
        expect(text, record.id).toContain(record.currentSentence);
      }
      for (const slug of record.slugs || []) {
        const published = pages.find((entry: { slug: string }) => entry.slug === slug);
        expect(published, `${record.id} ${slug}`).toBeTruthy();
        expect(JSON.stringify(published), `${record.id} ${slug}`).toContain(record.currentSentence);
      }
    }
  });

  it("battery hub keeps issuance in development beside its one public goal", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "seo", "pages.json"), "utf8")
    );
    const battery = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-batteries"
    );
    const text = JSON.stringify(battery);
    expect(text).toContain("Battery passport issuance is in development.");
    const owners = recordsForSlug(claims, "eu-digital-product-passport-batteries").filter(
      (record: { publicGoal?: boolean }) => record.publicGoal === true
    );
    expect(owners.map((record: { id: string }) => record.id)).toEqual([
      "seo-battery-issuance-in-development",
    ]);
  });

  it("publishes the homepage goals beside their limits", () => {
    const index = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/index.ts"),
      "utf8"
    );
    const route = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/manufacturer-status-route.ts"),
      "utf8"
    );
    const published = [
      "homepage-registry-in-development",
      "homepage-camera-scan-not-live",
      "homepage-signed-record-not-inspection",
      "manufacturer-flag-admin-set",
    ];
    for (const id of published) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.limitPermanent, id).toBe(true);
      const text = record.checkFile.endsWith("manufacturer-status-route.ts") ? route : index;
      expect(text, id).toContain(record.goalSentence);
      expect(text, id).toContain(record.currentSentence);
    }
    const history = claims.find(
      (entry: { id: string }) => entry.id === "homepage-history-demo-not-inspection"
    );
    expect(history.publicGoal).toBe(false);
    expect(history.status).toBe("open");
    expect(index).toContain(history.currentSentence);
    expect(index).not.toContain(history.goalSentence);
    expect(index).toContain(
      'body: "Every product gets a seal. Public certificate lookup for people and agents is in development."'
    );
    expect(route).toContain("Role and manufacturer events are only the latest 10,000 blocks.");
  });

  it("publishes the DPP goals beside their limits", () => {
    const index = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/index.ts"),
      "utf8"
    );
    const published = [
      "dpp-exports-not-live",
      "dpp-pharma-not-dscsa",
      "dpp-cannabis-not-metrc",
      "dpp-luxury-not-inspection",
      "dpp-readiness-checkout-cta",
      "dpp-h2-passport-tooling",
    ];
    for (const id of published) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.limitPermanent, id).toBe(true);
      expect(index, id).toContain(record.goalSentence);
      expect(index, id).toContain(record.currentSentence);
    }
    const pharma = index.slice(index.indexOf("Pharmaceuticals"), index.indexOf("Electronics"));
    expect(pharma).toContain("Not a DSCSA certification");
    expect(pharma).not.toContain("Our goal: a licensee compares a local record");
    const luxury = index.slice(index.indexOf("💎 Luxury Goods"), index.indexOf("🌿 Cannabis"));
    expect(luxury).toContain("Goal: counterfeit detection for luxury goods.");
    expect(luxury).not.toContain("Our goal:");
    const cannabisAt = index.indexOf("🌿 Cannabis");
    const cannabis = index.slice(cannabisAt, index.indexOf("</section>", cannabisAt));
    expect(cannabis).toContain("Not a METRC or BioTrack connection");
    expect(cannabis).not.toContain("Our goal: a pharmacist compares");
    expect(index).toContain('action: "/protocol/checkout/dpp"');
    expect(index).toContain("/checkout/dpp_readiness");
  });

  it("publishes one goal on each retitled hub and protected seed", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const owners = [
      "hub-metrc-not-connection",
      "hub-biotrack-not-connection",
      "hub-coa-certs-not-linked",
      "hub-dscsa-not-compliance",
      "hub-recall-not-connection",
      "seed-cannabis-blockchain-provenance",
      "seed-dispensary-qr-provenance",
    ];
    for (const id of owners) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      const page = pages.find((entry: { slug: string }) => entry.slug === record.slugs[0]);
      const blob = `${page.title}\n${page.h1}\n${page.metaDescription}\n${page.bodyHtml}`;
      expect(blob, id).toContain(record.goalSentence);
      expect(blob, id).toContain(record.currentSentence);
      expect(page.metaDescription, id).not.toContain("Our goal");
      expect(page.title, id).not.toContain("Our goal");
      expect(page.h1, id).not.toContain("Our goal");
    }
    const pageBy = (slug: string) =>
      pages.find((entry: { slug: string }) => entry.slug === slug).bodyHtml as string;
    expect(pageBy("metrc-compliance-blockchain")).not.toContain(
      "Our goal: a scan checks a signed record for that unit."
    );
    expect(pageBy("cannabis-coa-verification-blockchain")).not.toContain(
      "Our goal: a licensee compares a local record to a package identifier they already hold."
    );
    expect(pageBy("dscsa-compliance-blockchain-serialization")).not.toContain(
      "Our goal: a scan checks a signed record for that unit."
    );
    const recall = pageBy("cannabis-product-recall-traceability");
    expect(recall).toContain("Issue a unique identifier per unit and link it to a signed record.");
    expect(recall).not.toContain("Our goal: a scan checks a signed record for that unit.");
    expect(recall).not.toContain("Our goal: attach a lab retest to a unit record.");
    expect(recall).not.toContain("Our goal: show a lab result on the recall page.");
    const seed = pageBy("cannabis-blockchain-provenance");
    expect(seed).toContain("This page is not another compliance tool.");
    expect(seed).not.toContain("alongside your existing compliance");
    expect(seed).not.toContain("Our goal: describe the page as a brand surface without calling it a compliance tool.");
    expect(seed).not.toContain("Our goal: show a lab result on this page.");
    expect(seed).not.toContain("Our goal: show provenance across jurisdictions.");
    expect(pageBy("dispensary-qr-provenance-scanning")).not.toContain(
      "Our goal: verify a lab certificate on this page."
    );
    const recallSource = fs.readFileSync(
      path.join(root, "scripts/seo-data/regulatory.cjs"),
      "utf8"
    );
    expect(recallSource).toContain(
      "Our goal: a scan names the units a licensee would isolate in a recall they already run."
    );
  });

  it("publishes one goal on each scan, seal, and battery page", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const owners = [
      "scan-not-proof-medicine",
      "scan-not-proof-product",
      "scan-not-proof-cannabis-generated",
      "government-records-in-development",
      "aerospace-not-airworthiness",
      "seo-battery-issuance-in-development",
      "battery-lead-form-not-passport",
    ];
    const pageBy = (slug: string) =>
      pages.find((entry: { slug: string }) => entry.slug === slug);
    for (const id of owners) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.limitPermanent, id).toBe(true);
      if (record.checkFile) {
        const text = fs.readFileSync(path.join(root, record.checkFile), "utf8");
        expect(text, id).toContain(record.goalSentence);
        expect(text, id).toContain(record.currentSentence);
        continue;
      }
      for (const slug of record.slugs) {
        const page = pageBy(slug);
        expect(page, `${id} ${slug}`).toBeTruthy();
        const blob = `${page.title}\n${page.h1}\n${page.metaDescription}\n${page.bodyHtml}`;
        expect(blob, `${id} ${slug}`).toContain(record.goalSentence);
        expect(blob, `${id} ${slug}`).toContain(record.currentSentence);
        expect(page.title, `${id} ${slug}`).not.toContain("Our goal");
        expect(page.h1, `${id} ${slug}`).not.toContain("Our goal");
        expect(page.metaDescription, `${id} ${slug}`).not.toContain("Our goal");
      }
    }
    const product = pageBy("product-authentication-for-electronics");
    expect(product.bodyHtml).toContain(
      "Issuing a customer product certificate is in development."
    );
    expect(product.bodyHtml).not.toContain(
      "Our goal: issue a customer product certificate for one unit."
    );
    expect(product.bodyHtml).not.toContain(
      "Our goal: verify issues a customer product certificate for one unit."
    );
    expect(pageBy("blockchain-qr-code-for-pharma").bodyHtml).not.toContain(
      "Our goal: a scan checks a signed record for that unit."
    );
    expect(pageBy("blockchain-qr-code-for-cannabis").bodyHtml).not.toContain(
      "Our goal: a package scan a dispensary can compare to its own track-and-trace export."
    );
    const battery = pageBy("eu-digital-product-passport-batteries");
    expect(battery.bodyHtml).toContain("Battery passport issuance is in development.");
    expect(battery.bodyHtml).not.toContain(
      "Our goal: a scan checks a signed record for that pack."
    );
    expect(battery.bodyHtml).not.toContain("Issue a unique identifier per unit");
    expect(pageBy("blockchain-qr-code-for-defense").bodyHtml).not.toContain("FAR-aligned");
    const regulatory = fs.readFileSync(
      path.join(root, "scripts/seo-data/regulatory.cjs"),
      "utf8"
    );
    const batteries = regulatory.slice(
      regulatory.indexOf("keyword: 'eu digital product passport batteries'"),
      regulatory.indexOf("keyword: 'eu digital product passport electronics'")
    );
    expect(batteries).toContain(
      "Our goal: issue one battery passport record for a single pack, with carbon-footprint, state-of-health, and material-recovery fields."
    );
    expect(batteries).not.toContain("anchored on-chain");
    const industry = fs.readFileSync(
      path.join(root, "scripts/seo-data/industry.cjs"),
      "utf8"
    );
    expect(industry).not.toContain("medicine is genuine and unexpired");
    expect(industry).not.toContain("METRC and BioTrack sync");
  });

  it("publishes the free x402 goals in the body and not the meta", () => {
    const llms = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/llms-txt.ts"),
      "utf8"
    );
    const x402 = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/x402-docs-page.ts"),
      "utf8"
    );
    const published = ["llms-empty-body-unpaid-402", "x402-free-answer-not-receipt"];
    for (const id of published) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      const text = id.startsWith("llms") ? llms : x402;
      expect(text, id).toContain(record.goalSentence);
      expect(text, id).toContain(record.currentSentence);
    }
    const meta = claims.find((entry: { id: string }) => entry.id === "x402-meta-free-not-receipt");
    expect(meta.publicGoal).toBe(false);
    expect(meta.status).toBe("open");
    expect(x402).toContain(meta.currentSentence);
    expect(x402).not.toContain(meta.goalSentence);
    expect(llms).not.toContain("freeCalls");
    expect(x402).not.toContain("in development");
  });

  it("publishes the agentic-economy goals beside their limits and not in the meta", () => {
    const page = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/authentic-agentic-economy-page.ts"),
      "utf8"
    );
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const seed = pages.find(
      (entry: { slug: string }) => entry.slug === "authentic-agentic-economy"
    );
    const published = [
      "agentic-seed-not-inspection",
      "agentic-page-not-inspection",
      "agentic-pay-faq-free-not-receipt",
      "agentic-not-erc-8004",
    ];
    for (const id of published) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.limitPermanent, id).toBe(true);
      const text = id === "agentic-seed-not-inspection" ? JSON.stringify(seed) : page;
      expect(text, id).toContain(record.goalSentence);
      expect(text, id).toContain(record.currentSentence);
    }
    expect(seed.metaDescription).not.toContain("Our goal");
    expect(seed.title).not.toContain("Our goal");
    expect(seed.h1).not.toContain("Our goal");
    expect(JSON.stringify(seed.jsonLd)).not.toContain("Our goal");
    expect(seed.metaDescription).toBe(
      "The authentic agentic economy: signed seals, MCP, and x402. A signed record is not a physical inspection."
    );
    const receipt = claims.find(
      (entry: { id: string }) => entry.id === "agentic-seed-body-not-receipt"
    );
    const demonstration = claims.find(
      (entry: { id: string }) => entry.id === "agentic-seed-demonstration"
    );
    expect(receipt.publicGoal).toBe(false);
    expect(receipt.status).toBe("open");
    expect(demonstration.publicGoal).toBe(false);
    expect(demonstration.status).toBe("open");
    const seedText = JSON.stringify(seed);
    expect(seedText).toContain(receipt.currentSentence);
    expect(seedText).toContain(demonstration.currentSentence);
    expect(seedText).not.toContain(receipt.goalSentence);
    expect(seedText).not.toContain(demonstration.goalSentence);
    expect(page).not.toContain(receipt.goalSentence);
    expect(page).not.toContain(demonstration.goalSentence);
    expect(page).toContain("$0.05 USDC");
    expect(page).not.toContain("in development");
  });

  it("publishes the MCP install goal in the lede and not the meta", () => {
    const mcp = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/mcp-install-page.ts"),
      "utf8"
    );
    const x402 = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/x402-docs-page.ts"),
      "utf8"
    );
    const install = claims.find(
      (entry: { id: string }) => entry.id === "mcp-install-not-inspection"
    );
    expect(install.status).toBe("goal-published");
    expect(install.publicGoal).toBe(true);
    expect(install.limitPermanent).toBe(true);
    expect(mcp).toContain(install.goalSentence);
    expect(mcp).toContain(install.currentSentence);
    const meta = mcp.match(/<meta name="description" content="([^"]*)"/);
    expect(meta?.[1]).toContain(install.currentSentence);
    expect(meta?.[1]).not.toContain("Our goal");
    expect((meta?.[1] ?? "").length).toBeLessThanOrEqual(160);
    const legacy = claims.find(
      (entry: { id: string }) => entry.id === "mcp-legacy-x402-402"
    );
    expect(legacy.publicGoal).toBe(false);
    expect(legacy.status).toBe("open");
    expect(mcp).toContain(legacy.currentSentence);
    expect(mcp).not.toContain(legacy.goalSentence);
    const xmeta = claims.find(
      (entry: { id: string }) => entry.id === "x402-meta-free-not-receipt"
    );
    const body = claims.find(
      (entry: { id: string }) => entry.id === "x402-free-answer-not-receipt"
    );
    expect(xmeta.publicGoal).toBe(false);
    expect(xmeta.status).toBe("open");
    expect(x402).toContain(xmeta.currentSentence);
    expect(x402).not.toContain(xmeta.goalSentence);
    expect(x402).toContain(body.goalSentence);
    expect(x402.match(/Our goal/g)).toHaveLength(1);
  });

  it("does not name ops/scripts/gen-seo-pages.cjs as the catalogue writer", () => {
    const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");
    expect(pkg).not.toContain("ops/scripts/gen-seo-pages.cjs");
  });
});
