#!/usr/bin/env node
// scripts/autonomy/launch-mode.mjs
//
// Launch mode: a time-boxed loosening of named gates until the first revenue
// arrives (docs/OPERATING_CHARTER.md, "Launch mode"). Loops ask this script one
// question — is launch mode active? — and fall back to their normal gate when
// it is disabled, expired, or malformed. Expiry is the "tighten up": nobody has
// to remember to switch it off.
//
// CLI (for workflows): node scripts/autonomy/launch-mode.mjs
//   writes active, expires, days_left, cold_outreach_cap to $GITHUB_OUTPUT and
//   one line to $GITHUB_STEP_SUMMARY. Always exits 0.

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".github",
  "autonomy.json"
);

/** Longest a single launch window may run, so it can never be left on forever. */
export const MAX_WINDOW_DAYS = 90;
const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function endOf(expires) {
  return ISO_DATE.test(expires ?? "")
    ? Date.parse(`${expires}T23:59:59Z`)
    : NaN;
}

/** Pure. Resolve launch mode from the manifest at `now`. */
export function launchMode(manifest, now = new Date()) {
  const lm = manifest?.launch_mode;
  const baseCap = manifest?.cold_outreach?.max_new_prospects_per_day ?? 0;
  const end = endOf(lm?.expires);
  const inactive = {
    active: false,
    expires: lm?.expires ?? null,
    daysLeft: 0,
    coldOutreachCap: baseCap,
  };
  if (!lm || lm.enabled !== true || !Number.isFinite(end)) return inactive;
  if (now.getTime() > end) return inactive;
  return {
    active: true,
    expires: lm.expires,
    daysLeft: Math.ceil((end - now.getTime()) / DAY),
    coldOutreachCap: Number.isInteger(lm.cold_outreach_cap)
      ? lm.cold_outreach_cap
      : baseCap,
  };
}

/** Pure. Manifest errors for the launch_mode block (empty when absent). */
export function validateLaunchMode(manifest, now = new Date()) {
  const lm = manifest?.launch_mode;
  if (!lm) return [];
  const errors = [];
  if (typeof lm.enabled !== "boolean")
    errors.push("launch_mode.enabled must be true or false");
  const end = endOf(lm.expires);
  if (!Number.isFinite(end)) {
    errors.push("launch_mode.expires must be a YYYY-MM-DD date");
  } else if (lm.enabled && end - now.getTime() > MAX_WINDOW_DAYS * DAY) {
    errors.push(
      `launch_mode.expires must be within ${MAX_WINDOW_DAYS} days while enabled`
    );
  }
  const cap = lm.cold_outreach_cap;
  if (cap !== undefined && (!Number.isInteger(cap) || cap < 0 || cap > 50))
    errors.push("launch_mode.cold_outreach_cap must be an integer 0-50");
  return errors;
}

function main() {
  const m = launchMode(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")));
  const out = [
    `active=${m.active}`,
    `expires=${m.expires ?? ""}`,
    `days_left=${m.daysLeft}`,
    `cold_outreach_cap=${m.coldOutreachCap}`,
  ].join("\n");
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, out + "\n");
  const line = m.active
    ? `Launch mode ACTIVE until ${m.expires} (${m.daysLeft} days left).`
    : `Launch mode off${m.expires ? ` (expires ${m.expires})` : ""}; normal gates apply.`;
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
  console.log(out);
  console.log(line);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
