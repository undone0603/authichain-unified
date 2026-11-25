/**
 * Stale QRON per-scan / per-read / per-QR prices are not live (those
 * routes 404). This guard keeps that copy from coming back.
 *
 * It also bans retired pack-credit expiry claims ("never expire",
 * "credits don't expire") on user-facing page sources.
 *
 * Live agent pay is unchanged: POST /api/x402, $0.05 USDC on Base,
 * paid agent verification. Do not describe that rail as a human QR
 * scan meter.
 */
// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Word-bounded. A naive /per[- ]read/ also matches "developer reading". */
export const PER_SCAN = /\bper[- ]scans?\b/i;
export const PER_READ = /\bper[- ]reads?\b/i;
export const PER_QR = /\bper[- ]QRs?\b/i;
export const PER_LOOKUP = /\bper[- ]lookups?\b/i;
/** `$0.002/QR` style unit prices, word-bounded on QR. */
export const DOLLAR_PER_QR = /\$\d+(?:\.\d+)?\s*\/\s*QRs?\b/i;
/** `$0.001-$0.01` including the HTML split on the old QRON pricing card. */
export const MICROPRICE_RANGE = /\$0\.001(?:<[^>]+>)?\s*[-–]\s*\$?0\.0?1\b/;
export const PER_SEAL_FEE = /Per-Seal Fee/i;
/** Retired pack-credit expiry slogans. Not JWT / certificate / session expiry. */
export const NEVER_EXPIRE = /never[- ]expir(?:e|es|ing)\b/i;
export const DONT_EXPIRE =
  /\b(?:don['’]?t|do not|won['’]?t|will not)\s+expire\b/i;

const PRICING_CONTEXT =
  /\$(?!QRON\b)|\bfees?\b|\bcosts?\b|\bcharg(?:e|ed|es|ing)\b|\bpric(?:e|es|ing)\b|\bmeter(?:ing)?\b|\brevenue\b|\bcents?\b|\bbilled\b|\bbilling\b/i;

/** Do not invent these as AuthiChain policy; they are unconfirmed. */
const UNCONFIRMED_POLICY =
  /human QR scans are free|battery-passport access is never metered/i;

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  ".turbo",
  ".next",
  ".open-next",
  "build",
]);
const COPY_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".md",
  ".html",
  ".jsx",
]);
const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/;

/** Per-scan / per-read / per-QR / per-lookup used as a price or meter. */
export function hasPerUnitPriceOrMetering(line: string): boolean {
  const perUnit =
    PER_SCAN.test(line) ||
    PER_READ.test(line) ||
    PER_QR.test(line) ||
    PER_LOOKUP.test(line);
  return perUnit && PRICING_CONTEXT.test(line);
}

export function isLiveX402Copy(line: string): boolean {
  const live =
    /POST \/api\/x402/.test(line) ||
    /\$0\.05 USDC on Base/i.test(line) ||
    /paid agent verification/i.test(line);
  if (!live) return false;
  // x402 phrasing must not hide restored QRON unit prices or metering.
  if (hasPerUnitPriceOrMetering(line)) return false;
  if (/\$0\.00[12]\b/.test(line)) return false;
  if (PER_SEAL_FEE.test(line)) return false;
  return true;
}

export function isAllowlisted(rel: string, line: string): boolean {
  const norm = rel.split(path.sep).join("/");
  if (norm.endsWith("scripts/__tests__/qron-perscan-copy-guard.test.ts")) {
    return true;
  }
  if (
    norm.endsWith("src/app/resources/eu-dpp-guide/page.tsx") &&
    /no per-scan verification fees/.test(line)
  ) {
    return true;
  }
  if (
    norm.endsWith("workers/threadchain-io/src/index.ts") &&
    /No per-scan fees/.test(line)
  ) {
    return true;
  }
  if (isLiveX402Copy(line)) return true;
  return false;
}

export function lineHits(line: string): string[] {
  const hits: string[] = [];
  if (PER_SCAN.test(line) && PRICING_CONTEXT.test(line)) hits.push("per-scan");
  if (PER_READ.test(line) && PRICING_CONTEXT.test(line)) hits.push("per-read");
  if (PER_QR.test(line) && PRICING_CONTEXT.test(line)) hits.push("per-QR");
  if (PER_LOOKUP.test(line) && PRICING_CONTEXT.test(line))
    hits.push("per-lookup");
  if (DOLLAR_PER_QR.test(line)) hits.push("$/QR");
  if (MICROPRICE_RANGE.test(line)) hits.push("$0.001-range");
  if (PER_SEAL_FEE.test(line)) hits.push("Per-Seal Fee");
  if (UNCONFIRMED_POLICY.test(line)) hits.push("unconfirmed-policy");
  return hits;
}

