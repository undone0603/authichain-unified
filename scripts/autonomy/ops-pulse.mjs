#!/usr/bin/env node
// scripts/autonomy/ops-pulse.mjs
//
// Loop 1 heartbeat. Read-only checks, one alert issue:
//   - public sites and money-path endpoints answer as expected
//   - every managed "on" workflow is enabled on GitHub and its latest run is not failing
//
// When anything is red, opens (or updates) a single issue labelled `ops-alert`.
// When everything is green again, comments and closes it. GitHub notifies the
// owner by email / mobile, so silence means healthy.
//
// Env: GITHUB_TOKEN (issues:write, actions:read), GITHUB_REPOSITORY,
//      PULSE_DRY_RUN=true to print instead of touching issues.

import { appendFileSync } from "node:fs";
import { loadManifest, flatten } from "./reconcile.mjs";

export const PROBES = [
  { name: "authichain.com", url: "https://authichain.com/", expect: [200] },
  {
    name: "authichain.com pricing",
    url: "https://authichain.com/pricing",
    expect: [200],
  },
  {
    name: "authichain.com API health",
    url: "https://authichain.com/api/health",
    expect: [200],
  },
  {
    name: "authichain.com real 404",
    url: "https://authichain.com/__pulse_missing__",
    expect: [404],
  },
  { name: "qron.space", url: "https://qron.space/", expect: [200] },
  { name: "strainchain.io", url: "https://strainchain.io/", expect: [200] },
  { name: "govchain.us", url: "https://govchain.us/", expect: [200] },
  {
    name: "govchain.us opportunities",
    url: "https://govchain.us/opportunities",
    expect: [200],
  },
];

const MARKER = "<!-- ops-pulse-signature:";

/** Probes each URL; a failure is retried once after retryDelayMs so a single blip never pages anyone. */
export async function runProbes(
  probes = PROBES,
  { fetchImpl = fetch, timeoutMs = 15_000, retryDelayMs = 5_000 } = {}
) {
  const first = await probeAll(probes, { fetchImpl, timeoutMs });
  const failed = first.filter(r => !r.ok);
  if (!failed.length) return first;
  await new Promise(r => setTimeout(r, retryDelayMs));
  const retried = new Map(
    (await probeAll(failed, { fetchImpl, timeoutMs })).map(r => [r.url, r])
  );
  return first.map(r => retried.get(r.url) ?? r);
}

