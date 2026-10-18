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
    expect(notAnother.limitPermanent).toBe(false);
    const permanentSentences = claims
      .filter((record: { limitPermanent?: boolean }) => record.limitPermanent === true)
      .map((record: { currentSentence?: string }) => record.currentSentence || "");
    expect(permanentSentences.join("\n")).not.toContain(
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

  it("does not name ops/scripts/gen-seo-pages.cjs as the catalogue writer", () => {
    const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");
    expect(pkg).not.toContain("ops/scripts/gen-seo-pages.cjs");
  });
});
