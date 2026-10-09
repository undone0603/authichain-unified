#!/usr/bin/env node
/**
 * Deploy invariants (PM-330 item 5, CFD-265). Read-only, offline, no deps.
 *
 * Fails the build when either of these regresses:
 *
 *  1. `workers_dev` for the Workers listed in WORKERS_DEV_OFF is anything but
 *     an explicit top-level `workers_dev = false` (TOML) or
 *     `"workers_dev": false` (JSON/JSONC wrangler configs).
 *     Missing counts as a failure: wrangler then picks a default (true when the
 *     Worker has no routes), and authichain-automation's public workers.dev
 *     address exposed /manufacturers until it was turned off on Oct 9 2026
 *     (PM-322).
 *
 *  2. `cancel-in-progress: true` (literally) in any workflow that deploys
 *     on push to main. With a ref-keyed concurrency group, every merge then
 *     cancels the deploy still running from the previous merge, leaving
 *     Workers half-deployed (the 8:17-8:26 AM ET burst on Oct 9, PM-328).
 *     `${{ github.event_name == 'pull_request' }}` is the accepted form.
 *
 * Usage: node scripts/ci/check-deploy-invariants.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const WORKERS_DEV_OFF = [
  {
    name: "authichain-automation",
    file: "workers/authichain-automation/wrangler.toml",
  },
  { name: "authichain-edge-router", file: "worker-app/wrangler.toml" },
  // CFA-142: its workers.dev address served stale /governance token and
  // treasury pages until it was turned off live on Oct 9 2026 (PR #1703).
  { name: "authichain-app", file: "wrangler.app.jsonc" },
];

function stripTomlComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

/** Raw value of a top-level key (before the first [table]), or undefined. */
export function topLevelTomlValue(text, key) {
  for (const raw of text.split(/\r?\n/)) {
    const line = stripTomlComment(raw).trim();
    if (!line) continue;
    if (line.startsWith("[")) return undefined;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (m && m[1] === key) return m[2].trim();
  }
  return undefined;
}

