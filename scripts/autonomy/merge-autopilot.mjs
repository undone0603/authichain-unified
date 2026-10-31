#!/usr/bin/env node
// scripts/autonomy/merge-autopilot.mjs
//
// Merge autopilot. Sweeps open PRs into main and, for each one from a trusted
// author, does exactly one thing per run:
//
//   update   the branch is behind main -> merge main into it (GitHub's
//            update-branch, a merge commit, never a rebase) so CI re-runs on
//            the up-to-date tree. A hold label still gets this update.
//   merge    up to date, mergeable_state clean, and every check run and
//            commit status on the head is green -> squash-merge, pinned to
//            the head SHA that was checked. A hold is never merged.
//   conflict the branch conflicts with main -> label `merge-conflict` and
//            leave it for a human or an agent to resolve
//   wait / skip  anything else (draft with no hold label, fork, untrusted
//            author, a hold that is already up to date, checks pending or
//            red, GitHub still computing mergeability)
//
// Owner decision 2026-10-02 made every trusted PR eligible; the owner narrowed
// it on 2026-10-13: a PR that touches RESTRICTED_PATHS, or whose changed code
// lines mention RESTRICTED_SYMBOLS, is skipped and waits for the owner to merge
// it by hand (docs/OPERATING_CHARTER.md, "Merge autopilot"). The lists live in
// this file, which is itself restricted, so no PR can loosen them unattended.
// The switch is `merge_autopilot` in .github/autonomy.json.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, AUTOPILOT_TOKEN_KIND (pat|default),
//      DRY_RUN=1 to log decisions without acting.
// Output: the run summary (markdown) on stdout, progress on stderr.
//
// Token: with the default Actions token, GitHub does not start workflows for
// the commits it creates. A merge would not trigger the push-to-main deploys,
// and an update-branch commit would never get CI. So in "default" mode the
// autopilot never merges or updates branches and says so in the
// summary. Give it a PAT as MERGE_AUTOPILOT_TOKEN for the full loop.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GREEN = new Set(["success", "neutral", "skipped"]);
// Require positive CI evidence even when main requires zero human reviews.
// A skipped gate or a check with the same name from another app is not proof.
export const REQUIRED_CHECKS = ["Main quality gate"];

// Fixed here, not read from the manifest: every value that reaches a GitHub
// API URL or request body is a constant or comes from GitHub itself.
export const BASE_BRANCH = "main";
export const MERGE_METHOD = "squash";
export const CONFLICT_LABEL = "merge-conflict";

// Payment trust, paid fulfilment, outbound-send gating, secrets, migrations,
// deploys and the autonomy controls themselves. `*` stays inside one path
// segment, `**` crosses segments.
export const RESTRICTED_PATHS = [
  ".github/autonomy.json",
  ".github/CODEOWNERS",
  ".github/workflows/merge-autopilot.yml",
  ".github/workflows/autonomy-reconcile.yml",
  ".github/workflows/deploy-*.yml",
  ".github/workflows/bind-*.yml",
  ".github/workflows/set-*.yml",
  ".github/workflows/*outreach*.yml",
  ".github/workflows/stripe-webhook-reconcile.yml",
  "scripts/autonomy/**",
  "config/launch-gates.json",
  "docs/OPERATING_CHARTER.md",
  "CLAUDE.md",
  "src/lib/plans.ts",
  "src/lib/x402.ts",
  "src/lib/stripe-*.ts",
  "src/lib/dpp-fulfill*.ts",
  "src/app/api/stripe/webhook/**",
  "src/app/api/webhook/**",
  "src/app/api/webhooks/stripe/**",
  "server/webhooks/**",
  "server/subscriptions-rest.ts",
  "server/outreach/**",
  "scripts/outreach-optout-check.ts",
  "scripts/lib/b2b-send-policy.ts",
  "**/stripe/webhook/**",
  "**/webhooks/stripe/**",
  "**/stripe-webhook/**",
  "workers/dpp-fulfillment/**",
  "workers/authichain-license-issuer/**",
  "workers/*outreach*/**",
  "workers/resend-relay/**",
  "agentz/api/billing_webhook.py",
  "supabase/migrations/**",
  "drizzle/**",
];

