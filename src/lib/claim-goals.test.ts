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
    expect(how.status).toBe("goal-published");
    expect(how.emit).toBe("goal");
    expect(how.publicGoal).toBe(false);
    expect(how.publicGoalIfNoOtherOwner).toBe(true);
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
    expect(recall).toContain("That issuance is not live on this page.");
    expect(recall).not.toContain("Issue a unique identifier per unit and link it to a signed record");
    expect(recall).not.toContain("Our goal: issue a unique identifier per unit and link it to a signed record.");
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

  it("publishes the free-check goals beside their limits", () => {
    const architecture = fs.readFileSync(
      path.join(root, "workers/authichain-com/content/docs/public/dpp-architecture.md"),
      "utf8"
    );
    const verification = fs.readFileSync(
      path.join(root, "workers/authichain-com/content/docs/public/verification.md"),
      "utf8"
    );
    const page = fs.readFileSync(
      path.join(root, "workers/authichain-com/src/is-this-real-page.ts"),
      "utf8"
    );
    const published = [
      "dpp-architecture-free-seal",
      "verification-faq-free-check",
      "is-this-real-demonstration",
      "is-this-real-free-not-receipt",
      "is-this-real-verdict-not-inspection",
    ];
    const files: Record<string, string> = {
      "dpp-architecture-free-seal": architecture,
      "verification-faq-free-check": verification,
      "is-this-real-demonstration": page,
      "is-this-real-free-not-receipt": page,
      "is-this-real-verdict-not-inspection": page,
    };
    for (const id of published) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.limitPermanent, id).toBe(true);
      expect(files[id], id).toContain(record.goalSentence);
      expect(files[id], id).toContain(record.currentSentence);
    }
    expect(architecture).not.toContain("polygon-anchor-1");
    expect(architecture).not.toContain("polygonscan.com");
    expect(verification).not.toContain("polygonscan.com");
    const meta = page.match(/<meta name="description" content="([^"]*)"/);
    expect(meta?.[1]).not.toContain("Our goal");
    expect((meta?.[1] ?? "").length).toBeLessThanOrEqual(160);
    expect(page).not.toContain("protocol-example-route");
  });

  it("publishes the DSCSA and EPCIS goals beside their limits", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "seo", "pages.json"), "utf8")
    );
    const owners = [
      "dscsa-unit-level-partner-verify",
      "dscsa-saleable-returns-offline-check",
      "dscsa-epcis-dispenser-genuine",
      "epcis-2-0-export-bullet",
    ];
    for (const id of owners) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.emit, id).toBe("goal");
      expect(record.class, id).toBe("copy-only");
      expect(record.limitPermanent, id).toBe(false);
      const slug = record.slugs[0];
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      const text = JSON.stringify(page);
      expect(text, id).toContain(record.goalSentence);
      expect(text, id).toContain(record.limitSentence);
      expect(text, id).toContain(record.statuteSentence);
      expect(text, id).not.toContain(record.currentSentence);
      expect(text, id).toContain("That issuance is not live on this page.");
      expect(text, id).not.toContain("Issuing a customer product certificate is in development.");
      expect(text, id).not.toContain("Issue a unique identifier per unit and link it to a signed record");
      expect(page.title, id).not.toMatch(/Our goal/i);
      expect(page.h1, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, id).toBeLessThanOrEqual(160);
      expect(page.bodyHtml, id).toContain('action="https://authichain.com/checkout/dpp_readiness"');
      expect(page.bodyHtml, id).not.toContain("/protocol/checkout");
      const how = page.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
      const faq = page.bodyHtml.indexOf("<h2>FAQ</h2>");
      expect(cta, id).toBeGreaterThan(how);
      expect(faq, id).toBeGreaterThan(cta);
      const howChunk = page.bodyHtml.slice(how, cta);
      expect(howChunk, id).toContain("That issuance is not live on this page.");
      expect(howChunk, id).not.toContain("Our goal");
      expect(page.bodyHtml.match(/Our goal/g), id).toHaveLength(1);
      for (const sibling of recordsForSlug(claims, slug)) {
        if (sibling.publicGoal === true) continue;
        expect(sibling.publicGoal, sibling.id).toBe(false);
        if (sibling.goalSentence) expect(text, sibling.id).not.toContain(sibling.goalSentence);
        if (sibling.currentSentence) expect(text, sibling.id).not.toContain(sibling.currentSentence);
      }
    }
    const howItWorks = claims.find((entry: { id: string }) => entry.id === "generated-how-it-works");
    expect(howItWorks.publicGoal).toBe(false);
    expect(howItWorks.publicGoalIfNoOtherOwner).toBe(true);
    expect(howItWorks.status).toBe("goal-published");
    expect(howItWorks.emit).toBe("goal");
  });

  it("publishes the right-to-repair goal beside its limit", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "seo", "pages.json"), "utf8")
    );
    const record = claims.find(
      (entry: { id: string }) => entry.id === "right-to-repair-genuine-part"
    );
    expect(record.status).toBe("goal-published");
    expect(record.publicGoal).toBe(true);
    expect(record.emit).toBe("goal");
    expect(record.class).toBe("copy-only");
    expect(record.limitPermanent).toBe(false);
    const page = pages.find(
      (entry: { slug: string }) => entry.slug === record.slugs[0]
    );
    const text = JSON.stringify(page);
    expect(text).toContain(record.goalSentence);
    expect(text).toContain(record.limitSentence);
    expect(text).toContain(record.statuteSentence);
    expect(text).not.toContain(record.currentSentence);
    expect(text).toContain("That issuance is not live on this page.");
    expect(text).not.toContain("Issuing a customer product certificate is in development.");
    expect(page.title).not.toMatch(/Our goal/i);
    expect(page.h1).not.toMatch(/Our goal/i);
    expect(page.metaDescription).not.toMatch(/Our goal/i);
    expect(page.metaDescription.length).toBeLessThanOrEqual(160);
    expect(page.bodyHtml).toContain('action="https://authichain.com/checkout/dpp_readiness"');
    expect(page.bodyHtml.match(/Our goal/g)).toHaveLength(1);
    const how = page.bodyHtml.indexOf("<h2>How it works</h2>");
    const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
    const faq = page.bodyHtml.indexOf("<h2>FAQ</h2>");
    expect(cta).toBeGreaterThan(how);
    expect(faq).toBeGreaterThan(cta);
    expect(page.bodyHtml.slice(how, cta)).not.toContain("Our goal");
    for (const sibling of recordsForSlug(claims, record.slugs[0])) {
      if (sibling.publicGoal === true) continue;
      expect(sibling.publicGoal, sibling.id).toBe(false);
      if (sibling.goalSentence) expect(text, sibling.id).not.toContain(sibling.goalSentence);
      if (sibling.currentSentence) expect(text, sibling.id).not.toContain(sibling.currentSentence);
    }
  });

  it("publishes the textile, registry, and ESPR goals beside their limits", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "seo", "pages.json"), "utf8")
    );
    const owners = [
      "eu-dpp-textiles-issue",
      "eu-dpp-registry-issues-vc",
      "espr-priority-already-issues-six",
    ];
    for (const id of owners) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.emit, id).toBe("goal");
      expect(record.class, id).toBe("copy-only");
      expect(record.limitPermanent, id).toBe(false);
      const page = pages.find(
        (entry: { slug: string }) => entry.slug === record.slugs[0]
      );
      const text = JSON.stringify(page);
      expect(text, id).toContain(record.goalSentence);
      expect(text, id).toContain(record.limitSentence);
      expect(text, id).not.toContain(record.currentSentence);
      if (record.statuteSentence) expect(text, id).toContain(record.statuteSentence);
      expect(page.title, id).not.toMatch(/Our goal/i);
      expect(page.h1, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, id).toBeLessThanOrEqual(160);
      expect(page.bodyHtml, id).toContain(
        'action="https://authichain.com/checkout/dpp_readiness"'
      );
      expect(page.bodyHtml.match(/Our goal/g), id).toHaveLength(1);
      const how = page.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
      expect(page.bodyHtml.slice(how, cta), id).toContain(
        "That issuance is not live on this page."
      );
      expect(page.bodyHtml.slice(how, cta), id).not.toContain("Our goal");
      for (const sibling of recordsForSlug(claims, record.slugs[0])) {
        if (sibling.publicGoal === true) continue;
        if (sibling.goalSentence) expect(text, sibling.id).not.toContain(sibling.goalSentence);
        if (sibling.currentSentence) expect(text, sibling.id).not.toContain(sibling.currentSentence);
      }
    }
    const batteries = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-batteries"
    );
    expect(batteries.bodyHtml).toContain(
      "Our goal: issue one battery passport record for a single pack, with carbon-footprint, state-of-health, and material-recovery fields."
    );
    expect(batteries.bodyHtml).toContain("Battery passport issuance is in development.");
  });

  it("publishes the category passport goals beside their limits", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "seo", "pages.json"), "utf8")
    );
    const owners = [
      "eu-dpp-furniture-issue",
      "eu-dpp-electronics-issue",
      "eu-dpp-steel-issue",
      "eu-dpp-tyres-issue",
      "eu-dpp-aluminium-issues",
      "eu-dpp-toys-issues",
      "eu-dpp-detergents-issues",
    ];
    for (const id of owners) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.emit, id).toBe("goal");
      expect(record.class, id).toBe("copy-only");
      expect(record.limitPermanent, id).toBe(false);
      const page = pages.find(
        (entry: { slug: string }) => entry.slug === record.slugs[0]
      );
      const text = JSON.stringify(page);
      expect(text, id).toContain(record.goalSentence);
      expect(text, id).toContain(record.limitSentence);
      expect(text, id).not.toContain(record.currentSentence);
      if (record.statuteSentence) expect(text, id).toContain(record.statuteSentence);
      expect(page.title, id).not.toMatch(/Our goal/i);
      expect(page.h1, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, id).toBeLessThanOrEqual(160);
      expect(page.bodyHtml, id).toContain(
        'action="https://authichain.com/checkout/dpp_readiness"'
      );
      expect(page.bodyHtml.match(/Our goal/g), id).toHaveLength(1);
      const how = page.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
      expect(page.bodyHtml.slice(how, cta), id).toContain(
        "That issuance is not live on this page."
      );
      expect(page.bodyHtml.slice(how, cta), id).not.toContain("Our goal");
      for (const sibling of recordsForSlug(claims, record.slugs[0])) {
        if (sibling.publicGoal === true) continue;
        if (sibling.goalSentence) expect(text, sibling.id).not.toContain(sibling.goalSentence);
        if (sibling.currentSentence) expect(text, sibling.id).not.toContain(sibling.currentSentence);
      }
    }
    const toys = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-toys"
    );
    expect(toys.bodyHtml).toContain("Can I generate a toy DPP QR code today?");
    expect(toys.bodyHtml).toContain("the Commission has not yet published the implementing acts");
    expect(toys.bodyHtml).toContain("1 August 2030");
    const electronics = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-electronics"
    );
    expect(electronics.bodyHtml).toContain(
      "Repairability scores and spare-part availability are expected fields for this category. This page does not issue the passport."
    );
    expect(electronics.bodyHtml).not.toContain(
      "repairability scores and spare-part availability are part of the passport"
    );
    const batteries = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-batteries"
    );
    expect(batteries.bodyHtml).toContain(
      "Our goal: issue one battery passport record for a single pack, with carbon-footprint, state-of-health, and material-recovery fields."
    );
    const textiles = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-textiles"
    );
    expect(textiles.bodyHtml).toContain(
      "Our goal: issue one textile passport record for one unit, with fiber, recycled-content, and care fields."
    );
  });

  it("publishes the already-issues goals beside their limits", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content", "seo", "pages.json"), "utf8")
    );
    const owners = [
      "kimberley-already-solves",
      "quishing-signed-record-does",
      "metrc-consumer-qr-strainchain-signs",
      "ppwr-already-issues",
      "chemicals-already-used",
      "uk-labelling-already-issues",
      "eee-2029-already-issues",
      "textile-labelling-already-issues",
      "qron-already-issues-tyre",
      "qron-sunrise-every-code",
      "govchain-issues-sbom",
      "simp-already-used-dscsa",
      "shop-safe-record-does",
      "eudamed-clinician-signs",
      "uflpa-already-addresses",
    ];
    for (const id of owners) {
      const record = claims.find((entry: { id: string }) => entry.id === id);
      expect(record.status, id).toBe("goal-published");
      expect(record.publicGoal, id).toBe(true);
      expect(record.emit, id).toBe("goal");
      expect(record.class, id).toBe("copy-only");
      expect(record.limitPermanent, id).toBe(false);
      const page = pages.find(
        (entry: { slug: string }) => entry.slug === record.slugs[0]
      );
      const text = JSON.stringify(page);
      expect(text, id).toContain(record.goalSentence);
      expect(text, id).toContain(record.limitSentence);
      expect(text, id).not.toContain(record.currentSentence);
      for (const phrase of record.bannedRestorations || []) {
        expect(text, id).not.toContain(phrase);
      }
      expect(page.title, id).not.toMatch(/Our goal/i);
      expect(page.h1, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription, id).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, id).toBeLessThanOrEqual(160);
      expect(page.title.length, id).toBeLessThanOrEqual(60);
      expect(page.bodyHtml.match(/Our goal/g), id).toHaveLength(1);
      const how = page.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
      const howChunk = page.bodyHtml.slice(how, cta);
      expect(howChunk, id).toContain("That issuance is not live on this page.");
      expect(howChunk, id).not.toContain("Our goal");
      expect(howChunk, id).not.toContain(
        "Issue a unique identifier per unit and link it to a signed record"
      );
      if (page.brand === "AuthiChain") {
        expect(howChunk, id).toContain("EU DPP Readiness is $299 one-time.");
        expect(page.bodyHtml, id).toContain(
          'action="https://authichain.com/checkout/dpp_readiness"'
        );
      }
      if (page.brand === "QRON") {
        expect(howChunk, id).toContain("QRON packs from $29 one-time.");
        expect(page.bodyHtml, id).toContain('href="https://qron.space/pricing"');
        expect(page.bodyHtml, id).not.toContain("/checkout/");
      }
      if (page.brand === "GovChain") {
        expect(howChunk, id).toContain("public-sector pricing");
        expect(page.bodyHtml, id).toContain('href="https://govchain.us/onboard"');
        expect(page.bodyHtml, id).not.toContain("/checkout/");
        expect(text, id).not.toMatch(
          /works? offline|offline-capable|without connectivity|low-connectivity/i
        );
      }
      if (page.brand === "StrainChain") {
        expect(howChunk, id).toContain("Genetics passport is $49 one-time.");
        expect(page.bodyHtml, id).toContain(
          'action="https://authichain.com/checkout/strainchain_passport"'
        );
      }
    }
    const sunrise = pages.find(
      (entry: { slug: string }) => entry.slug === "gs1-digital-link-sunrise-2027"
    );
    expect(sunrise.bodyHtml).toContain("GS1 Sunrise 2027");
    const furniture = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-furniture"
    );
    expect(furniture.bodyHtml).toContain(
      "Our goal: issue one furniture passport record with material, durability, and end-of-life fields."
    );
  });

  it("replaces the default how-it-works line without a second goal", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const record = claims.find(
      (entry: { id: string }) => entry.id === "generated-how-it-works"
    );
    expect(record.status).toBe("goal-published");
    expect(record.emit).toBe("goal");
    expect(record.publicGoal).toBe(false);
    expect(record.publicGoalIfNoOtherOwner).toBe(true);
    expect(record.class).toBe("copy-only");
    expect(record.limitPermanent).toBe(false);
    const oldSentence = "Issue a unique identifier per unit and link it to a signed record";
    let onlyGoal = 0;
    for (const page of pages) {
      if (generator.PROTECTED_SEED_SLUGS.has(page.slug)) continue;
      const text = JSON.stringify(page);
      expect(text, page.slug).not.toContain(oldSentence);
      const owner = ownerForSlug(claims, page.slug);
      const howAt = page.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
      expect(howAt, page.slug).toBeGreaterThan(-1);
      expect(cta, page.slug).toBeGreaterThan(howAt);
      const howChunk = page.bodyHtml.slice(howAt, cta);
      if (owner.id === "generated-how-it-works" && howChunk.includes(record.goalSentence)) {
        onlyGoal += 1;
        expect(howChunk, page.slug).toContain(record.limitSentence);
        expect(howChunk.match(/Our goal/g), page.slug).toHaveLength(1);
        expect(page.bodyHtml.match(/Our goal/g), page.slug).toHaveLength(1);
        expect(page.title, page.slug).not.toMatch(/Our goal/i);
        expect(page.h1, page.slug).not.toMatch(/Our goal/i);
        expect(page.metaDescription, page.slug).not.toMatch(/Our goal/i);
        expect(page.metaDescription.length, page.slug).toBeLessThanOrEqual(160);
        expect(page.title.length, page.slug).toBeLessThanOrEqual(60);
        expect(howChunk, page.slug).toMatch(/\$|public-sector pricing/);
      } else if (owner.id === "generated-how-it-works") {
        expect(text, page.slug).not.toContain(record.goalSentence);
        expect(howChunk, page.slug).not.toContain("Our goal");
        expect(howChunk, page.slug).not.toContain(record.limitSentence);
      } else {
        expect(text, page.slug).not.toContain(record.goalSentence);
        expect(howChunk, page.slug).not.toContain("Our goal");
      }
    }
    expect(onlyGoal).toBeGreaterThan(100);
    for (const slug of claims.PRODUCT_17) {
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      expect(page.bodyHtml, slug).toContain(
        "Issuing a customer product certificate is in development."
      );
      const howAt = page.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
      expect(page.bodyHtml.slice(howAt, cta), slug).not.toContain("Our goal");
    }
    const battery = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-batteries"
    );
    expect(battery.bodyHtml).toContain("Battery passport issuance is in development.");
    const recall = pages.find(
      (entry: { slug: string }) => entry.slug === "cannabis-product-recall-traceability"
    );
    const recallHow = recall.bodyHtml.slice(
      recall.bodyHtml.indexOf("<h2>How it works</h2>"),
      recall.bodyHtml.indexOf("<h2>Get started</h2>")
    );
    expect(recallHow).toContain("That issuance is not live on this page.");
    expect(recallHow).toContain("Genetics passport is $49 one-time.");
    expect(recallHow).not.toContain("Our goal");
    expect(recall.bodyHtml.match(/Our goal/g)).toHaveLength(1);
  });

  it("limits already-issued claims on the four protected seeds", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const record = claims.find(
      (entry: { id: string }) => entry.id === "generated-how-it-works"
    );
    const slugs = [
      "ppwr-digital-labelling-qr-code",
      "untp-digital-product-passport",
      "battery-passport-due-diligence-requirement",
      "digital-product-passport-access-rights",
    ];
    for (const slug of slugs) {
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      const text = JSON.stringify(page);
      const howAt = page.bodyHtml.indexOf("<h2>How it works</h2>");
      const cta = page.bodyHtml.indexOf("<h2>Get started</h2>");
      const howChunk = page.bodyHtml.slice(howAt, cta);
      expect(howChunk, slug).toContain(record.goalSentence);
      expect(howChunk, slug).toContain(record.limitSentence);
      expect(page.bodyHtml.match(/Our goal/g), slug).toHaveLength(1);
      expect(text, slug).not.toContain(
        "Issue a unique identifier per unit and link it to a signed record"
      );
      expect(text, slug).not.toContain("this protocol already issues");
      expect(text, slug).not.toContain("already implements");
      expect(text, slug).not.toContain("records already use");
      expect(text, slug).not.toContain("hashed to an anchor");
      expect(page.title, slug).not.toMatch(/Our goal/i);
      expect(page.h1, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, slug).toBeLessThanOrEqual(160);
      expect(page.bodyHtml, slug).toContain(
        'action="https://authichain.com/checkout/dpp_readiness"'
      );
      expect(page.bodyHtml, slug).toContain("EU DPP Readiness is $299 one-time.");
    }
    const untp = pages.find(
      (entry: { slug: string }) => entry.slug === "untp-digital-product-passport"
    );
    expect(untp.metaDescription).not.toContain("built on the same");
    expect(untp.bodyHtml).toContain("1 September 2026");
    const access = pages.find(
      (entry: { slug: string }) => entry.slug === "digital-product-passport-access-rights"
    );
    expect(access.metaDescription).toBe(
      "ESPR splits Digital Product Passport access into public, professional, and authority tiers."
    );
    const battery = pages.find(
      (entry: { slug: string }) => entry.slug === "battery-passport-due-diligence-requirement"
    );
    expect(battery.bodyHtml).toContain("18 August 2027");
    expect(battery.bodyHtml).toContain("hashing it to an anchor is not live on this page.");
  });

  it("limits already-uses claims on nine generated pages", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const slugs = [
      "eu-dpp-qr-code-data-carrier-requirements",
      "cen-cenelec-digital-product-passport-standards",
      "eu-digital-product-passport-detergents",
      "eu-wine-ingredient-nutrition-qr-code-label",
      "eu-dpp-data-authentication-integrity-standard-en-18246",
      "eu-dpp-access-rights-management-standard-en-18239",
      "federal-sbom-minimum-elements-government-contractor-requirement",
      "un-transparency-protocol-vs-w3c-verifiable-credentials",
      "w3c-verifiable-credentials-data-model-2-1-changes",
    ];
    const banned = [
      "already uses",
      "already implements",
      "already requires",
      "already matches",
      "already makes",
      "already targets",
      "this spec already uses",
      "building blocks match",
      "built on the same",
    ];
    for (const slug of slugs) {
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      const text = JSON.stringify(page);
      expect(page.bodyHtml.match(/Our goal/g), slug).toHaveLength(1);
      expect(page.title, slug).not.toMatch(/Our goal/i);
      expect(page.h1, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, slug).toBeLessThanOrEqual(160);
      expect(page.title.length, slug).toBeLessThanOrEqual(60);
      for (const phrase of banned) {
        expect(text, `${slug} ${phrase}`).not.toContain(phrase);
      }
    }
    const gov = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "federal-sbom-minimum-elements-government-contractor-requirement"
    );
    expect(gov.bodyHtml).toContain("https://govchain.us/onboard");
    expect(gov.bodyHtml).not.toContain("/checkout/");
    expect(gov.bodyHtml).toContain(
      "GovChain does not issue that chain-of-custody record on this page."
    );
    const detergents = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-detergents"
    );
    expect(detergents.bodyHtml).toContain("23 September 2029");
    expect(detergents.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    const untpPage = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "un-transparency-protocol-vs-w3c-verifiable-credentials"
    );
    expect(untpPage.metaDescription).toBe(
      "UN/CEFACT\u2019s UN Transparency Protocol targets version 1.0 by 1 September 2026."
    );
    expect(untpPage.bodyHtml).toContain("1 September 2026");
    const aluminium = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-aluminium"
    );
    expect(JSON.stringify(aluminium)).not.toContain("already used for the steel passport");
    expect(JSON.stringify(aluminium)).not.toContain("anchored on-chain");
    expect(aluminium.bodyHtml).toContain(
      "Embodied-carbon and scope 1\u20133 data are not already captured on this page."
    );
    expect(aluminium.bodyHtml).toContain(
      "Recycled-content and alloy-grade declarations are not anchored on this page."
    );
    expect(aluminium.bodyHtml).toContain("delegated act in 2027");
    expect(aluminium.bodyHtml.match(/Our goal/g)).toHaveLength(1);
  });

  it("limits present-tense signing claims on eight generated pages", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const slugs = [
      "eu-general-product-safety-regulation-traceability-requirements",
      "csddd-omnibus-supply-chain-due-diligence-2026",
      "california-sb-253-scope-3-supplier-emissions-verification",
      "digital-product-passport-paints-lubricants-detergents-timeline",
      "eu-dpp-access-rights-management-standard-en-18239",
      "iso-22095-chain-of-custody-blockchain",
      "scantrust-alternative-with-a-public-verifier",
      "w3c-verifiable-credential-render-method-physical-label",
    ];
    const banned = [
      "already carries",
      "already covers",
      "signs and anchors whatever",
      "AuthiChain runs for batteries",
      "v0.1.0 issues one record",
      "AuthiChain signs a record tied",
      "AuthiChain signs the record behind",
      "printed carrier today",
      "natural fit",
      "Issuing it early",
      "a record anyone can check",
    ];
    for (const slug of slugs) {
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      const text = JSON.stringify(page);
      expect(page.bodyHtml.match(/Our goal/g), slug).toHaveLength(1);
      expect(page.title, slug).not.toMatch(/Our goal/i);
      expect(page.h1, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, slug).toBeLessThanOrEqual(160);
      expect(page.bodyHtml, slug).toContain(
        'action="https://authichain.com/checkout/dpp_readiness"'
      );
      expect(page.bodyHtml, slug).toContain("EU DPP Readiness is $299 one-time.");
      for (const phrase of banned) {
        expect(text, `${slug} ${phrase}`).not.toContain(phrase);
      }
    }
    const iso = pages.find(
      (entry: { slug: string }) => entry.slug === "iso-22095-chain-of-custody-blockchain"
    );
    expect(iso.metaDescription).toBe(
      "ISO 22095 defines five chain-of-custody models: identity preserved, segregated, controlled blending, mass balance, and book and claim."
    );
    expect(iso.bodyHtml).toContain("ISO 22095");
    expect(iso.bodyHtml).toContain("not already issued on this page");
    const scan = pages.find(
      (entry: { slug: string }) => entry.slug === "scantrust-alternative-with-a-public-verifier"
    );
    expect(scan.metaDescription).toBe(
      "Scantrust is an established secure-QR and brand-protection platform with self-serve plans."
    );
    const csddd = pages.find(
      (entry: { slug: string }) => entry.slug === "csddd-omnibus-supply-chain-due-diligence-2026"
    );
    expect(csddd.bodyHtml).toContain("18 March 2026");
  });

  it("limits signed-record claims on seven generated pages", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const slugs = [
      "eu-general-product-safety-regulation-traceability-requirements",
      "eu-falsified-medicines-directive-verification",
      "eu-digital-product-passport-registry-test-environment",
      "cmmc-2-0-supply-chain-subcontractor-flow-down-requirement",
      "gs1-datamatrix-point-of-care-scanning-requirements",
      "un-transparency-protocol-vs-w3c-verifiable-credentials",
      "vechain-alternative-without-tokens-or-gas-fees",
    ];
    const banned = [
      "can verify offline",
      "signed, anchored record is one way",
      "is built to give a downstream party",
      "verifies offline against the record",
      "buyer can verify offline",
      "can carry the same product code",
      "resolves at a permanent GS1",
      "anchored record of a subcontractor",
      "resolves from the same GS1",
      "can serve as one of those",
      "thing you buy",
      "before it can issue a record",
      "already issuing",
      "works offline",
    ];
    for (const slug of slugs) {
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      const text = JSON.stringify(page);
      expect(page.bodyHtml.match(/Our goal/g), slug).toHaveLength(1);
      expect(page.title, slug).not.toMatch(/Our goal/i);
      expect(page.h1, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, slug).toBeLessThanOrEqual(160);
      for (const phrase of banned) {
        expect(text, `${slug} ${phrase}`).not.toContain(phrase);
      }
      if (slug === "cmmc-2-0-supply-chain-subcontractor-flow-down-requirement") {
        expect(page.bodyHtml, slug).toContain("https://govchain.us/onboard");
        expect(page.bodyHtml, slug).not.toContain("/checkout/");
        expect(page.bodyHtml, slug).not.toContain("/api/checkout/");
      } else {
        expect(page.bodyHtml, slug).toContain(
          'action="https://authichain.com/checkout/dpp_readiness"'
        );
        expect(page.bodyHtml, slug).toContain("EU DPP Readiness is $299 one-time.");
      }
    }
    const gpsr = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "eu-general-product-safety-regulation-traceability-requirements"
    );
    expect(gpsr.bodyHtml).toContain("13 December 2024");
    expect(gpsr.bodyHtml).toContain(
      "This page does not give those operators a shared record to check."
    );
    const fmd = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-falsified-medicines-directive-verification"
    );
    expect(fmd.bodyHtml).toContain("9 February 2019");
    expect(fmd.bodyHtml).toContain("Does a signed AuthiChain record replace the FMD unique identifier?");
    const registry = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "eu-digital-product-passport-registry-test-environment"
    );
    expect(registry.bodyHtml).toContain("20 July 2026");
    const cmmc = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "cmmc-2-0-supply-chain-subcontractor-flow-down-requirement"
    );
    expect(cmmc.bodyHtml).toContain("July 2026");
    expect(cmmc.bodyHtml).toContain(
      "This page does not keep a signed record of a subcontractor\u2019s attested level."
    );
    const matrix = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "gs1-datamatrix-point-of-care-scanning-requirements"
    );
    expect(matrix.bodyHtml).toContain("GS1 DataMatrix is already the required data carrier");
    const untp = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "un-transparency-protocol-vs-w3c-verifiable-credentials"
    );
    expect(untp.metaDescription).toBe(
      "UN/CEFACT\u2019s UN Transparency Protocol targets version 1.0 by 1 September 2026."
    );
    const vechain = pages.find(
      (entry: { slug: string }) => entry.slug === "vechain-alternative-without-tokens-or-gas-fees"
    );
    expect(vechain.metaDescription).toBe(
      "VeChain is a general-purpose enterprise L1 blockchain that brands usually reach through ToolChain or an integration partner; AuthiChain is a brand-facing."
    );
    expect(vechain.bodyHtml).toContain("VeChain is a separate L1 blockchain");
    const comparison = fs.readFileSync(
      path.join(root, "scripts/seo-data/comparison.cjs"),
      "utf8"
    );
    expect(comparison).toContain("Product certification through verify is in development.");
    expect(comparison).toContain(
      "Self-serve issuance and EU DPP export are still in development."
    );
  });

  it("limits SIMP offline-verification claims", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const page = pages.find(
      (entry: { slug: string }) => entry.slug === "seafood-import-monitoring-program-traceability"
    );
    const text = JSON.stringify(page);
    const banned = [
      "can be signed",
      "verify offline",
      "re-keyed paper",
      "does not need portal access",
      "Anchoring makes the supporting",
      "already issuing",
      "works offline",
      "proof of origin",
    ];
    expect(page.bodyHtml.match(/Our goal/g)).toHaveLength(1);
    expect(page.title).not.toMatch(/Our goal/i);
    expect(page.h1).not.toMatch(/Our goal/i);
    expect(page.metaDescription).not.toMatch(/Our goal/i);
    expect(page.metaDescription.length).toBeLessThanOrEqual(160);
    expect(page.metaDescription).toBe(
      "SIMP requires point-of-harvest-to-entry chain-of-custody data for more than 1,100 seafood species entering the US."
    );
    expect(page.bodyHtml).toContain("Our goal: reuse one record shape for a catch event.");
    expect(page.bodyHtml).toContain("This page does not do DSCSA lot tracking or EUDR geolocation.");
    expect(page.bodyHtml).toContain("FY2026");
    expect(page.bodyHtml).toContain("Does this replace SIMP reporting to NOAA?");
    expect(page.bodyHtml).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(page.bodyHtml).toContain("EU DPP Readiness is $299 one-time.");
    expect(page.bodyHtml).toContain(
      "This page does not sign catch, landing, or custody events, and it does not carry a SIMP record across a processor transfer."
    );
    expect(page.bodyHtml).toContain(
      "This page does not verify a SIMP record against the shipment\u2019s identifier, and it does not give a customs or NOAA reviewer that check."
    );
    expect(page.bodyHtml).toContain(
      "This page does not make that chain-of-custody documentation tamper-evident, and it does not change where or how the SIMP report itself gets filed."
    );
    for (const phrase of banned) {
      expect(text, phrase).not.toContain(phrase);
    }
  });

  it("limits filing-evidence claims on ten generated pages", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const slugs = [
      "cbam-embedded-carbon-emissions-verification",
      "eu-conflict-minerals-regulation-3tg-due-diligence",
      "cyber-resilience-act-vulnerability-reporting-deadline-2026",
      "csddd-omnibus-supply-chain-due-diligence-2026",
      "eu-digital-product-passport-chemicals-scope-study",
      "usda-product-of-usa-label-traceability-documentation",
      "ftc-made-in-usa-labeling-verification",
      "made-in-america-origin-claim-substantiation",
      "made-in-usa-origin-claims-documentation",
      "buy-american-made-in-usa-provenance",
    ];
    const banned = [
      "can support the embedded-carbon",
      "can carry the batch-level",
      "kind of evidence the Responsible Minerals",
      "is evidence an auditor or downstream",
      "evidence you can produce fast",
      "inventory to report from quickly",
      "documents what a tier-1 partner asserted",
      "can carry REACH-required data today",
      "plant can hand over",
      "per-unit record can carry",
      "supply-chain record can trace",
      "evidence a company can point to",
      "evidence that outlasts a label",
      "one way to carry that evidence",
      "checkable evidence a buyer",
      "The record is competent-and-reliable-evidence material",
      "compliance team can hand over",
      "answers for that serial",
      "documentation those officers can read",
      "is evidence toward a domestic-origin",
      "and a signed.",
      "already issuing",
      "works offline",
      "proof of origin",
    ];
    for (const slug of slugs) {
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      const text = JSON.stringify(page);
      expect(page.bodyHtml.match(/Our goal/g), slug).toHaveLength(1);
      expect(page.title, slug).not.toMatch(/Our goal/i);
      expect(page.h1, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, slug).toBeLessThanOrEqual(160);
      expect(page.bodyHtml, slug).toContain(
        'action="https://authichain.com/checkout/dpp_readiness"'
      );
      expect(page.bodyHtml, slug).toContain("EU DPP Readiness is $299 one-time.");
      for (const phrase of banned) {
        expect(text, `${slug} ${phrase}`).not.toContain(phrase);
        expect(page.metaDescription, `${slug} ${phrase}`).not.toContain(phrase);
      }
    }
    const cbam = pages.find(
      (entry: { slug: string }) => entry.slug === "cbam-embedded-carbon-emissions-verification"
    );
    expect(cbam.bodyHtml).toContain("Does a signed AuthiChain record satisfy CBAM reporting on its own?");
    expect(cbam.bodyHtml).toContain("definitive phase in 2026");
    const chemicals = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-digital-product-passport-chemicals-scope-study"
    );
    expect(chemicals.bodyHtml).toContain("not already used as a live passport");
    const buy = pages.find(
      (entry: { slug: string }) => entry.slug === "buy-american-made-in-usa-provenance"
    );
    expect(buy.metaDescription).toBe(
      "Buy American and Made in USA questions in federal procurement are still origin questions: a contracting officer can ask where a unit was made."
    );
    expect(buy.bodyHtml).toContain("ZACHARY KIETZMAN");
    const csddd = pages.find(
      (entry: { slug: string }) => entry.slug === "csddd-omnibus-supply-chain-due-diligence-2026"
    );
    expect(csddd.bodyHtml).toContain("18 March 2026");
  });

  it("limits product-verification claims on eleven generated pages", () => {
    const pages = JSON.parse(
      fs.readFileSync(path.join(root, "content/seo/pages.json"), "utf8")
    );
    const dpp = [
      "kimberley-process-diamond-certification-blockchain-2026",
      "ai-shopping-agent-product-authenticity-verification",
      "ai-agent-payment-mandate-product-authenticity-verification",
      "counterfeit-small-parcel-ecommerce-verification",
      "dscsa-authorized-trading-partner-verification-requirement",
      "shop-safe-act-marketplace-seller-verification",
    ];
    const qron = [
      "verified-by-gs1-vs-blockchain-provenance-record",
      "eu-green-transition-directive-environmental-claims",
      "eu-tyre-label-digital-qr-code-proposal",
    ];
    const slugs = dpp.concat(
      ["trumark-product-authentication-seal", "federal-contractor-semiconductor-supply-chain-disclosure"],
      qron
    );
    const banned = [
      "closes that separate gap",
      "ties one cut and polished stone",
      "verifies what is being sold",
      "same offline verification",
      "verifier checks a signed provenance record",
      "already frames a scan as a TruMark scan",
      "can check a product",
      "what a QRON scan checks",
      "proves the specific item",
      "Scan-to-verify works",
      "Offline verification with no account",
      "gives the end recipient a way to check",
      "verifying that a specific drug unit is genuine",
      "signature verification closes",
      "verification here runs offline",
      "meets that bar more directly",
      "item-level verification is what catches",
      "model already supports",
      "answers that query in the time the rule",
      "builds the part-level traceability layer now",
      "could add on top",
      "already issuing",
      "proof of origin",
      "works offline",
    ];
    for (const slug of slugs) {
      const page = pages.find((entry: { slug: string }) => entry.slug === slug);
      const text = JSON.stringify(page);
      expect(page.bodyHtml.match(/Our goal/g), slug).toHaveLength(1);
      expect(page.title, slug).not.toMatch(/Our goal/i);
      expect(page.h1, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription, slug).not.toMatch(/Our goal/i);
      expect(page.metaDescription.length, slug).toBeLessThanOrEqual(160);
      for (const phrase of banned) {
        expect(text, `${slug} ${phrase}`).not.toContain(phrase);
      }
      if (slug === "trumark-product-authentication-seal") {
        expect(page.bodyHtml).toContain("https://authichain.com/checkout/strainchain_passport");
        expect(page.bodyHtml).toContain("$49");
      } else if (slug === "federal-contractor-semiconductor-supply-chain-disclosure") {
        expect(page.bodyHtml).toContain("https://govchain.us/onboard");
        expect(page.bodyHtml).not.toContain("/checkout/");
        expect(page.bodyHtml).not.toContain("/api/checkout/");
        expect(page.bodyHtml).not.toMatch(/offline/i);
      } else if (qron.includes(slug)) {
        expect(page.bodyHtml, slug).toContain("https://qron.space/pricing");
        expect(page.bodyHtml, slug).not.toContain("/checkout/");
        expect(page.bodyHtml, slug).not.toContain("/api/checkout/");
      } else {
        expect(page.bodyHtml, slug).toContain(
          'action="https://authichain.com/checkout/dpp_readiness"'
        );
        expect(page.bodyHtml, slug).toContain("EU DPP Readiness is $299 one-time.");
      }
    }
    const kimberley = pages.find(
      (entry: { slug: string }) =>
        entry.slug === "kimberley-process-diamond-certification-blockchain-2026"
    );
    expect(kimberley.bodyHtml).toContain("That check is not live.");
    const shop = pages.find(
      (entry: { slug: string }) => entry.slug === "shop-safe-act-marketplace-seller-verification"
    );
    expect(shop.bodyHtml).toContain("It does not prove the physical unit is genuine.");
    const tyre = pages.find(
      (entry: { slug: string }) => entry.slug === "eu-tyre-label-digital-qr-code-proposal"
    );
    expect(tyre.bodyHtml).toContain("This page does not mean QRON already issues a tyre label.");
    expect(tyre.bodyHtml).toContain("June 24, 2026");
  });

  it("does not name ops/scripts/gen-seo-pages.cjs as the catalogue writer", () => {
    const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");
    expect(pkg).not.toContain("ops/scripts/gen-seo-pages.cjs");
  });
});
