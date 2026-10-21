#!/usr/bin/env node
// scripts/autonomy/launch-gates.mjs
//
// Launch gates as code (tracking issue #1987 on the GitLab mirror).
// Reads config/launch-gates.json, collects evidence, and decides every gate
// without a human approval. The founder is the override (kill_switch), not
// the approver.
//
// FAIL CLOSED: a gate passes only with positive evidence. Missing, empty or
// malformed evidence, a skipped job, a job with no executed steps, a
// collector error, or an unimplemented (`pending`) gate all FAIL. This is the
// regression for the "empty steps" CI failure mode (jobs reporting no steps
// must never count as a pass).
//
// CLI: node scripts/autonomy/launch-gates.mjs
//   env: GITHUB_TOKEN, GITHUB_REPOSITORY (optional, falls back to manifest)
//        LAUNCH_GATES_DRY_RUN=true   print only; do not open/close issues
//        LAUNCH_GATES_STRICT=true    exit 1 if any gate fails
//   writes launch-gates-report.json and a Markdown digest to
//   $GITHUB_STEP_SUMMARY. Opens ONE issue per failing gate (label
//   `launch-gate`) and closes it when the gate passes again.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MANIFEST_PATH = join(ROOT, "config", "launch-gates.json");
export const ISSUE_LABEL = "launch-gate";
export const GATE_TYPES = ["github_ci", "http_probe", "pending"];

const PASS = "pass";
const FAIL = "fail";
const failed = (reasons, evidence = {}) => ({
  status: FAIL,
  reasons: Array.isArray(reasons) ? reasons : [reasons],
  evidence,
});
const passed = (evidence = {}) => ({ status: PASS, reasons: [], evidence });

/** Pure. Manifest errors (empty array when valid). */
export function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== "object") return ["manifest must be an object"];
  if (m.version !== 1) errors.push("version must be 1");
  if (typeof m.kill_switch !== "boolean")
    errors.push("kill_switch must be true or false");
  if (!Array.isArray(m.gates) || m.gates.length === 0) {
    errors.push("gates must be a non-empty array");
    return errors;
  }
  const seen = new Set();
  for (const g of m.gates) {
    const id = g?.id;
    if (typeof id !== "string" || id === "") {
      errors.push("every gate needs a string id");
      continue;
    }
    if (seen.has(id)) errors.push(`duplicate gate id: ${id}`);
    seen.add(id);
    if (typeof g.title !== "string" || g.title === "")
      errors.push(`${id}: title required`);
    if (!GATE_TYPES.includes(g.type))
      errors.push(`${id}: unknown type ${String(g.type)}`);
    if (g.type === "github_ci") {
      if (!Array.isArray(g.workflows) || g.workflows.length === 0)
        errors.push(`${id}: workflows must be a non-empty array`);
    }
    if (g.type === "http_probe") {
      if (!Array.isArray(g.probes) || g.probes.length === 0)
        errors.push(`${id}: probes must be a non-empty array`);
      for (const p of g.probes ?? []) {
        if (typeof p?.url !== "string" || !p.url.startsWith("https://"))
          errors.push(`${id}: probe url must start with https://`);
        if (!Number.isInteger(p?.expect_status))
          errors.push(`${id}: probe expect_status must be an integer`);
        if (!(p?.max_ms > 0)) errors.push(`${id}: probe max_ms must be > 0`);
      }
    }
  }
  return errors;
}

/**
 * Pure. `entries` = [{ workflow, run, jobs }] where run is the latest completed
 * run (or null) and jobs the GitHub jobs payload entries.
 */