async function probeAll(probes, { fetchImpl, timeoutMs }) {
  return Promise.all(
    probes.map(async p => {
      const t0 = Date.now();
      try {
        const res = await fetchImpl(p.url, {
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        const ok = p.expect.includes(res.status);
        return { ...p, status: res.status, ms: Date.now() - t0, ok };
      } catch (e) {
        return {
          ...p,
          status: 0,
          ms: Date.now() - t0,
          ok: false,
          error: String(e.message ?? e),
        };
      }
    })
  );
}

/**
 * Pure. manifestRows: flatten(manifest). remote: [{id,path,state}].
 * latestRuns: Map(file -> {conclusion, html_url, created_at}) for runs on the default branch.
 */
export function evaluateWorkflows(manifestRows, remote, latestRuns) {
  const byFile = new Map(remote.map(w => [w.path.split("/").pop(), w]));
  const problems = [];
  for (const r of manifestRows) {
    if (!r.managed || r.desired !== "on" || r.lane === "ship") continue;
    const w = byFile.get(r.file);
    if (w && w.state !== "active") {
      problems.push({
        file: r.file,
        lane: r.lane,
        kind: "disabled",
        detail: `should be on, GitHub says ${w.state}`,
      });
      continue;
    }
    const run = latestRuns.get(r.file);
    if (
      run &&
      ["failure", "timed_out", "startup_failure"].includes(run.conclusion)
    ) {
      problems.push({
        file: r.file,
        lane: r.lane,
        kind: "failing",
        detail: `last run ${run.conclusion}`,
        url: run.html_url,
      });
    }
  }
  return problems;
}

export function signature(report) {
  const keys = [
    ...report.probes.filter(p => !p.ok).map(p => `probe:${p.name}`),
    ...report.workflows.map(w => `wf:${w.file}:${w.kind}`),
  ].sort();
  return keys.join("|");
}

export function renderReport(report) {
  const bad = report.probes.filter(p => !p.ok);
  const lines = [];
  lines.push(`**Checked:** ${report.at}`);
  if (bad.length) {
    lines.push("", "#### Sites and endpoints");
    for (const p of bad)
      lines.push(
        `- ${p.name}: got ${p.status || "no response"}, expected ${p.expect.join("/")} (${p.url})${p.error ? ` - ${p.error}` : ""}`
      );
  }
  if (report.workflows.length) {
    lines.push("", "#### Loops");
    for (const w of report.workflows)
      lines.push(
        `- \`${w.file}\` (${w.lane}): ${w.detail}${w.url ? ` - [run](${w.url})` : ""}`
      );
  }
  lines.push(
    "",
    "Fix the cause, or turn the loop off in `.github/autonomy.json`. This issue closes itself when the next pulse is green."
  );
  return lines.join("\n");
}

/**
 * Pure. Decide what to do with the alert issue.
 * existing: {number, body} | null. Returns {action: none|create|update|close, body?}
 */
export function decideIssueAction(existing, report) {
  const sig = signature(report);
  const red = sig.length > 0;
  if (!red)
    return existing
      ? { action: "close", body: `All green at ${report.at}. Closing.` }
      : { action: "none" };
  const body = `${renderReport(report)}\n\n${MARKER}${sig} -->`;
  if (!existing) return { action: "create", body };
  const prev = (existing.body ?? "").split(MARKER)[1]?.split(" -->")[0] ?? "";
  return prev === sig ? { action: "none" } : { action: "update", body };
}

async function gh(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "authichain-ops-pulse",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(
      `${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  return res.status === 204 ? null : res.json();
}

async function latestRunsFor(repo, token, files) {
  const map = new Map();
  await Promise.all(
    files.map(async f => {
      try {
        const d = await gh(
          `/repos/${repo}/actions/workflows/${f}/runs?branch=main&status=completed&per_page=1`,
          { token }
        );
        const r = d.workflow_runs?.[0];
        if (r)
          map.set(f, {
            conclusion: r.conclusion,
            html_url: r.html_url,
            created_at: r.created_at,
          });
      } catch {
        /* workflow not registered yet */
      }
    })
  );
  return map;
}

function out(md) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const dry = process.env.PULSE_DRY_RUN === "true" || !token;
  const manifest = loadManifest();
  const rows = flatten(manifest);
  const report = {
    at: new Date().toISOString(),
    probes: await runProbes(),
    workflows: [],
  };

  if (token && repo) {
    const remote = (
      await gh(`/repos/${repo}/actions/workflows?per_page=100`, { token })
    ).workflows;
    const files = rows
      .filter(r => r.managed && r.desired === "on" && r.lane !== "ship")
      .map(r => r.file);
    report.workflows = evaluateWorkflows(
      rows,
      remote,
      await latestRunsFor(repo, token, files)
    );
  }

  const sig = signature(report);
  out(
    `### Ops pulse: ${sig ? "RED" : "green"}\n\n${report.probes.map(p => `- ${p.ok ? "ok" : "FAIL"} ${p.name} ${p.status} ${p.ms}ms`).join("\n")}\n\nLoop problems: ${report.workflows.length}`
  );

  if (dry) {
    console.log("PULSE_DRY_RUN or no token: not touching issues.");
    console.log(JSON.stringify(decideIssueAction(null, report)));
    return;
  }

  const label = manifest.alerts?.label ?? "ops-alert";
  const title = manifest.alerts?.issue_title ?? "Ops alert";
  await gh(`/repos/${repo}/labels`, {
    method: "POST",
    token,
    body: { name: label, color: "d93f0b" },
  }).catch(() => {});
  const open = await gh(
    `/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=5`,
    { token }
  );
  const existing = open.find(i => i.title === title) ?? null;
  const d = decideIssueAction(existing, report);
  if (d.action === "create")
    await gh(`/repos/${repo}/issues`, {
      method: "POST",
      token,
      body: { title, body: d.body, labels: [label] },
    });
  if (d.action === "update") {
    await gh(`/repos/${repo}/issues/${existing.number}`, {
      method: "PATCH",
      token,
      body: { body: d.body },
    });
    await gh(`/repos/${repo}/issues/${existing.number}/comments`, {
      method: "POST",
      token,
      body: { body: "Status changed:\n\n" + renderReport(report) },
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
  console.log(`alert issue: ${d.action}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