/** A line fails the guard when it hits a banned pattern and is not allowlisted. */
export function failsGuard(rel: string, line: string): boolean {
  return lineHits(line).length > 0 && !isAllowlisted(rel, line);
}

export function neverExpireHits(line: string): string[] {
  const hits: string[] = [];
  if (NEVER_EXPIRE.test(line)) hits.push("never-expire");
  if (DONT_EXPIRE.test(line)) hits.push("dont-expire");
  return hits;
}

/**
 * Pages and catalogues that ship /generate, home, and /pricing HTML + JSON-LD.
 */
const USER_FACING_PREFIXES = [
  "src/app/",
  "apps/qron-platform/src/app/",
  "worker-app/",
  "workers/qron-space/src/",
  "workers/authichain-com/src/", // pragma: allowlist secret
  "workers/authichain-api-gateway/src/", // pragma: allowlist secret
];
const USER_FACING_FILES = new Set([
  "src/lib/plans.ts",
  "src/lib/checkout-gate.ts",
  "src/lib/generate-api.ts",
  "apps/qron-platform/src/lib/plans.ts",
  "workers/_shared/estate-pricing.ts",
]);

export function isUserFacingCopyPath(rel: string): boolean {
  const norm = rel.split(path.sep).join("/");
  if (USER_FACING_FILES.has(norm)) return true;
  return USER_FACING_PREFIXES.some(prefix => norm.startsWith(prefix));
}

export function failsNeverExpireGuard(rel: string, line: string): boolean {
  if (!isUserFacingCopyPath(rel)) return false;
  const norm = rel.split(path.sep).join("/");
  if (norm.endsWith("scripts/__tests__/qron-perscan-copy-guard.test.ts")) {
    return false;
  }
  return neverExpireHits(line).length > 0;
}

function walkCopyFiles(dir: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkCopyFiles(abs, acc);
      continue;
    }
    if (TEST_FILE.test(ent.name)) continue;
    if (!COPY_EXT.has(path.extname(ent.name))) continue;
    acc.push(path.relative(ROOT, abs).split(path.sep).join("/"));
  }
  return acc;
}

