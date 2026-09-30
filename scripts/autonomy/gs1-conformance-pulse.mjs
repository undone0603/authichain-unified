#!/usr/bin/env node
// Runs GS1's real hosted resolver test suite (ref.gs1.org/test-suites/resolver)
// against production, not our vendored copy of their spec -- catches drift
// between workers/gs1-resolver/src/vendor/gs1-dl-toolkit.mjs and the actual
// judge. Opens/closes the shared `ops-alert` issue on red; on green, commits
// the date and result to docs/GS1_CONFORMANCE.md. Never edits BANNED_COPY.
import { readFile, writeFile } from "node:fs/promises";

export const CANARY_DIGITAL_LINK =
  "https://id.authichain.com/01/09506000134352/21/GS1-CONFORMANCE-TEST";
const SUITE_URL = "https://ref.gs1.org/test-suites/resolver/";

export function parseSuiteResults(html) {
  const cells = [...html.matchAll(/background-color:\s*(#[0-9a-fA-F]{6})/g)].map(
    m => m[1].toLowerCase()
  );
  const GREEN = new Set(["#90ee90"]);
  const RED = new Set(["#ff7f7f"]);
  let green = 0,
    red = 0,
    neutral = 0;
  for (const c of cells) {
    if (GREEN.has(c)) green++;
    else if (RED.has(c)) red++;
    else neutral++;
  }
  return { green, red, neutral, healthy: red === 0 && neutral === 0 };
}

// playwright is loaded lazily, only when a real browser run is needed. The
// pure-logic tests above (parseSuiteResults, CANARY_DIGITAL_LINK) must not
// require it installed -- keeps `node --test` fast and dependency-free for
// local iteration; the scheduled workflow installs it for the real path.
async function runHostedSuite(digitalLink) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(SUITE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.fill('input[type="text"]', digitalLink);
    await page.click('button:has-text("Begin test"), input[value="Begin test"]');
    await page.waitForTimeout(4000);
    const html = await page.content();
    return parseSuiteResults(html);
  } finally {
    await browser.close();
  }
}

async function updateConformanceDoc(result) {
  const path = "docs/GS1_CONFORMANCE.md";
  const today = new Date().toISOString().slice(0, 10);
  let doc = await readFile(path, "utf8");
  const total = result.green + result.red + result.neutral;
  doc = doc.replace(
    /\*\*Updated:\*\*.*?(?=\n\n)/s,
    `**Updated:** ${today} · **Status:** scheduled hosted-suite check ` +
      `(gs1-conformance-pulse), ${result.green}/${total} passed, ` +
      `${result.red} failed, ${result.neutral} neutral. No conformance claim ` +
      `is made here beyond this count -- see BANNED_COPY in ` +
      `workers/authichain-com/src/docs-pages.ts for what that would require.`
  );
  await writeFile(path, doc);
}

// Same shape as ops-pulse.mjs's own gh() (headers included) -- not imported
// from there because decideIssueAction/signature/renderReport in that file
// are coupled to ops-pulse's own report shape (report.probes/.workflows/
// .revenue), which this pulse's green/red/neutral suite counts don't fit
// without distorting either file's semantics. Same dedup pattern (label +
// title lookup, create/comment/close), different data.
async function gh(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "authichain-gs1-conformance-pulse",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function upsertAlertIssue({ token, repo, label, title, body, healthy }) {
  const [owner, name] = repo.split("/");
  const open = await gh(
    `/repos/${owner}/${name}/issues?state=open&labels=${encodeURIComponent(label)}`,
    { token }
  );
  const existing = open.find(i => i.title === title);

  if (!healthy) {
    if (existing) {
      await gh(`/repos/${owner}/${name}/issues/${existing.number}/comments`, {
        method: "POST",
        token,
        body: { body },
      });
    } else {
      await gh(`/repos/${owner}/${name}/issues`, {
        method: "POST",
        token,
        body: { title, body, labels: [label] },
      });
    }
  } else if (existing) {
    await gh(`/repos/${owner}/${name}/issues/${existing.number}/comments`, {
      method: "POST",
      token,
      body: { body: `Green again: ${body}` },
    });
    await gh(`/repos/${owner}/${name}/issues/${existing.number}`, {
      method: "PATCH",
      token,
      body: { state: "closed" },
    });
  }
}

async function main() {
  let report;
  try {
    const result = await runHostedSuite(CANARY_DIGITAL_LINK);
    report = { ok: true, ...result };
  } catch (err) {
    report = { ok: false, error: String(err?.message ?? err) };
  }

  const manifest = JSON.parse(await readFile(".github/autonomy.json", "utf8"));
  const label = manifest.alerts?.label ?? "ops-alert";
  const title = manifest.alerts?.issue_title ?? "Ops alert: autonomous stack needs attention";

  const healthy = report.ok && report.healthy;
  const body = report.ok
    ? `gs1-conformance-pulse: ${report.green}/${report.green + report.red + report.neutral} ` +
      `passed against \`${CANARY_DIGITAL_LINK}\`. red=${report.red} neutral=${report.neutral}. ` +
      `Run: ${SUITE_URL}`
    : `gs1-conformance-pulse: could not reach or parse the hosted suite -- ${report.error}. ` +
      `This is a probe failure, not a confirmed conformance regression.`;

  console.log(body);

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (token && repo) {
    await upsertAlertIssue({ token, repo, label, title, body, healthy });
  } else {
    console.log("(no GITHUB_TOKEN/GITHUB_REPOSITORY -- skipping issue update, local run)");
  }

  if (healthy) {
    await updateConformanceDoc(report);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
