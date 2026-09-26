#!/usr/bin/env node
// scripts/autonomy/estate-drift.mjs
// Weekly, read-only. Live Cloudflare Workers vs wrangler configs vs config/estate.json.
// Ghosts open one issue labelled estate-drift. Silence means clean.

import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LABEL = "estate-drift";
const TITLE = "Estate drift: live Cloudflare Workers with no source";
const MARKER = "<!-- estate-drift-signature:";

export function loadEstate(path = resolve(ROOT, "config/estate.json")) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function wranglerName(text, file = "") {
  if (/\.toml$/.test(file)) {
    for (const line of String(text).split(/\r?\n/)) {
      if (/^\s*\[/.test(line)) break;
      const m = line.match(/^\s*name\s*=\s*["']([^"']+)["']/);
      if (m) return m[1];
    }
    return null;
  }
  const m = String(text).match(/"name"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

export function repoWorkerNames(root = ROOT) {
  const files = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(f => /(^|\/)wrangler[^/]*\.(toml|json|jsonc)$/.test(f))
    .filter(f => !f.startsWith("docs/"));
  const names = new Map();
  for (const f of files) {
    const n = wranglerName(readFileSync(resolve(root, f), "utf8"), f);
    if (n && !names.has(n)) names.set(n, f);
  }
  return names;
}

export function evaluateDrift(live, repo, estate) {
  const has = n => repo.has(n);
  const inv = estate.off_repo_workers ?? {};
  const liveSet = new Set(live);
  const ghosts = [];
  const retire = [];
  const tracked = [];
  for (const name of [...live].sort()) {
    if (has(name)) continue;
    const entry = inv[name];
    if (!entry) ghosts.push(name);
    else if (entry.disposition === "retire") retire.push(name);
    else tracked.push({ name, disposition: entry.disposition });
  }
  const gone = Object.keys(inv)
    .filter(n => !liveSet.has(n))
    .sort();
  return { ghosts, retire, tracked, gone, live: live.length };
}

export function signature(result) {
  return result.ghosts.join(",");
}

export function render(result, at = new Date().toISOString()) {
  const lines = [`Estate drift check at ${at}. Live Workers: ${result.live}.`, ""];
  if (result.ghosts.length) {
    lines.push("#### Live with no source and no inventory entry");
    for (const n of result.ghosts) {
      lines.push(
        `- \`${n}\`: find who deployed it. If it is ours, add a wrangler config under \`workers/${n}/\` or an entry in \`config/estate.json\`. If nobody knows it, rotate \`CLOUDFLARE_API_TOKEN\` and delete it.`
      );
    }
    lines.push("");
  }
  if (result.retire.length) {
    lines.push("#### Marked retire in config/estate.json (owner deletes in the dashboard)");
    for (const n of result.retire) lines.push(`- \`${n}\``);
    lines.push("");
  }
  if (result.tracked.length) {
    lines.push("#### Tracked off-repo");
    for (const t of result.tracked) lines.push(`- \`${t.name}\` (${t.disposition})`);
    lines.push("");
  }
  if (result.gone.length) {
    lines.push("#### In the inventory but no longer live (trim config/estate.json)");
    for (const n of result.gone) lines.push(`- \`${n}\``);
    lines.push("");
  }
  if (!result.ghosts.length) lines.push("No ghosts. Nothing needs you.");
  return lines.join("\n");
}

export function decideIssueAction(existing, result, at) {
  const sig = signature(result);
  if (!sig)
    return existing
      ? { action: "close", body: `No ghost Workers at ${at}. Closing.` }
      : { action: "none" };
  const body = `${render(result, at)}\n\n${MARKER}${sig} -->`;
  if (!existing) return { action: "create", body };
  const prev = (existing.body ?? "").split(MARKER)[1]?.split(" -->")[0] ?? "";
  return prev === sig ? { action: "none" } : { action: "update", body };
}

export async function liveWorkers({ accountId, token, fetchImpl = fetch }) {
  const res = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(
      `Cloudflare ${res.status}: ${JSON.stringify(data.errors ?? []).slice(0, 200)}`
    );
  }
  return (data.result ?? []).map(s => s.id).filter(Boolean);
}

async function gh(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "authichain-estate-drift",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

function out(md) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !cfToken) {
    out("### Estate drift: skipped (no Cloudflare credentials)");
    return;
  }
  const at = new Date().toISOString();
  const result = evaluateDrift(
    await liveWorkers({ accountId, token: cfToken }),
    repoWorkerNames(),
    loadEstate()
  );
  out(`### Estate drift: ${result.ghosts.length ? "GHOSTS" : "clean"}\n\n${render(result, at)}`);

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (process.env.DRIFT_DRY_RUN === "true" || !token || !repo) {
    console.log(JSON.stringify(decideIssueAction(null, result, at)));
    return;
  }
  await gh(`/repos/${repo}/labels`, {
    method: "POST",
    token,
    body: { name: LABEL, color: "fbca04" },
  }).catch(() => {});
  const open = await gh(`/repos/${repo}/issues?state=open&labels=${LABEL}&per_page=5`, { token });
  const existing = open.find(i => i.title === TITLE) ?? null;
  const d = decideIssueAction(existing, result, at);
  if (d.action === "create") {
    await gh(`/repos/${repo}/issues`, {
      method: "POST",
      token,
      body: { title: TITLE, body: d.body, labels: [LABEL] },
    });
  }
  if (d.action === "update") {
    await gh(`/repos/${repo}/issues/${existing.number}`, {
      method: "PATCH",
      token,
      body: { body: d.body },
    });
  }
  if (d.action === "close") {
    await gh(`/repos/${repo}/issues/${existing.number}/comments`, {
      method: "POST",
      token,
      body: { body: d.body },
    });
    await gh(`/repos/${repo}/issues/${existing.number}`, {
      method: "PATCH",
      token,
      body: { state: "closed" },
    });
  }
  console.log(`drift issue: ${d.action}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