// Webhook verification and fulfilment calls live inside the big router files
// (worker-app/index.ts, worker/index.ts), which nearly every PR touches, so
// those are matched by what the diff changes rather than by path.
export const RESTRICTED_SYMBOLS =
  /fulfillDppPaidSession|constructEvent|stripe-signature|STRIPE_WEBHOOK_SECRET|OWNER_LIVE_SEND|guardedSend|cold_outreach|launch_mode|merge_autopilot|MERGE_AUTOPILOT_TOKEN/i;

const CODE_FILE = /\.(m?[jt]sx?|cjs|py|json|ya?ml|toml|sql|sh)$/;
// GitHub omits the patch for huge lockfile diffs; they hold no call sites.
const LOCKFILE =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|poetry\.lock)$/;

const globToRegExp = glob =>
  new RegExp(
    "^" +
      glob
        .split("**")
        .map(part =>
          part
            .split("*")
            .map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
            .join("[^/]*")
        )
        .join(".*") +
      "$"
  );
const RESTRICTED_RES = RESTRICTED_PATHS.map(globToRegExp);

/**
 * Pure. Why a PR must wait for the owner, or null if it may auto-merge.
 * Fails closed: an incomplete file list or an unreadable code diff is restricted.
 * @param files        GET /pulls/{n}/files (all pages)
 * @param changedFiles pr.changed_files
 */
export function restrictedChange(files, changedFiles) {
  if (!Array.isArray(files)) return "changed files unavailable";
  if (files.length !== changedFiles)
    return `file list incomplete (${files.length} of ${changedFiles})`;
  for (const f of files) {
    for (const name of [f.filename, f.previous_filename].filter(Boolean)) {
      if (RESTRICTED_RES.some(re => re.test(name)))
        return `restricted path ${name}`;
    }
    if (!CODE_FILE.test(f.filename) || LOCKFILE.test(f.filename)) continue;
    if (typeof f.patch !== "string") return `diff not readable: ${f.filename}`;
    const changed = f.patch
      .split("\n")
      .filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
    const hit = changed.map(l => l.match(RESTRICTED_SYMBOLS)).find(Boolean);
    if (hit) return `changes ${hit[0]} in ${f.filename}`;
  }
  return null;
}

/** Pure. Read and default the manifest block. */
export function loadConfig(manifest) {
  const c = manifest.merge_autopilot ?? {};
  return {
    enabled: c.enabled === true,
    baseBranch: BASE_BRANCH,
    trustedAuthors: (c.trusted_authors ?? [manifest.owner]).map(a =>
      String(a).toLowerCase()
    ),
    holdLabels: c.hold_labels ?? ["hold", "do-not-merge"],
    conflictLabel: CONFLICT_LABEL,
    mergeMethod: MERGE_METHOD,
    ignoreChecks: c.ignore_checks ?? ["Merge autopilot"],
  };
}

const labelNames = pr =>
  (pr.labels ?? []).map(l => (typeof l === "string" ? l : l.name));

/**
 * Pure. Decide what to do with one PR.
 * @param pr        GET /pulls/{n}
 * @param checkRuns GET /commits/{sha}/check-runs -> check_runs
 * @param status    GET /commits/{sha}/status -> {state, total_count}
 * @param behindBy  GET /compare/{base}...{sha} -> behind_by
 * @param cfg       loadConfig()
 * @param opts      {canUpdate}
 * @returns {{action: "merge"|"update"|"conflict"|"wait"|"skip", reason: string}}
 */
