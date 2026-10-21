// scripts/autonomy/estate-gate.mjs
//
// Token-free, repo-side half of the estate gate (tracking #1994).
// Reads config/estate.json and requires every off-repo Worker to carry an
// explicit decision. `unknown` is not a decision: the owner has to choose
// (snapshot into workers/<name> or retire). Archive paths must exist.
//
// The LIVE comparison (which Workers actually exist on Cloudflare) needs a
// read-only Cloudflare API token and stays a separate pending gate
// (estate-live-drift); scripts/autonomy/estate-drift.mjs implements it.
//
// FAIL CLOSED: no inventory, an unknown disposition, an invalid disposition or
// a missing archive file all fail.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ALLOWED_DISPOSITIONS = ["archive", "retire", "unrelated"];

export function collectEstateEvidence({ root = ROOT } = {}) {
  const estate = JSON.parse(
    readFileSync(join(root, "config", "estate.json"), "utf8")
  );
  const inventory = estate.off_repo_workers ?? {};
  const entries = Object.entries(inventory).map(([name, e]) => ({
    name,
    disposition: e?.disposition ?? null,
    archive: e?.archive ?? null,
    archive_exists: e?.archive ? existsSync(join(root, e.archive)) : null,
  }));
  return { entries, snapshot_taken: estate.snapshot?.taken ?? null };
}

/** Pure. */
export function evaluateEstateEvidence(evidence) {
  const entries = evidence?.entries;
  if (!Array.isArray(entries) || entries.length === 0)
    return {
      status: "fail",
      reasons: ["no estate inventory collected"],
      evidence: {},
    };
  const reasons = [];
  for (const e of entries) {
    const name = e?.name;
    if (!name) {
      reasons.push("inventory entry without a name");
      continue;
    }
    if (e.disposition === "unknown")
      reasons.push(`${name}: disposition is 'unknown' (owner must decide: snapshot or retire)`);
    else if (!ALLOWED_DISPOSITIONS.includes(e.disposition))
      reasons.push(`${name}: invalid disposition ${String(e.disposition)}`);
    if (e.disposition === "archive" && !e.archive)
      reasons.push(`${name}: disposition is 'archive' but no archive path is recorded`);
    else if (e.archive && e.archive_exists !== true)
      reasons.push(`${name}: archive file ${e.archive} is missing`);
  }
  const out = { entries: entries.length, snapshot_taken: evidence.snapshot_taken ?? null };
  return reasons.length
    ? { status: "fail", reasons, evidence: out }
    : { status: "pass", reasons: [], evidence: out };
}
