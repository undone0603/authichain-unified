/**
 * Tier 1 high-leverage buyer shortlist (Supabase source
 * high_leverage_scan_2026-09-19). Loadable via `--segment=high_leverage`.
 * Never folded into all / govchain / strainchain / qron / partners.
 *
 * Lives in its own module because `scripts/b2b-cold-outreach.ts` runs its
 * main routine at import time.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VerificationSource } from "../../server/outreach/send-guard";

export const HIGH_LEVERAGE_LEAD_SOURCE = "high_leverage_scan_2026-09-19";

export const HIGH_LEVERAGE_SEGMENTS = [
  "strainchain",
  "qron",
  "govchain",
] as const;

export type HighLeverageSegment = (typeof HIGH_LEVERAGE_SEGMENTS)[number];

export type HighLeverageTarget = {
  company: string;
  name: string;
  email: string;
  website?: string;
  segment: HighLeverageSegment;
  role: "buyer" | "channel";
  notes: string;
  source: VerificationSource;
};

type HighLeverageFile = {
  source: string;
  generated: string;
  note?: string;
  targets: HighLeverageTarget[];
};

const DATA_FILE = "high-leverage-2026-09-19.json";

const ALLOWED_EMAILS = new Set([
  "scott.krupa@fastsigns.com",
  "mark.jameson@fastsigns.com",
  "info@stashstock.com",
  "wendy.linscott@curaleaf.com",
  "klong@c3industries.com",
]);

function dataPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", DATA_FILE);
}

export function loadHighLeverageFile(jsonText?: string): HighLeverageFile {
  const raw = jsonText ?? readFileSync(dataPath(), "utf8");
  const parsed = JSON.parse(raw) as HighLeverageFile;
  if (parsed.source !== HIGH_LEVERAGE_LEAD_SOURCE) {
    throw new Error(
      `high-leverage file source must be ${HIGH_LEVERAGE_LEAD_SOURCE}`
    );
  }
  if (!Array.isArray(parsed.targets) || parsed.targets.length === 0) {
    throw new Error("high-leverage file has no targets");
  }
  for (const target of parsed.targets) {
    const email = target.email.trim().toLowerCase();
    if (!ALLOWED_EMAILS.has(email)) {
      throw new Error(`${target.email}: not in the owner-supplied Tier 1 set`);
    }
    if (target.role !== "buyer" && target.role !== "channel") {
      throw new Error(`${target.company}: role must be buyer or channel`);
    }
    if (!HIGH_LEVERAGE_SEGMENTS.includes(target.segment)) {
      throw new Error(`${target.company}: invalid segment ${target.segment}`);
    }
  }
  return parsed;
}

const file = loadHighLeverageFile();

export const HIGH_LEVERAGE_TARGETS: readonly HighLeverageTarget[] =
  file.targets;

export function shouldLoadHighLeverageTargets(segment: string): boolean {
  return segment === "high_leverage";
}

/** Live high-leverage sends are refused in this path. Dry-run only. */
export function assertHighLeverageRunAllowed(opts: {
  isDryRun: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (opts.isDryRun) return { ok: true };
  return {
    ok: false,
    message:
      "high_leverage is dry-run only. Not included in all/govchain/strainchain/qron/partners live cold sends. Do not invent a live flag for this list.",
  };
}