export function evaluateCiEvidence(entries, { allowSkippedJobs = false } = {}) {
  if (!Array.isArray(entries) || entries.length === 0)
    return failed("no CI evidence collected");
  const reasons = [];
  const summary = [];
  for (const e of entries) {
    const wf = e?.workflow ?? "(unknown workflow)";
    const run = e?.run;
    if (!run) {
      reasons.push(`${wf}: no completed run found`);
      continue;
    }
    if (run.conclusion !== "success")
      reasons.push(`${wf}: latest run concluded ${String(run.conclusion)}`);
    const jobs = Array.isArray(e.jobs) ? e.jobs : [];
    if (jobs.length === 0) reasons.push(`${wf}: run has no jobs`);
    for (const job of jobs) {
      const name = `${wf} / ${job?.name ?? "(job)"}`;
      const steps = Array.isArray(job?.steps) ? job.steps : [];
      if (steps.length === 0) {
        reasons.push(`${name}: empty steps (job never executed)`);
        continue;
      }
      const executed = steps.filter(
        (s) => s?.conclusion === "success" || s?.conclusion === "failure"
      );
      if (executed.length === 0) {
        reasons.push(`${name}: no step executed`);
        continue;
      }
      if (job.conclusion === "skipped" && allowSkippedJobs) continue;
      if (job.conclusion !== "success")
        reasons.push(`${name}: job concluded ${String(job.conclusion)}`);
    }
    summary.push({ workflow: wf, run_id: run.id ?? null, sha: run.head_sha ?? null });
  }
  return reasons.length ? failed(reasons, { runs: summary }) : passed({ runs: summary });
}

/** Pure. `results` = [{ url, status, location, ms, error }] aligned to `probes`. */
export function evaluateProbes(results, probes, forbidRedirectHost) {
  if (!Array.isArray(results) || results.length === 0)
    return failed("no probe evidence collected");
  const reasons = [];
  for (const p of probes) {
    const r = results.find((x) => x?.url === p.url);
    if (!r) {
      reasons.push(`${p.url}: no result`);
      continue;
    }
    if (r.error) {
      reasons.push(`${p.url}: ${r.error}`);
      continue;
    }
    if (
      forbidRedirectHost &&
      typeof r.location === "string" &&
      r.location.toLowerCase().includes(forbidRedirectHost)
    ) {
      reasons.push(`${p.url}: redirects to ${forbidRedirectHost}`);
      continue;
    }
    if (r.status !== p.expect_status)
      reasons.push(`${p.url}: got ${r.status}, expected ${p.expect_status}`);
    if (!(r.ms <= p.max_ms))
      reasons.push(`${p.url}: ${r.ms}ms over ${p.max_ms}ms budget`);
  }
  return reasons.length ? failed(reasons, { results }) : passed({ results });
}

/** Pure. Decide one gate from its evidence. Anything unexpected FAILS. */
export function evaluateGate(gate, evidence) {
  try {
    if (gate.type === "pending")
      return failed(`not implemented yet (${gate.ref ?? "no ref"})`);
    if (evidence === undefined || evidence === null)
      return failed("no evidence collected");
    if (evidence.error) return failed(`collector error: ${evidence.error}`);
    if (gate.type === "github_ci")
      return evaluateCiEvidence(evidence.entries, {
        allowSkippedJobs: gate.allow_skipped_jobs === true,
      });
    if (gate.type === "http_probe")
      return evaluateProbes(
        evidence.results,
        gate.probes,
        gate.forbid_redirect_host
      );
    return failed(`unknown gate type ${String(gate.type)}`);
  } catch (err) {
    return failed(`evaluator error: ${err?.message ?? err}`);
  }
}

/** Pure. Evaluate the whole manifest. kill_switch stands everything down. */
export function evaluateAll(manifest, evidenceById = {}, now = new Date()) {
  const errors = validateManifest(manifest);
  if (errors.length)
    return { state: "invalid_manifest", errors, gates: [], checked_at: now.toISOString() };
  if (manifest.kill_switch === true)
    return { state: "stood_down", gates: [], checked_at: now.toISOString() };
  const gates = manifest.gates.map((g) => ({
    id: g.id,
    title: g.title,
    ref: g.ref ?? null,
    ...evaluateGate(g, evidenceById[g.id]),
  }));
  const allPass = gates.every((g) => g.status === PASS);
  return {
    state: allPass ? "pass" : "fail",
    gates,
    checked_at: now.toISOString(),
  };
}

