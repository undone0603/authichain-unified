#!/usr/bin/env node
// Skip the Next production build when every changed file sits under a root
// in .github/build-baseline.json. Those roots are outside the Next program
// (workflows, docs, Workers). A change anywhere else still runs `pnpm build`.
//
//   node scripts/ci/build-baseline.mjs --ci
//
// --ci reads EVENT_NAME and BASE_SHA, writes skip=true|false to GITHUB_OUTPUT,
// and fails closed: a missing base, a bad baseline, or an empty diff runs the
// build. It never skips because it could not tell.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BASELINE_FILE = ".github/build-baseline.json";

/** Roots that are inputs to `next build`. A skip root may not cover these. */
export const NEVER_SKIP = [
  "src/",
  "app/",
  "client/",
  "server/",
  "public/",
  "packages/",
  "shared/",
  "pages/",
  "content/",
  "scripts/",
];

/**
 * Pure. `skip` is true only when there is at least one file and every file
 * is under a skip root. `outside` is the files that force a build.
 */
export function decide(files, skipRoots) {
  const roots = (skipRoots ?? []).map(normalizeRoot);
  const outside = [];
  for (const file of files) {
    const rel = file.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!roots.some((root) => underRoot(rel, root))) outside.push(rel);
  }
  if (files.length === 0) {
    return { skip: false, outside, reason: "no changed files; build" };
  }
  if (outside.length > 0) {
    return {
      skip: false,
      outside,
      reason: `${outside.length} path(s) outside the baseline`,
    };
  }
  return { skip: true, outside, reason: "every path is in the build baseline" };
}

/** Pure. Throws when a skip root would hide a Next input. */
export function validateBaseline(baseline) {
  if (!baseline || !Array.isArray(baseline.skipRoots) || baseline.skipRoots.length === 0) {
    throw new Error("build baseline needs a non-empty skipRoots array");
  }
  for (const root of baseline.skipRoots) {
    if (typeof root !== "string" || root.length === 0 || root.includes("..")) {
      throw new Error(`bad skip root: ${root}`);
    }
    const normalized = normalizeRoot(root);
    for (const banned of NEVER_SKIP) {
      if (normalized === banned || banned.startsWith(normalized) || normalized.startsWith(banned)) {
        throw new Error(`skip root ${root} overlaps Next input ${banned}`);
      }
    }
  }
  return baseline;
}

export function loadBaseline(root = ROOT) {
  const baseline = JSON.parse(readFileSync(path.join(root, BASELINE_FILE), "utf8"));
  return validateBaseline(baseline);
}

function normalizeRoot(root) {
  const rel = root.replace(/\\/g, "/").replace(/^\.\//, "");
  if (rel.endsWith("/")) return rel;
  return rel;
}

function underRoot(file, root) {
  if (root.endsWith("/")) return file.startsWith(root);
  return file === root;
}

function changedFiles(baseSha) {
  if (!baseSha || /^0+$/.test(baseSha)) return [];
  try {
    execFileSync("git", ["cat-file", "-e", `${baseSha}^{commit}`], { cwd: ROOT, stdio: "ignore" });
  } catch {
    execFileSync("git", ["fetch", "--depth=1", "origin", baseSha], { cwd: ROOT, stdio: "inherit" });
  }
  const out = execFileSync("git", ["diff", "--name-only", baseSha, "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function writeOutput(skip) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(file, `skip=${skip ? "true" : "false"}\n`);
}

function runCi() {
  const event = process.env.EVENT_NAME ?? "";
  if (event === "workflow_dispatch" || event === "") {
    console.log("build baseline: manual or unknown event; running the Next build");
    writeOutput(false);
    return;
  }
  const baseline = loadBaseline();
  const files = changedFiles(process.env.BASE_SHA ?? "");
  const decision = decide(files, baseline.skipRoots);
  console.log(`build baseline: ${decision.reason}`);
  if (!decision.skip && decision.outside.length > 0) {
    for (const file of decision.outside.slice(0, 20)) console.log(`  ${file}`);
  }
  writeOutput(decision.skip);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (process.argv.includes("--ci")) runCi();
    else {
      const baseline = loadBaseline();
      console.log(`build baseline roots: ${baseline.skipRoots.join(", ")}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
