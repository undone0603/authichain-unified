#!/usr/bin/env node
// scripts/autonomy/reconcile.mjs
//
// Makes GitHub Actions match .github/autonomy.json.
//
//   node scripts/autonomy/reconcile.mjs --check   # offline: every workflow file classified exactly once
//   node scripts/autonomy/reconcile.mjs --plan    # read GitHub, print the diff, change nothing
//   node scripts/autonomy/reconcile.mjs --apply   # read GitHub, enable/disable to match
//
// Needs GITHUB_TOKEN (actions:write for --apply) and GITHUB_REPOSITORY for --plan/--apply.
// Only lanes with "managed": true are reconciled. "manual" workflows are never touched.
// Writes a markdown report to $GITHUB_STEP_SUMMARY when present.

import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MANIFEST_PATH = join(ROOT, ".github", "autonomy.json");
export const WORKFLOW_DIR = join(ROOT, ".github", "workflows");
const VALID_STATES = new Set(["on", "off", "manual"]);

export function loadManifest(path = MANIFEST_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function listWorkflowFiles(dir = WORKFLOW_DIR) {
  return readdirSync(dir)
    .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
}

/** Flatten lanes into [{file, lane, desired, managed}]. */
export function flatten(manifest) {
  const rows = [];
  for (const [lane, def] of Object.entries(manifest.lanes ?? {})) {
    for (const [file, desired] of Object.entries(def.workflows ?? {})) {
      rows.push({ file, lane, desired, managed: def.managed === true });
    }
  }
  return rows;
}

/** Offline validation. Returns an array of human-readable errors (empty = ok). */
export function validateManifest(manifest, workflowFiles) {
  const errors = [];
  const rows = flatten(manifest);
  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.file)) {
      errors.push(
        `${r.file} is listed in both "${seen.get(r.file)}" and "${r.lane}"`
      );
    }
    seen.set(r.file, r.lane);
    if (!VALID_STATES.has(r.desired)) {
      errors.push(
        `${r.file}: state "${r.desired}" must be one of on | off | manual`
      );
    }
    if (r.managed && r.desired === "manual") {
      errors.push(
        `${r.file}: "manual" is only valid in an unmanaged lane (lane "${r.lane}" is managed)`
      );
    }
    if (!r.managed && r.desired !== "manual") {
      errors.push(
        `${r.file}: lane "${r.lane}" is unmanaged, so its state must be "manual"`
      );
    }
  }
  const files = new Set(workflowFiles);
  for (const f of workflowFiles) {
    if (!seen.has(f)) {
      errors.push(
        `${f} exists in .github/workflows but is not classified in .github/autonomy.json`
      );
    }
  }
  for (const f of seen.keys()) {
    if (!files.has(f))
      errors.push(
        `${f} is in .github/autonomy.json but no such workflow file exists`
      );
  }
  const co = manifest.cold_outreach;
  if (co) {
    if (typeof co.enabled !== "boolean")
      errors.push("cold_outreach.enabled must be true or false");
    const cap = co.max_new_prospects_per_day;
    if (!Number.isInteger(cap) || cap < 0 || cap > 50) {
      errors.push(
        "cold_outreach.max_new_prospects_per_day must be an integer 0-50"
      );
    }
    const b = co.breaker ?? {};
    if (!(b.max_bounce_rate > 0 && b.max_bounce_rate < 0.2)) {
      errors.push(
        "cold_outreach.breaker.max_bounce_rate must be between 0 and 0.2"
      );
    }
  }
  return errors;
}

/**
 * Compare desired vs GitHub state.
 * remote: [{id, path, state}] from GET /actions/workflows (path like ".github/workflows/x.yml").
 * Returns {changes:[{file,id,lane,from,to}], unknownRemote:[file]}
 */
export function planReconcile(manifest, remote) {
  const byFile = new Map(remote.map(w => [w.path.split("/").pop(), w]));
  const changes = [];
  for (const r of flatten(manifest)) {
    if (!r.managed) continue;
    const w = byFile.get(r.file);
    if (!w) continue; // not registered on GitHub yet (e.g. file just added); next run picks it up
    const isActive = w.state === "active";
    if (r.desired === "on" && !isActive) {
      changes.push({
        file: r.file,
        id: w.id,
        lane: r.lane,
        from: w.state,
        to: "enable",
      });
    } else if (r.desired === "off" && isActive) {
      changes.push({
        file: r.file,
        id: w.id,
        lane: r.lane,
        from: w.state,
        to: "disable",
      });
    }
  }
  const known = new Set(flatten(manifest).map(r => r.file));
  const unknownRemote = remote
    .filter(w => w.path.startsWith(".github/workflows/"))
    .map(w => w.path.split("/").pop())
    .filter(f => !known.has(f));
  return { changes, unknownRemote };
}

async function gh(path, { method = "GET", token, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "authichain-autonomy-reconcile",
    },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => "");
    throw new Error(`${method} ${path} -> ${res.status} ${body.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function fetchRemoteWorkflows({ repo, token, fetchImpl }) {
  const out = [];
  for (let page = 1; page < 10; page++) {
    const d = await gh(
      `/repos/${repo}/actions/workflows?per_page=100&page=${page}`,
      { token, fetchImpl }
    );
    out.push(...d.workflows);
    if (d.workflows.length < 100) break;
  }
  return out;
}

function summary(md) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

async function main(argv) {
  const mode = argv.includes("--apply")
    ? "apply"
    : argv.includes("--plan")
      ? "plan"
      : "check";
  const manifest = loadManifest();
  const errors = validateManifest(manifest, listWorkflowFiles());
  if (errors.length) {
    summary(
      `### autonomy.json is invalid\n\n${errors.map(e => `- ${e}`).join("\n")}`
    );
    return 1;
  }
  const rows = flatten(manifest);
  const count = s => rows.filter(r => r.desired === s).length;
  if (mode === "check") {
    summary(
      `autonomy.json OK: ${rows.length} workflows classified (${count("on")} on, ${count("off")} off, ${count("manual")} manual). Cold outreach: ${manifest.cold_outreach?.enabled ? "ENABLED" : "disabled"}.`
    );
    return 0;
  }
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.error(
      "GITHUB_TOKEN and GITHUB_REPOSITORY are required for --plan/--apply"
    );
    return 2;
  }
  const remote = await fetchRemoteWorkflows({ repo, token });
  const { changes } = planReconcile(manifest, remote);
  if (!changes.length) {
    summary(
      `### Autonomy reconcile: in sync\n\n${count("on")} managed workflows on, ${count("off")} off. Nothing to change.`
    );
    return 0;
  }
  const lines = changes.map(
    c => `| \`${c.file}\` | ${c.lane} | ${c.from} | **${c.to}** |`
  );
  summary(
    `### Autonomy reconcile (${mode})\n\n| Workflow | Lane | GitHub state | Action |\n|---|---|---|---|\n${lines.join("\n")}`
  );
  if (mode === "plan") return 0;
  let failed = 0;
  for (const c of changes) {
    try {
      await gh(`/repos/${repo}/actions/workflows/${c.id}/${c.to}`, {
        method: "PUT",
        token,
      });
      console.log(`${c.to}d ${c.file}`);
    } catch (e) {
      failed++;
      console.error(`could not ${c.to} ${c.file}: ${e.message}`);
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    code => process.exit(code),
    e => {
      console.error(e);
      process.exit(1);
    }
  );
}