/** Pure. Markdown digest for the step summary. */
export function renderSummary(report) {
  const lines = [`### Launch gates: ${report.state}`, ""];
  if (report.state === "stood_down") {
    lines.push("kill_switch is on. No probes were run and no issues were changed.");
    return lines.join("\n");
  }
  if (report.state === "invalid_manifest") {
    lines.push(...report.errors.map((e) => `- ${e}`));
    return lines.join("\n");
  }
  const ok = report.gates.filter((g) => g.status === PASS).length;
  lines.push(`${ok}/${report.gates.length} gates passing at ${report.checked_at}`, "");
  for (const g of report.gates) {
    lines.push(`- ${g.status === PASS ? "PASS" : "FAIL"} ${g.id}: ${g.title}`);
    for (const r of g.reasons) lines.push(`  - ${r}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- collectors

async function gh(path, env, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "authichain-launch-gates",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return res.status === 204 ? {} : res.json();
}

async function collectCi(gate, manifest, env) {
  const repo = env.GITHUB_REPOSITORY || manifest.repo;
  const branch = manifest.default_branch || "main";
  const entries = [];
  for (const wf of gate.workflows) {
    const runs = await gh(
      `/repos/${repo}/actions/workflows/${encodeURIComponent(wf)}/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=1`,
      env
    );
    const run = runs?.workflow_runs?.[0] ?? null;
    const jobs = run
      ? ((await gh(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`, env))?.jobs ?? [])
      : [];
    entries.push({ workflow: wf, run, jobs });
  }
  return { entries };
}

async function probeOne(p) {
  const t0 = Date.now();
  try {
    const res = await fetch(p.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "authichain-launch-gates/1.0" },
    });
    return {
      url: p.url,
      status: res.status,
      location: res.headers.get("location"),
      ms: Date.now() - t0,
    };
  } catch (err) {
    return { url: p.url, error: err?.message ?? String(err), ms: Date.now() - t0 };
  }
}

async function collect(gate, manifest, env) {
  if (gate.type === "github_ci") return collectCi(gate, manifest, env);
  if (gate.type === "http_probe")
    return { results: await Promise.all(gate.probes.map(probeOne)) };
  return undefined;
}

// --------------------------------------------------------------- issue sync

const issueTitle = (id) => `Launch gate failing: ${id}`;

async function syncIssues(report, manifest, env, dryRun) {
  const repo = env.GITHUB_REPOSITORY || manifest.repo;
  const open = (await gh(
    `/repos/${repo}/issues?labels=${ISSUE_LABEL}&state=open&per_page=100`,
    env
  )) ?? [];
  const byTitle = new Map(open.map((i) => [i.title, i]));
  for (const g of report.gates) {
    const existing = byTitle.get(issueTitle(g.id));
    if (g.status === FAIL && !existing) {
      const body = [
        `Gate **${g.id}** is failing: ${g.title}`,
        "",
        ...g.reasons.map((r) => `- ${r}`),
        "",
        g.ref ? `Tracking: ${g.ref}` : "",
        "",
        "This issue closes itself when the gate passes. Stop all gates with `kill_switch` in config/launch-gates.json.",
      ].join("\n");
      console.log(`open issue: ${issueTitle(g.id)}`);
      if (!dryRun)
        await gh(`/repos/${repo}/issues`, env, {
          method: "POST",
          body: JSON.stringify({ title: issueTitle(g.id), body, labels: [ISSUE_LABEL] }),
        });
    } else if (g.status === PASS && existing) {
      console.log(`close issue: ${issueTitle(g.id)}`);
      if (!dryRun) {
        await gh(`/repos/${repo}/issues/${existing.number}/comments`, env, {
          method: "POST",
          body: JSON.stringify({ body: "Gate passing again. Closing." }),
        });
        await gh(`/repos/${repo}/issues/${existing.number}`, env, {
          method: "PATCH",
          body: JSON.stringify({ state: "closed", state_reason: "completed" }),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------- CLI

export async function main(env = process.env) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const dryRun = env.LAUNCH_GATES_DRY_RUN === "true";
  const strict = env.LAUNCH_GATES_STRICT === "true";
  const errors = validateManifest(manifest);
  let report;
  if (errors.length || manifest.kill_switch === true) {
    report = evaluateAll(manifest);
  } else {
    const evidence = {};
    for (const g of manifest.gates) {
      try {
        evidence[g.id] = await collect(g, manifest, env);
      } catch (err) {
        evidence[g.id] = { error: err?.message ?? String(err) };
      }
    }
    report = evaluateAll(manifest, evidence);
  }
  const summary = renderSummary(report);
  console.log(summary);
  writeFileSync("launch-gates-report.json", JSON.stringify(report, null, 2));
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (report.state !== "stood_down" && report.state !== "invalid_manifest" && env.GITHUB_TOKEN)
    await syncIssues(report, manifest, env, dryRun);
  if (report.state === "invalid_manifest") return 1;
  return strict && report.state === "fail" ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      // Fail closed on any unexpected error.
      console.error(err);
      process.exit(1);
    }
  );
}
