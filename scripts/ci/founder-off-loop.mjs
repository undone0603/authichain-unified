#!/usr/bin/env node
/**
 * Founder-off-loop digest (Autonomy Engineer, 2026-10-09).
 *
 * Read-only. Does not merge, comment, deploy, or write secrets.
 * Classifies open PRs so the morning review is a step summary, not a click-through.
 * Re-probes the public money/protocol surfaces already owned by post-deploy-smoke.
 *
 * Idempotent: same inputs -> same classification. Retries probes with backoff.
 * Observability: structured JSON line per PR and per probe; GitHub step summary;
 * job fails only when a public surface is wrong (founder asleep still gets a red check).
 *
 * Usage:
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=undone0603/authichain-unified \
 *     node scripts/ci/founder-off-loop.mjs
 */
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SMOKE_CHECKS, runSmoke } from "./post-deploy-smoke.mjs";

const HOLD = /hold|unsigned|contain|disable button|refuse writes|no deploy/i;
const COPY_CUT = /cut |remove |delete |honest|claim|copy:/i;
const AUTONOMY = /autopilot|seo|cron|route|digest|ci\(/i;

export function classify(title) {
  const t = title ?? "";
  if (HOLD.test(t)) return "hold";
  if (COPY_CUT.test(t)) return "copy_cut";
  if (AUTONOMY.test(t)) return "autonomy";
  return "review";
}

async function gh(pathname, token) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "authichain-founder-off-loop/1",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`github ${res.status} ${pathname}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function digestPulls(pulls) {
  const buckets = { hold: [], copy_cut: [], autonomy: [], review: [] };
  for (const pr of pulls) {
    const row = {
      number: pr.number,
      title: pr.title,
      draft: Boolean(pr.draft),
      updated_at: pr.updated_at,
      url: pr.html_url,
      bucket: classify(pr.title),
    };
    buckets[row.bucket].push(row);
    console.log(JSON.stringify({ event: "pr_classified", ...row }));
  }
  return buckets;
}

function summary(buckets, smoke) {
  const lines = [
    "# Founder-off-loop digest",
    "",
    "Read-only. Nothing was merged or deployed.",
    "",
    "## Public surfaces",
    smoke.ok ? "All smoke checks passed." : "SMOKE FAILED — do not treat main as healthy.",
    ...smoke.results.map(r => `- ${r.ok ? "PASS" : "FAIL"} ${r.id}: ${r.reason}`),
    "",
    "## Open PRs",
    `- hold (do not merge without an explicit decision): ${buckets.hold.length}`,
    `- copy_cut (claim containment, review truthfulness): ${buckets.copy_cut.length}`,
    `- autonomy (loop removal, prefer these): ${buckets.autonomy.length}`,
    `- review: ${buckets.review.length}`,
    "",
  ];
  for (const key of ["autonomy", "copy_cut", "hold", "review"]) {
    if (!buckets[key].length) continue;
    lines.push(`### ${key}`);
    for (const pr of buckets[key].slice(0, 12)) {
      lines.push(`- ${pr.draft ? "draft " : ""}#${pr.number} ${pr.title}`);
    }
    lines.push("");
  }
  lines.push("Next founder decision: merge a green copy_cut PR. Do not merge SEO regen or holds from this digest.");
  return lines.join("\n");
}

async function main() {
  const token = process.env.GITHUB_TOKEN || "";
  const repo = process.env.GITHUB_REPOSITORY || "undone0603/authichain-unified";
  if (!token) {
    console.error("::error::GITHUB_TOKEN missing — digest cannot list PRs");
    process.exit(1);
  }
  const pulls = await gh(`/repos/${repo}/pulls?state=open&per_page=30&sort=updated&direction=desc`, token);
  const buckets = await digestPulls(Array.isArray(pulls) ? pulls : []);
  const smoke = await runSmoke({
    checks: SMOKE_CHECKS,
    retries: Number(process.env.SMOKE_RETRIES ?? 2),
    delayMs: Number(process.env.SMOKE_DELAY_MS ?? 4000),
  });
  const text = summary(buckets, smoke);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, text + "\n");
  else console.log(text);
  console.log(JSON.stringify({
    event: "founder_off_loop_complete",
    smoke_ok: smoke.ok,
    counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
  }));
  if (!smoke.ok) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