export function decide(pr, checkRuns, status, behindBy, cfg, opts = {}) {
  const { canUpdate = true } = opts;
  if (pr.state && pr.state !== "open")
    return { action: "skip", reason: "not open" };
  if (pr.base?.ref !== cfg.baseBranch)
    return { action: "skip", reason: `base is ${pr.base?.ref}` };
  if (pr.head?.repo?.full_name !== pr.base?.repo?.full_name)
    return { action: "skip", reason: "fork" };
  const author = pr.user?.login?.toLowerCase();
  if (!cfg.trustedAuthors.includes(author))
    return { action: "skip", reason: `author ${pr.user?.login} not trusted` };
  const hold = labelNames(pr).find(l => cfg.holdLabels.includes(l));
  // A hold never merges. It still takes main when behind, including a draft.
  if (hold) {
    if (pr.mergeable_state === "dirty" || pr.mergeable === false)
      return { action: "conflict", reason: "conflicts with base" };
    if (pr.mergeable === null || pr.mergeable_state === "unknown")
      return { action: "wait", reason: "mergeability not computed yet" };
    if (behindBy > 0) {
      return canUpdate
        ? {
            action: "update",
            reason: `${behindBy} commit(s) behind ${cfg.baseBranch}; label ${hold} blocks merge`,
          }
        : {
            action: "wait",
            reason: `label ${hold}; behind ${cfg.baseBranch}; no PAT to update`,
          };
    }
    return { action: "skip", reason: `label ${hold}` };
  }
  if (pr.draft) return { action: "skip", reason: "draft" };

  if (pr.mergeable_state === "dirty" || pr.mergeable === false)
    return { action: "conflict", reason: "conflicts with base" };
  if (pr.mergeable === null || pr.mergeable_state === "unknown")
    return { action: "wait", reason: "mergeability not computed yet" };

  if (behindBy > 0) {
    return canUpdate
      ? {
          action: "update",
          reason: `${behindBy} commit(s) behind ${cfg.baseBranch}`,
        }
      : {
          action: "wait",
          reason: `behind ${cfg.baseBranch}; no PAT to update`,
        };
  }

  const runs = checkRuns.filter(r => !cfg.ignoreChecks.includes(r.name));
  if (runs.length === 0)
    return { action: "wait", reason: "no checks reported yet" };
  for (const name of REQUIRED_CHECKS) {
    const evidence = runs.filter(
      r => r.name === name && r.app?.slug === "github-actions"
    );
    if (
      evidence.length === 0 ||
      evidence.some(
        r =>
          r.head_sha !== pr.head.sha ||
          r.status !== "completed" ||
          r.conclusion !== "success"
      )
    ) {
      return {
        action: "wait",
        reason: `required check not successful: ${name}`,
      };
    }
  }
  const pending = runs.find(r => r.status !== "completed");
  if (pending) return { action: "wait", reason: `pending: ${pending.name}` };
  const red = runs.find(r => !GREEN.has(r.conclusion));
  if (red)
    return { action: "wait", reason: `red: ${red.name} (${red.conclusion})` };
  if (status.total_count > 0 && status.state !== "success")
    return { action: "wait", reason: `commit status ${status.state}` };

  // "clean" is the only state where GitHub itself says the merge will go
  // through. "blocked" (required review), "unstable" and "has_hooks" wait.
  if (pr.mergeable_state !== "clean")
    return { action: "wait", reason: `mergeable_state ${pr.mergeable_state}` };
  if (!canUpdate)
    return {
      action: "wait",
      reason: "no PAT: a merge would not trigger deployment workflows",
    };

  return { action: "merge", reason: "green, clean, up to date" };
}

export function isGitHubRateLimit(status, body) {
  if (status !== 403 && status !== 429) return false;
  const text = String(body).toLowerCase();
  return text.includes("rate limit") || text.includes("secondary rate");
}

export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "RateLimitError";
  }
}

const GH_HEADERS = token => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "authichain-merge-autopilot",
});