describe("qron per-scan / per-read / per-QR copy guard", () => {
  it("word-bounds per-read so 'developer reading' is not a hit", () => {
    const naive = /per[- ]read/i;
    const sentence =
      "an agent developer reading a docs page should not have to model a";
    expect(naive.test(sentence)).toBe(true);
    expect(PER_READ.test(sentence)).toBe(false);
    expect(lineHits(sentence)).toEqual([]);
    expect(lineHits("per-read metering at $0.001")).toContain("per-read");
  });

  it("flags stale QRON scan prices and not live x402 agent pay", () => {
    expect(lineHits("✓ Per-scan revenue share")).toContain("per-scan");
    expect(lineHits("Monetize through per-scan metering")).toContain(
      "per-scan"
    );
    expect(
      lineHits("You pay us fractions of a cent per scan via our API.")
    ).toContain("per-scan");
    expect(lineHits("White-label API: usage-based from $0.002/QR.")).toContain(
      "$/QR"
    );
    expect(
      lineHits("- **Per-Seal Fee:** $0.001 - $0.01 per verification event")
    ).toEqual(expect.arrayContaining(["$0.001-range", "Per-Seal Fee"]));
    expect(
      lineHits(
        '<div className="text-3xl font-black mb-6">$0.001<span className="text-lg text-zinc-500">-$0.01</span></div>'
      )
    ).toContain("$0.001-range");

    const x402 =
      "Funded agents verify a product for $0.05 USDC on Base via POST /api/x402 (paid agent verification).";
    expect(lineHits(x402)).toEqual([]);
    expect(isLiveX402Copy(x402)).toBe(true);
    expect(isAllowlisted("docs/CAPABILITIES.md", x402)).toBe(true);
    expect(failsGuard("docs/CAPABILITIES.md", x402)).toBe(false);
  });

  it("fails a per-lookup fee for the passport", () => {
    const line = "per-lookup fee for the passport";
    expect(PER_LOOKUP.test(line)).toBe(true);
    expect(lineHits(line)).toContain("per-lookup");
    expect(failsGuard("src/app/resources/eu-dpp-guide/page.tsx", line)).toBe(
      true
    );
  });

  it("does not exempt x402 copy that also meters per-scan", () => {
    const line =
      "Monetize through per-scan metering via POST /api/x402 ($0.05 USDC on Base, paid agent verification).";
    expect(lineHits(line)).toContain("per-scan");
    expect(isLiveX402Copy(line)).toBe(false);
    expect(isAllowlisted("docs/CAPABILITIES.md", line)).toBe(false);
    expect(failsGuard("docs/CAPABILITIES.md", line)).toBe(true);
  });

  it("keeps the two allowed no-per-scan-fee lines and the art-style uses", () => {
    const dpp =
      "[REDACTED]’s self-serve model starts well below the cost of a single compliance consultant, with no per-scan verification fees.";
    expect(lineHits(dpp)).toContain("per-scan");
    expect(isAllowlisted("src/app/resources/eu-dpp-guide/page.tsx", dpp)).toBe(
      true
    );

    const thread =
      '<p class="section-sub">Per-brand pricing. No per-scan fees. Unlimited consumer verifications on every plan.</p>';
    expect(lineHits(thread)).toContain("per-scan");
    expect(isAllowlisted("workers/threadchain-io/src/index.ts", thread)).toBe(
      true
    );

    expect(
      lineHits(
        '**Visual Goal:** A series where the subject is the same, but the "Art Style" changes per scan.'
      )
    ).toEqual([]);
    expect(
      lineHits("export const BASE_REWARD = 0.1; // QRON per scan")
    ).toEqual([]);
  });

  it("does not treat unconfirmed free-scan / never-metered policy as allowed copy", () => {
    expect(lineHits("human QR scans are free")).toContain("unconfirmed-policy");
    expect(lineHits("battery-passport access is never metered")).toContain(
      "unconfirmed-policy"
    );
  });

  it("source and copy files have no unallowlisted hits", () => {
    const files = walkCopyFiles(ROOT);
    expect(files.length).toBeGreaterThan(100);
    const violations: string[] = [];
    for (const rel of files) {
      const text = readFileSync(path.join(ROOT, rel), "utf8");
      for (const [i, line] of text.split(/\r?\n/).entries()) {
        const hits = lineHits(line);
        if (hits.length === 0) continue;
        if (isAllowlisted(rel, line)) continue;
        violations.push(`${rel}:${i + 1} [${hits.join(",")}] ${line.trim()}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("the two kept product lines are still present", () => {
    const dpp = readFileSync(
      path.join(ROOT, "src/app/resources/eu-dpp-guide/page.tsx"),
      "utf8"
    );
    expect(dpp).toMatch(/no per-scan verification fees/);
    const thread = readFileSync(
      path.join(ROOT, "workers/threadchain-io/src/index.ts"),
      "utf8"
    );
    expect(thread).toMatch(/No per-scan fees/);
  });
});

describe("retired never-expire pack-credit copy guard", () => {
  it("flags the live Nov 25 generate and pricing sentences", () => {
    const generate =
      "Then Starter Pack: 100 generations for $29, paid once. No subscription. One-time pack credits (Starter and Creator) never expire. A scannable QR is not an authenticity proof.";
    expect(neverExpireHits(generate)).toContain("never-expire");
    expect(failsNeverExpireGuard("worker-app/dynamic-pages.ts", generate)).toBe(
      true
    );

    const offer =
      "100 AI QR generations for $29, paid once. No subscription. One-time pack credits (Starter and Creator) never expire.";
    expect(neverExpireHits(offer)).toContain("never-expire");
    expect(failsNeverExpireGuard("src/lib/plans.ts", offer)).toBe(true);

    expect(neverExpireHits("credits don't expire")).toContain("dont-expire");
    expect(
      neverExpireHits("Credits purchased in one-time packs do not expire.")
    ).toContain("dont-expire");
    expect(
      failsNeverExpireGuard(
        "src/app/terms/page.tsx",
        "Credits purchased in one-time packs do not expire."
      )
    ).toBe(true);
  });

  it("does not treat the replacement or a FAQ question as a hit", () => {
    expect(neverExpireHits("One-time pack. No subscription.")).toEqual([]);
    expect(
      neverExpireHits(
        "Then Starter Pack: 100 generations for $29, paid once. No subscription. A scannable QR is not an authenticity proof."
      )
    ).toEqual([]);
    expect(neverExpireHits("Do credits expire?")).toEqual([]);
    expect(
      failsNeverExpireGuard("src/app/_home/QronHome.tsx", "Do credits expire?")
    ).toBe(false);
  });

  it("user-facing page sources have no never-expire or don't-expire claims", () => {
    const files = walkCopyFiles(ROOT).filter(isUserFacingCopyPath);
    expect(files).toEqual(
      expect.arrayContaining([
        "worker-app/dynamic-pages.ts",
        "src/lib/plans.ts",
        "workers/_shared/estate-pricing.ts",
        "workers/qron-space/src/index.ts",
        "src/app/terms/page.tsx",
      ])
    );
    const violations: string[] = [];
    for (const rel of files) {
      const text = readFileSync(path.join(ROOT, rel), "utf8");
      for (const [i, line] of text.split(/\r?\n/).entries()) {
        const hits = neverExpireHits(line);
        if (hits.length === 0) continue;
        if (!failsNeverExpireGuard(rel, line)) continue;
        violations.push(`${rel}:${i + 1} [${hits.join(",")}] ${line.trim()}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
