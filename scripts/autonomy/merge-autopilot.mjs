#!/usr/bin/env node
// scripts/autonomy/merge-autopilot.mjs
//
// Merge autopilot. Sweeps open PRs into main and, for each one from a trusted
// author, does exactly one thing per run:
//
//   update   the branch is behind main -> merge main into it (GitHub's
//            update-branch, a merge commit, never a rebase) so CI re-runs on
//            the up-to-date tree
//   merge    up to date, mergeable_state clean, and every check run and
//            commit status on the head is green -> squash-merge, pinned to
//            the head SHA that was checked
//   conflict the branch conflicts with main -> label `merge-conflict` and
//            leave it for a human or an agent to resolve
//   wait / skip  anything else (draft, fork, untrusted author, hold label,
//            checks pending or red, GitHub still computing mergeability)
//
// Owner decision 2026-10-02: every trusted PR is eligible, including ones
// touching security, revenue, schema or the charter (docs/OPERATING_CHARTER.md,
// "Merge autopilot"). The switch is `merge_autopilot` in .github/autonomy.json.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, AUTOPILOT_TOKEN_KIND (pat|default),
//      DRY_RUN=1 to log decisions without acting.
// Output: the run summary (markdown) on stdout, progress on stderr.
//
// Token: with the default Actions token, GitHub does not start workflows for
// the commits it creates. A merge would not trigger the push-to-main deploys,
// and an update-branch commit would never get CI. So in "default" mode the
// autopilot never updates branches (behind PRs wait) and says so in the
// summary. Give it a PAT as MERGE_AUTOPILOT_TOKEN for the full loop.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GREEN = new Set(["success", "neutral", "skipped"]);

// Fixed here, not read from the manifest: every value that reaches a GitHub
// API URL or request body is a constant or comes from GitHub itself.
export const BASE_BRANCH = "main";
export const MERGE_METHOD = "squash";
export const CONFLICT_LABEL = "merge-conflict";

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
  if (pr.draft) return { action: "skip", reason: "draft" };
  if (pr.head?.repo?.full_name !== pr.base?.repo?.full_name)
    return { action: "skip", reason: "fork" };
  const author = pr.user?.login?.toLowerCase();
  if (!cfg.trustedAuthors.includes(author))
    return { action: "skip", reason: `author ${pr.user?.login} not trusted` };
  const hold = labelNames(pr).find(l => cfg.holdLabels.includes(l));
  if (hold) return { action: "skip", reason: `label ${hold}` };

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
      "> Running on the default Actions token. Behind branches are not updated, and merges made with it do not trigger push-to-main deploys. Add a `MERGE_AUTOPILOT_TOKEN` secret (fine-grained PAT: contents + pull requests read/write on this repo).",
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
        gh(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`, { token }),
        gh(`/repos/${repo}/commits/${sha}/status`, { token }),
        gh(`/repos/${repo}/compare/${BASE_BRANCH}...${sha}`, { token }),
      ]);
      decision = decide(pr, checks.check_runs, status, cmp.behind_by, cfg, {
        canUpdate,
      });

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
