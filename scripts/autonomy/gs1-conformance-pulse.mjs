#!/usr/bin/env node
// Runs GS1's real hosted resolver test suite (ref.gs1.org/test-suites/resolver)
// against production, not our vendored copy of their spec -- catches drift
// between workers/gs1-resolver/src/vendor/gs1-dl-toolkit.mjs and the actual
// judge. On red (or on any probe failure -- canary missing, suite
// unreachable, page shape changed), exits non-zero with an ::error::
// annotation and a $GITHUB_STEP_SUMMARY; the existing `ops-pulse` workflow
// already watches every registered health-lane workflow's run status
// (evaluateWorkflows in ops-pulse.mjs) and raises the shared `ops-alert`
// issue from there -- this script does not open, comment on, or close any
// GitHub issue itself, so it can never race or silence an unrelated alert.
// On green, commits the date and result to docs/GS1_CONFORMANCE.md. Never
// edits BANNED_COPY; never claims "GS1-Conformant".
import { readFile, writeFile, appendFile } from "node:fs/promises";

export const CANARY_DIGITAL_LINK =
  "https://id.authichain.com/01/09506000134352/21/GS1-CONFORMANCE-TEST";
const SUITE_URL = "https://ref.gs1.org/test-suites/resolver/";

// GS1's own status vocabulary (GS1DigitalLinkResolverTestSuite.js:
// `"status": "fail", // (pass|fail|warn), default is fail`). `warn` is a
// SHOULD-level result (e.g. trailingSlash) and does not by itself make a run
// unhealthy; an empty result set or an unrecognized status does, because
// both mean the page could not be read, not that everything passed.
export function classifyResults(cells) {
  let pass = 0,
    fail = 0,
    warn = 0,
    other = 0;
  for (const c of cells) {
    if (c.status === "pass") pass++;
    else if (c.status === "fail") fail++;
    else if (c.status === "warn") warn++;
    else other++;
  }
  const healthy = cells.length > 0 && fail === 0 && other === 0;
  return { pass, fail, warn, other, total: cells.length, healthy };
}

/** HEAD on the canary before spending a browser launch on a link that 404s. */
async function canaryIsLive(digitalLink) {
  try {
    const res = await fetch(digitalLink, { method: "HEAD", redirect: "manual" });
    // A live Digital Link either redirects (307, the default-link case) or
    // answers directly (200) -- both mean the resolver has a record for it.
    return res.status === 307 || res.status === 200;
  } catch {
    return false;
  }
}

// playwright-core is loaded lazily, only for the real browser run -- the
// pure classifyResults tests must not require it installed. The repo
// depends on playwright-core (not the `playwright` package, which is not a
// root dependency -- only apps/agent-browser's own devDependency, per
// package.json), and ships its own browser binaries via
// `playwright-core install`, not `npx playwright install`.
async function runHostedSuite(digitalLink) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // The page prefills #dlEgInput straight from the query string:
    // `inputBox.value = decodeURIComponent(location.search.toString().substr(1))`
    // (confirmed against the live page source) -- no need to interact with
    // the input field at all.
    await page.goto(`${SUITE_URL}?${encodeURIComponent(digitalLink)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.click("#submitButton");
    // #linkToResult is appended once resultSummary() finishes (suite JS,
    // 2025-10-20 addition) -- the real "all tests reported" marker. A fixed
    // sleep raced this on a slow run through the suite's own proxy
    // (philarcher.org) to each resolver call.
    await page.waitForSelector("#linkToResult", { timeout: 180000 });
    const cells = await page.$$eval("#resultsGrid a", as =>
      as.map(a => ({ id: a.id, status: a.className, title: a.title }))
    );
    return classifyResults(cells);
  } finally {
    await browser.close();
  }
}

async function updateConformanceDoc(result, runUrl) {
  const path = "docs/GS1_CONFORMANCE.md";
  const today = new Date().toISOString().slice(0, 10);
  let doc = await readFile(path, "utf8");
  doc = doc.replace(
    /\*\*Updated:\*\*.*?(?=\n\n)/s,
    `**Updated:** ${today} · **Status:** scheduled hosted-suite check ` +
      `(gs1-conformance-pulse), ${result.pass}/${result.total} passed, ` +
      `${result.fail} failed, ${result.warn} warned. Run: ${runUrl}. No ` +
      `conformance claim is made here beyond this count -- see BANNED_COPY ` +
      `in workers/authichain-com/src/docs-pages.ts for what that would require.`
  );
  await writeFile(path, doc);
}

async function reportFailure(reason, detail) {
  const runUrl =
    process.env.GITHUB_SERVER_URL &&
    `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const line = `gs1-conformance-pulse: ${reason} -- ${detail}${runUrl ? ` (${runUrl})` : ""}`;
  console.log(`::error::${line}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${line}\n`);
  }
  return line;
}

async function main() {
  const runUrl =
    process.env.GITHUB_SERVER_URL &&
    `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

  if (!(await canaryIsLive(CANARY_DIGITAL_LINK))) {
    await reportFailure(
      "canary-missing",
      `HEAD ${CANARY_DIGITAL_LINK} did not resolve -- the suite has nothing real to test against`
    );
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = await runHostedSuite(CANARY_DIGITAL_LINK);
  } catch (err) {
    await reportFailure("probe-failure", String(err?.message ?? err));
    process.exitCode = 1;
    return;
  }

  if (!result.healthy) {
    await reportFailure(
      result.total === 0 ? "probe-failure" : "red",
      `${result.pass}/${result.total} passed, ${result.fail} failed, ${result.warn} warned against \`${CANARY_DIGITAL_LINK}\`. Run: ${SUITE_URL}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `gs1-conformance-pulse: ${result.pass}/${result.total} passed, ${result.warn} warned. Healthy.`
  );
  await updateConformanceDoc(result, runUrl ?? SUITE_URL);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
