#!/usr/bin/env node
// scripts/autonomy/god-mode-classify.mjs
// CODEOWNERS god mode: detect and classify missing workflows in autonomy.json.
// Default: manual lane. --apply opens draft PR. Never auto-merges.
//
// Usage (founder local):
//   node scripts/autonomy/god-mode-classify.mjs --apply
// Requires gh CLI and GH_TOKEN / GITHUB_TOKEN with contents:write + pull-requests:write.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = join(ROOT, ".github", "autonomy.json");
const WF_DIR = join(ROOT, ".github", "workflows");

function listYmls() {
  return readdirSync(WF_DIR).filter(f => f.endsWith(".yml") || f.endsWith(".yaml")).sort();
}

function suggest(file, content) {
  const hasSchedule = /schedule:/.test(content);
  const hasDispatch = /workflow_dispatch:/.test(content);
  const hasPushPR = /push:|pull_request:/.test(content);
  if (hasDispatch && !hasSchedule && !hasPushPR) return { lane: "manual", state: "manual" };
  if (hasSchedule) return { lane: "health", state: "on" };
  return { lane: "manual", state: "manual" };
}

function findMissing(manifest) {
  const classified = new Set();
  for (const lane of Object.values(manifest.lanes || {})) {
    for (const f of Object.keys(lane.workflows || {})) classified.add(f);
  }
  return listYmls().filter(f => !classified.has(f));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const missing = findMissing(manifest);
  if (!missing.length) {
    console.log("OK: all workflows classified");
    return;
  }
  console.log("Unclassified:");
  for (const file of missing) {
    const content = readFileSync(join(WF_DIR, file), "utf8");
    const s = suggest(file, content);
    console.log(`  ${file} -> ${s.lane} (${s.state})`);
  }
  if (!apply) {
    console.log("Re-run with --apply to open draft PR");
    return;
  }
  const branch = "auto/classify-" + Date.now();
  execSync(`git checkout -b ${branch}`);
  let text = readFileSync(MANIFEST, "utf8");
  for (const file of missing) {
    const content = readFileSync(join(WF_DIR, file), "utf8");
    const s = suggest(file, content);
    // Simple safe insert under the suggested lane's workflows object
    const laneKey = `"${s.lane}": {`;
    const insert = `"${s.lane}": {\n      "workflows": {\n        "${file}": "${s.state}",`;
    if (text.includes(laneKey)) {
      text = text.replace(laneKey, insert);
    }
  }
  writeFileSync(MANIFEST, text);
  execSync("git add .github/autonomy.json");
  execSync('git commit -m "chore(autonomy): god-mode auto-classify"');
  execSync(`git push -u origin ${branch}`);
  execSync('gh pr create --draft --title "chore: auto-classify workflows" --body "God mode classification. Review required by CODEOWNERS."');
  console.log("Draft PR created");
}

main().catch(e => { console.error(e); process.exit(1); });