/** Strip line and block comments and trailing commas from JSONC, string-aware. */
export function stripJsonc(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += text[i + 1] ?? "";
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 1;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Raw top-level value of `key` in a wrangler config, as a TOML-style string
 * (`"false"`, `"\"name\""`), or undefined. Handles .toml, .json and .jsonc.
 */
export function topLevelConfigValue(file, text, key) {
  if (!/\.jsonc?$/.test(file)) return topLevelTomlValue(text, key);
  let obj;
  try {
    obj = JSON.parse(stripJsonc(text));
  } catch {
    return undefined;
  }
  if (!obj || typeof obj !== "object" || !(key in obj)) return undefined;
  return JSON.stringify(obj[key]);
}

function unquote(value) {
  return value?.replace(/^["']|["']$/g, "");
}

export function checkWorkersDev(root = ROOT, targets = WORKERS_DEV_OFF) {
  const errors = [];
  for (const { name, file } of targets) {
    let text;
    try {
      text = readFileSync(path.join(root, file), "utf8");
    } catch {
      errors.push(`${file}: missing (expected wrangler config for ${name})`);
      continue;
    }
    const actualName = unquote(topLevelConfigValue(file, text, "name"));
    if (actualName !== name) {
      errors.push(
        `${file}: name is ${actualName ?? "missing"}, expected ${name}`
      );
      continue;
    }
    const value = topLevelConfigValue(file, text, "workers_dev");
    if (value === undefined) {
      errors.push(
        `${file} (${name}): workers_dev is missing; wrangler would choose a default. Set top-level workers_dev = false.`
      );
    } else if (value !== "false") {
      errors.push(`${file} (${name}): workers_dev = ${value}; must be false.`);
    }
  }
  return errors;
}

const DEPLOY_CMD =
  /\bwrangler(?:@[\w.^~-]+)?\s+(?:deploy|versions\s+deploy)\b|cloudflare\/wrangler-action/;

/** Lines of the top-level `on:` block (handles `on:` and `"on":`). */
function onBlock(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => /^["']?on["']?\s*:/.test(l));
  if (start < 0) return [];
  const inline = lines[start].replace(/^["']?on["']?\s*:/, "").trim();
  const block = inline ? [inline] : [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\S/.test(l) && !l.startsWith("#")) break;
    block.push(l);
  }
  return block;
}

export function triggersOnPushToMain(text) {
  const block = onBlock(text);
  if (block.length === 0) return false;
  const joined = block.join("\n");
  // `on: push` / `on: [push, ...]`
  if (/^\[?[^\n]*\bpush\b/.test(block[0]) && !/^\s/.test(block[0])) return true;
  const pushIdx = block.findIndex(l => /^\s+push\s*:/.test(l));
  if (pushIdx < 0) return /^\s*-\s*push\s*$/m.test(joined);
  const indent = block[pushIdx].match(/^\s*/)[0].length;
  const body = [];
  for (let i = pushIdx + 1; i < block.length; i += 1) {
    const l = block[i];
    if (!l.trim() || l.trim().startsWith("#")) continue;
    if (l.match(/^\s*/)[0].length <= indent) break;
    body.push(l);
  }
  const bodyText = body.join("\n");
  if (!/\bbranches\s*:/.test(bodyText)) return true; // all branches
  return (
    /\bbranches\s*:\s*\[[^\]]*\bmain\b/.test(bodyText) ||
    /^\s*-\s*["']?main["']?\s*$/m.test(bodyText)
  );
}

export function cancelInProgressTrueLines(text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*cancel-in-progress\s*:\s*["']?true["']?\s*(#.*)?$/.test(line))
      hits.push(i + 1);
  });
  return hits;
}

export function checkCancelInProgress(root = ROOT) {
  const dir = path.join(root, ".github", "workflows");
  const errors = [];
  for (const file of readdirSync(dir).sort()) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = readFileSync(path.join(dir, file), "utf8");
    if (!DEPLOY_CMD.test(text) || !triggersOnPushToMain(text)) continue;
    for (const line of cancelInProgressTrueLines(text)) {
      errors.push(
        `.github/workflows/${file}:${line}: cancel-in-progress: true on a push-to-main deploy workflow; use \${{ github.event_name == 'pull_request' }}.`
      );
    }
  }
  return errors;
}

/**
 * CI workflows that gate main (CFA-123). No literal `cancel-in-progress: true`,
 * and on push the concurrency group must be per commit (contain github.sha):
 * GitHub cancels an older PENDING run in the same group when a newer one
 * queues, even with cancel-in-progress false, so a shared main group can still
 * drop a commit's CI before it starts.
 */
export const CI_GATE_WORKFLOWS = ["main.yml"];

/** The `group:` value of the top-level `concurrency:` block, or null. */
export function topLevelConcurrencyGroup(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => /^concurrency\s*:/.test(l));
  if (start < 0) return null;
  const inline = lines[start].replace(/^concurrency\s*:/, "").trim();
  if (inline && !inline.startsWith("#")) return inline;
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\S/.test(l) && !l.startsWith("#")) break;
    const m = l.match(/^\s+group\s*:\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  return null;
}

export function checkCiGateWorkflows(root = ROOT, files = CI_GATE_WORKFLOWS) {
  const errors = [];
  for (const file of files) {
    const rel = `.github/workflows/${file}`;
    let text;
    try {
      text = readFileSync(path.join(root, rel), "utf8");
    } catch {
      errors.push(`${rel}: missing (listed in CI_GATE_WORKFLOWS).`);
      continue;
    }
    for (const line of cancelInProgressTrueLines(text)) {
      errors.push(
        `${rel}:${line}: cancel-in-progress: true on a CI gate workflow; use \${{ github.event_name == 'pull_request' }}.`
      );
    }
    const group = topLevelConcurrencyGroup(text);
    if (group !== null && !/github\.sha/.test(group)) {
      errors.push(
        `${rel}: concurrency group "${group}" is shared across pushes to main; make it per commit on push (include github.sha) so a newer push can't cancel a pending run.`
      );
    }
  }
  return errors;
}

function main() {
  const errors = [
    ...checkWorkersDev(),
    ...checkCancelInProgress(),
    ...checkCiGateWorkflows(),
  ];
  if (errors.length) {
    for (const e of errors) console.error(`::error::${e}`);
    console.error(`Deploy invariants: ${errors.length} problem(s).`);
    process.exit(1);
  }
  console.log(
    `Deploy invariants OK: workers_dev = false on ${WORKERS_DEV_OFF.map(t => t.name).join(", ")}; no push-to-main deploy workflow cancels in progress; CI gate (${CI_GATE_WORKFLOWS.join(", ")}) is per-commit on main.`
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