async function gh(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      ...GH_HEADERS(token),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    if (isGitHubRateLimit(res.status, text))
      throw new RateLimitError(`${method} ${path} -> ${res.status} rate limit`);
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

// /rate_limit does not spend the core budget. A sweep that starts with
// almost nothing left 403s on the PR list and keeps the installation red.
async function coreRemaining(token) {
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: GH_HEADERS(token),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const n = data?.resources?.core?.remaining;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// GitHub caps this endpoint at 3000 files; restrictedChange() treats a
// shorter list than pr.changed_files as restricted.
async function listFiles(repo, n, token) {
  const files = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await gh(
      `/repos/${repo}/pulls/${n}/files?per_page=100&page=${page}`,
      { token }
    );
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

// Read every latest check, including red/pending results beyond the first
// page. An incomplete response must never become permission to merge.
export async function listCheckRuns(repo, sha, token, request = gh) {
  const checks = [];
  for (let page = 1; page <= 10; page++) {
    const result = await request(
      `/repos/${repo}/commits/${sha}/check-runs?filter=latest&per_page=100&page=${page}`,
      { token }
    );
    if (!Array.isArray(result.check_runs))
      throw new Error(
        "Check runs unavailable; refusing incomplete CI evidence"
      );
    checks.push(...result.check_runs);
    if (result.check_runs.length < 100) return checks;
  }
  throw new Error(
    "Check run pagination limit reached; refusing incomplete CI evidence"
  );
}

async function main() {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), ".github/autonomy.json"), "utf8")
  );
  const cfg = loadConfig(manifest);
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const dry = process.env.DRY_RUN === "1";
  const canUpdate = process.env.AUTOPILOT_TOKEN_KIND === "pat";
  const lines = ["## Merge autopilot", ""];

  if (!cfg.enabled) {
    lines.push(
      "`merge_autopilot.enabled` is false in `.github/autonomy.json`. Nothing done."
    );
    return finish(lines);
  }
  if (!token || !repo)
    throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  if (!canUpdate)
    lines.push(
      "> Running on the default Actions token. Merges and branch updates wait because they would not trigger downstream workflows. Add a `MERGE_AUTOPILOT_TOKEN` secret (fine-grained PAT: contents + pull requests read/write on this repo).",
      ""
    );

  const remaining = await coreRemaining(token);
  if (remaining !== null && remaining < 25) {
    lines.push(
      `Stopped: GitHub core rate limit has ${remaining} requests left. The next sweep retries.`
    );
    return finish(lines);
  }

  let prs;
  try {
    prs = await gh(
      `/repos/${repo}/pulls?state=open&base=${BASE_BRANCH}&per_page=100`,
      { token }
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      lines.push("Stopped: GitHub rate limit. The next sweep retries.");
      return finish(lines);
    }
    throw err;
  }
  lines.push("| PR | Action | Why |", "| --- | --- | --- |");

  for (const listed of prs) {
    const n = listed.number;
    let decision;
    try {
      const pr = await gh(`/repos/${repo}/pulls/${n}`, { token });
      const sha = pr.head.sha;
      const [checks, status, cmp] = await Promise.all([
        listCheckRuns(repo, sha, token),
        gh(`/repos/${repo}/commits/${sha}/status`, { token }),
        gh(`/repos/${repo}/compare/${BASE_BRANCH}...${sha}`, { token }),
      ]);
      decision = decide(pr, checks, status, cmp.behind_by, cfg, {
        canUpdate,
      });
      if (decision.action === "merge") {
        const files = await listFiles(repo, n, token);
        const why = restrictedChange(files, pr.changed_files);
        if (why) decision = { action: "skip", reason: `owner merges: ${why}` };
      }

      const labels = labelNames(pr);
      if (
        !dry &&
        decision.action === "conflict" &&
        !labels.includes(cfg.conflictLabel)
      )
        await gh(`/repos/${repo}/issues/${n}/labels`, {
          method: "POST",
          token,
          body: { labels: [CONFLICT_LABEL] },
        });
      if (
        !dry &&
        decision.action !== "conflict" &&
        labels.includes(cfg.conflictLabel)
      )
        await gh(`/repos/${repo}/issues/${n}/labels/${CONFLICT_LABEL}`, {
          method: "DELETE",
          token,
        });

      if (!dry && decision.action === "update")
        await gh(`/repos/${repo}/pulls/${n}/update-branch`, {
          method: "PUT",
          token,
          body: { expected_head_sha: sha },
        });
      if (!dry && decision.action === "merge")
        await gh(`/repos/${repo}/pulls/${n}/merge`, {
          method: "PUT",
          token,
          body: { merge_method: MERGE_METHOD, sha },
        });
    } catch (err) {
      if (err instanceof RateLimitError) {
        lines.push(
          `| #${n} | stopped | GitHub rate limit |`,
          "",
          "Stopped: GitHub rate limit. The next sweep retries."
        );
        return finish(lines);
      }
      // One PR failing (a race with a new push, a 405 from a branch rule)
      // must not stop the sweep; the next run retries.
      decision = { action: "error", reason: String(err.message).slice(0, 200) };
    }
    lines.push(
      `| #${n} | ${dry ? "(dry) " : ""}${decision.action} | ${cell(decision.reason)} |`
    );
    console.error(`#${n}: ${decision.action} - ${decision.reason}`);
  }
  if (prs.length === 0) lines.push("| - | - | no open PRs |");
  finish(lines);
}

/** Pure. Keep API text (check names, error bodies) inside one table cell. */
export const cell = text =>
  String(text)
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\|]/g, ch => `\\${ch}`);

// The summary goes to stdout only; the workflow appends it to the job
// summary. Per-PR progress lines go to stderr.
function finish(lines) {
  process.stdout.write(lines.join("\n") + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
