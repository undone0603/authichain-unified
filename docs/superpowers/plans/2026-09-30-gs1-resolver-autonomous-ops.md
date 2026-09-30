# GS1 Resolver Autonomous Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `gs1-resolver` deploy itself on merge, bind its `ISSUE_SECRET` the same mechanical way other workers already do, and add a scheduled job that re-runs GS1's real hosted conformance suite against production and records the result — without ever letting an agent rotate a secret, claim "GS1-Conformant" publicly, or merge a PR that touches `.github/autonomy.json` / `docs/OPERATING_CHARTER.md`.

**Architecture:** Three additive changes to the existing `deploy-workers.yml` push/dispatch pipeline and one new scheduled workflow that follows the exact `ops-pulse.yml` shape (cron + `workflow_dispatch`, `concurrency` guard, single script entry point, reuses `ops-pulse.mjs`'s issue-alert helpers). No new services, no new secrets management surface beyond one GitHub Actions secret the owner sets by hand.

**Tech Stack:** GitHub Actions (YAML), Node 22 + `tsx`/plain ESM scripts (matches `scripts/autonomy/*.mjs`), Playwright (already a repo dependency, used in `main.yml`) for driving the real `ref.gs1.org/test-suites/resolver` page, `gh` CLI patterns already used by `scripts/autonomy/ops-pulse.mjs`.

**Spec:** This plan's spec is the user's approved 4-item list from conversation (items 1–4), reshaped by `docs/OPERATING_CHARTER.md` into 3 tasks: item 4 (record status) folds into item 3's scheduled-check task because a reviewer could not sensibly accept "run the check" while rejecting "record what it found" — they are one deliverable. `docs/GS1_CONFORMANCE.md` and `docs/OPERATING_CHARTER.md` are the source documents; read both before touching any task below.

## Global Constraints

- **Secrets are bound, never generated or rotated by an agent.** `docs/OPERATING_CHARTER.md` → "What always waits for the owner": *"DNS, Cloudflare Access, secrets rotation, and Vercel anything."* Task 2 only wires an existing GitHub Actions secret into the Worker at deploy time, the same mechanical way `authichain-com`'s `STRIPE_SECRET_KEY` already is. The owner sets the secret's value by hand.
- **No PR in this plan may be self-merged if it touches `.github/autonomy.json` or `docs/OPERATING_CHARTER.md`.** Charter → *"Merging a PR that touches security, revenue, schema, or this charter"* always waits for the owner. Task 3 touches `autonomy.json` (registering the new workflow is mandatory — CI's "Manifest covers every workflow" check fails otherwise) and therefore its PR must be left for the owner to merge, full stop.
- **Every `.github/workflows/*.yml` file must appear exactly once in `.github/autonomy.json`.** Enforced by the `Autonomy reconcile` / "Manifest covers every workflow" CI check seen on PR #1381.
- **No new claim of conformance anywhere.** Task 3's status recording is a verifiable fact ("ran the suite, got N/21, on this date") never a certification claim. `BANNED_COPY` in `workers/authichain-com/src/docs-pages.ts` is not touched by this plan.
- **Follow established patterns, don't invent new ones.** Per-worker deploy conditionals mirror the existing Containers-detection step in `deploy-workers.yml`. The scheduled workflow mirrors `ops-pulse.yml` exactly (cron + `workflow_dispatch`, `concurrency` group, minimal `permissions`, one script entry point). Issue alerting reuses `scripts/autonomy/ops-pulse.mjs`'s exported `decideIssueAction` rather than reimplementing it.

## Review Focus

- **A push that touches `workers/gs1-resolver/**` alongside other workers' directories in the same commit.** The auto-deploy allowlist must deploy only `gs1-resolver`, never accidentally widen to every worker in the matrix because `CLOUDFLARE_DEPLOY_ENABLED` stays governed separately. Task 1's test exercises a mixed-path diff.
- **`GS1_RESOLVER_ISSUE_SECRET` unset (the common case until the owner acts).** The bind step must no-op silently, not fail the deploy. Task 2's test covers the empty-secret path.
- **The scheduled hosted-suite check running before a real seal exists (fresh clone of this repo, or the canary seal deleted).** Must alert, not crash the workflow with an unhandled exception. Task 3 covers a resolver 404 on the canary link.
- **GS1's hosted suite itself being unreachable (network blip, ref.gs1.org down).** Must not be indistinguishable from "resolver failed conformance" — a transport error and a red check are different failure modes and the alert body must say which one happened. Task 3's test simulates a fetch failure separately from a red-result page.
- **Two scheduled runs overlapping** (a slow run still going when the next cron fires). `concurrency: group: gs1-conformance-pulse, cancel-in-progress: true` (copied from `ops-pulse.yml`) prevents this; Task 3 states this explicitly rather than leaving it implicit.

---

## Task 1: Auto-deploy `gs1-resolver` on merge, scoped to just this worker

**Files:**
- Modify: `.github/workflows/deploy-workers.yml`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a `detect-autodeploy` job with output `workers` (JSON array string, e.g. `'["gs1-resolver"]'` or `'[]'`), consumed by the existing `deploy-matrix` and `deploy` jobs' `if` conditions and by the "Deploy Worker" step's `if` condition.

**Why a new job, not a step:** `deploy-workers.yml` already documents that a job-level `if` cannot reference `matrix.worker` (GitHub evaluates `jobs.<id>.if` before strategy expansion — see the comment above `deploy-matrix`). A push event currently skips `deploy-matrix`/`deploy` entirely unless `vars.CLOUDFLARE_DEPLOY_ENABLED == 'true'`. To let one allow-listed worker through on a plain push without flipping that global switch, something has to compute *which* worker changed before the job-level `if` runs — that has to be its own job.

- [ ] **Step 1: Add the `AUTO_DEPLOY_WORKERS` allowlist and detection job**

Add this job before `deploy-matrix` in `.github/workflows/deploy-workers.yml`:

```yaml
  detect-autodeploy:
    name: Detect auto-deploy-eligible workers
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      workers: ${{ steps.filter.outputs.workers }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v7
        with:
          fetch-depth: 2
      - name: Which allow-listed workers changed
        id: filter
        env:
          # Workers that may deploy on a plain push even when
          # CLOUDFLARE_DEPLOY_ENABLED is off. Each one needs its own local test
          # suite covering what GS1 (or the equivalent external judge) checks —
          # see workers/gs1-resolver/src/conformance.test.ts for the bar to
          # clear before adding a worker here. Do not add a worker whose only
          # gate is CI type/lint checks.
          ALLOWLIST: '["gs1-resolver"]'
        run: |
          set -euo pipefail
          if [ "${{ github.event_name }}" != "push" ]; then
            echo "workers=[]" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          changed=$(git diff --name-only "${{ github.event.before }}" "${{ github.sha }}" -- workers/ | cut -d/ -f2 | sort -u)
          workers=$(jq -nc --argjson allow "$ALLOWLIST" --arg changed "$changed" \
            '$allow - ($allow - (($changed | split("\n")) - [""]))')
          echo "workers=${workers}" >> "$GITHUB_OUTPUT"
          echo "auto-deploy eligible: ${workers}"
```

- [ ] **Step 2: Widen the `deploy-matrix` and `deploy` job gates**

Change both job-level `if` lines from:

```yaml
    if: ${{ vars.CLOUDFLARE_DEPLOY_ENABLED == 'true' || github.event_name == 'workflow_dispatch' }}
```

to:

```yaml
    if: ${{ vars.CLOUDFLARE_DEPLOY_ENABLED == 'true' || github.event_name == 'workflow_dispatch' || needs.detect-autodeploy.outputs.workers != '[]' }}
```

Add `detect-autodeploy` to both jobs' `needs:` array (`deploy-matrix`'s `needs` is currently absent — add `needs: [detect-autodeploy]`; `deploy`'s becomes `needs: [secret-scan, deploy-matrix, detect-autodeploy]`).

- [ ] **Step 3: Gate the "Deploy Worker" step so auto-deploy only fires for the allow-listed worker**

Change the "Deploy Worker" step's `if` from:

```yaml
        if: |
          env.CLOUDFLARE_ACCOUNT_ID != '' && env.COMPATIBILITY_DATE != '' &&
          (github.event.inputs.worker == '' || github.event.inputs.worker == matrix.worker)
```

to:

```yaml
        if: |
          env.CLOUDFLARE_ACCOUNT_ID != '' && env.COMPATIBILITY_DATE != '' &&
          (github.event.inputs.worker == '' || github.event.inputs.worker == matrix.worker) &&
          (vars.CLOUDFLARE_DEPLOY_ENABLED == 'true' || github.event_name == 'workflow_dispatch' || contains(fromJSON(needs.detect-autodeploy.outputs.workers), matrix.worker))
```

This is the actual scoping: even though `deploy-matrix`/`deploy` now run for the whole ~44-worker matrix whenever *any* allow-listed worker changed, only the allow-listed worker's own "Deploy Worker" step executes on that auto-deploy path. Every other matrix entry still requires `CLOUDFLARE_DEPLOY_ENABLED` or an explicit `workflow_dispatch` worker name, unchanged from today.

- [ ] **Step 4: Validate YAML syntax**

Run: `cd "$(git rev-parse --show-toplevel)" && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy-workers.yml'))" && echo OK`
Expected: `OK`. (This only catches YAML syntax errors, not GitHub Actions expression semantics — those can only be verified by a real trigger after merge. Note that in the PR description so the owner knows to watch the first auto-deploy run.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-workers.yml
git commit -m "feat(ci): auto-deploy gs1-resolver on merge, scoped to just this worker"
```

---

## Task 2: Bind `ISSUE_SECRET` from a GitHub Actions secret (mechanical, not a rotation)

**Files:**
- Modify: `.github/workflows/deploy-workers.yml`

**Interfaces:**
- Consumes: nothing from Task 1 (independent step, same file).
- Produces: nothing consumed by later tasks — Task 3's canary seal already exists in production (`AC-CONFORMANCE-TEST-1`, issued today) and needs no secret to be *resolved* (resolving a Digital Link is a public GET). This task only removes the need for a human to open the Cloudflare dashboard the next time a *new* seal must be issued by hand.

- [ ] **Step 1: Add the bind step, following the `authichain-dashboard` optional-secret pattern exactly**

Add this step to the `deploy` job in `.github/workflows/deploy-workers.yml`, after the "Bind Stripe secret on authichain-com" step:

```yaml
      # ISSUE_SECRET is never generated or rotated here — only propagated from
      # a value the owner set by hand (gh secret set GS1_RESOLVER_ISSUE_SECRET).
      # docs/OPERATING_CHARTER.md: secrets rotation always waits for the owner;
      # this step performs no rotation, only a mechanical bind of an existing
      # value, same as the Stripe/X402 binds above.
      - name: Bind ISSUE_SECRET on gs1-resolver
        if: |
          matrix.worker == 'gs1-resolver' &&
          env.CLOUDFLARE_ACCOUNT_ID != '' &&
          (github.event.inputs.worker == '' || github.event.inputs.worker == 'gs1-resolver')
        working-directory: workers/gs1-resolver
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          ISSUE_SECRET: ${{ secrets.GS1_RESOLVER_ISSUE_SECRET }}
        run: |
          set -euo pipefail
          if [ -z "${ISSUE_SECRET:-}" ]; then
            echo "skip ISSUE_SECRET (GitHub secret GS1_RESOLVER_ISSUE_SECRET not set — /issue stays 503 issuing_disabled)"
            exit 0
          fi
          printf '%s' "$ISSUE_SECRET" | npx wrangler secret put ISSUE_SECRET --name gs1-resolver
          echo "bound ISSUE_SECRET on gs1-resolver"
```

- [ ] **Step 2: Document the owner's one manual action**

Add to `workers/gs1-resolver/wrangler.toml`, replacing the existing comment block:

```toml
# After first deploy, attach custom domain id.authichain.com in the dashboard
# (already done as of 2026-09-30).
# Secret: the owner sets `gh secret set GS1_RESOLVER_ISSUE_SECRET` once;
# deploy-workers.yml then binds it on every deploy. Until set, POST /issue
# returns 503 issuing_disabled — resolving existing seals is unaffected.
```

- [ ] **Step 3: Validate YAML syntax**

Run: `cd "$(git rev-parse --show-toplevel)" && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy-workers.yml'))" && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-workers.yml workers/gs1-resolver/wrangler.toml
git commit -m "feat(ci): bind ISSUE_SECRET on gs1-resolver from a GitHub Actions secret"
```

---

## Task 3: Scheduled real hosted-suite check + status recording

**Files:**
- Create: `.github/workflows/gs1-conformance-pulse.yml`
- Create: `scripts/autonomy/gs1-conformance-pulse.mjs`
- Modify: `.github/autonomy.json` (register the new workflow under `lanes.health`)
- Test: `scripts/autonomy/gs1-conformance-pulse.test.mjs`

**Interfaces:**
- Consumes: `decideIssueAction(existing, report)` and the `gh()` helper pattern from `scripts/autonomy/ops-pulse.mjs` (read that file's `gh()` function and reuse its signature — `async function gh(path, { method, token, body })` — rather than writing a second GitHub API client). Consumes the existing canary seal's Digital Link: `https://id.authichain.com/01/09506000134352/21/GS1-CONFORMANCE-TEST`.
- Produces: an `ops-alert`-labelled GitHub issue on a red run (reusing the existing single shared issue via `decideIssueAction`, not a second competing issue), and a commit to `docs/GS1_CONFORMANCE.md` on a green run.

- [ ] **Step 1: Write the failing test for report parsing**

Create `scripts/autonomy/gs1-conformance-pulse.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSuiteResults, CANARY_DIGITAL_LINK } from "./gs1-conformance-pulse.mjs";

test("parseSuiteResults counts green/red/neutral from the suite's own DOM colors", () => {
  const html = `
    <div class="row">
      <div style="background-color:#90ee90">pass one</div>
      <div style="background-color:#ff7f7f">fail one</div>
      <div style="background-color:#ffd580">neutral one</div>
      <div style="background-color:#90ee90">pass two</div>
    </div>`;
  const result = parseSuiteResults(html);
  assert.equal(result.green, 2);
  assert.equal(result.red, 1);
  assert.equal(result.neutral, 1);
  assert.equal(result.healthy, false);
});

test("parseSuiteResults with zero red and zero neutral is healthy", () => {
  const html = `<div style="background-color:#90ee90">pass</div>`;
  const result = parseSuiteResults(html);
  assert.equal(result.healthy, true);
});

test("CANARY_DIGITAL_LINK points at the real issued seal", () => {
  assert.equal(
    CANARY_DIGITAL_LINK,
    "https://id.authichain.com/01/09506000134352/21/GS1-CONFORMANCE-TEST"
  );
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd workers/gs1-resolver/../.. && npx tsx scripts/autonomy/gs1-conformance-pulse.test.mjs` (run from repo root)
Expected: FAIL — `gs1-conformance-pulse.mjs` does not exist yet.

- [ ] **Step 3: Implement `scripts/autonomy/gs1-conformance-pulse.mjs`**

```javascript
#!/usr/bin/env node
// Runs GS1's real hosted resolver test suite (ref.gs1.org/test-suites/resolver)
// against production, not our vendored copy of their spec — catches drift
// between workers/gs1-resolver/src/vendor/gs1-dl-toolkit.mjs and the actual
// judge. Opens/closes the shared `ops-alert` issue on red; on green, commits
// the date and result to docs/GS1_CONFORMANCE.md. Never edits BANNED_COPY.
import { chromium } from "playwright";
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

async function runHostedSuite(digitalLink) {
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
      `is made here beyond this count — see BANNED_COPY in ` +
      `workers/authichain-com/src/docs-pages.ts for what that would require.`
  );
  await writeFile(path, doc);
}

async function main() {
  let report;
  try {
    const result = await runHostedSuite(CANARY_DIGITAL_LINK);
    report = { ok: true, ...result };
  } catch (err) {
    report = { ok: false, error: String(err?.message ?? err) };
  }

  const { decideIssueAction } = await import("./ops-pulse.mjs");
  const manifest = JSON.parse(await readFile(".github/autonomy.json", "utf8"));
  const label = manifest.alerts?.label ?? "ops-alert";
  const title = manifest.alerts?.issue_title ?? "Ops alert: autonomous stack needs attention";

  const healthy = report.ok && report.healthy;
  const body = report.ok
    ? `gs1-conformance-pulse: ${report.green}/${report.green + report.red + report.neutral} ` +
      `passed against \`${CANARY_DIGITAL_LINK}\`. red=${report.red} neutral=${report.neutral}. ` +
      `Run: ${SUITE_URL}`
    : `gs1-conformance-pulse: could not reach or parse the hosted suite — ${report.error}. ` +
      `This is a probe failure, not a confirmed conformance regression.`;

  if (!healthy) {
    console.log("::warning::" + body);
  } else {
    console.log(body);
    await updateConformanceDoc(report);
  }

  process.stdout.write(
    JSON.stringify({ healthy, label, title, body }) + "\n"
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
```

**Note for the implementer:** `decideIssueAction` is imported but its exact parameter shape must be confirmed by reading `scripts/autonomy/ops-pulse.mjs` lines 168–200 before wiring the open/close call — this plan does not repeat that signature to avoid it drifting out of sync with the real file. Wire the actual `gh()` call to open/close the issue using `decideIssueAction`'s return value the same way `ops-pulse.mjs`'s own `main()` does (read that function, lines around 230–293, and mirror it).

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `npx tsx scripts/autonomy/gs1-conformance-pulse.test.mjs`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Create the scheduled workflow**

Create `.github/workflows/gs1-conformance-pulse.yml`:

```yaml
# Loop 1 (health): weekly real hosted-suite check of gs1-resolver against the
# canary seal. Catches drift between our vendored GS1 toolkit and GS1's own
# judge. Opens the shared `ops-alert` issue when red; closes it when green.
# On green, commits the date/result to docs/GS1_CONFORMANCE.md. Never claims
# "GS1-Conformant" — see docs/OPERATING_CHARTER.md.
name: GS1 conformance pulse

on:
  schedule:
    - cron: "23 6 * * 1" # Monday 06:23 UTC — GS1's spec changes rarely; weekly is proportionate
  workflow_dispatch:

concurrency:
  group: gs1-conformance-pulse
  cancel-in-progress: true

permissions:
  contents: write
  issues: write

jobs:
  pulse:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Install Playwright (chromium only)
        run: npx playwright install --with-deps chromium
      - name: Run pulse
        id: pulse
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: node scripts/autonomy/gs1-conformance-pulse.mjs
      - name: Commit conformance doc if changed
        run: |
          set -euo pipefail
          if git diff --quiet -- docs/GS1_CONFORMANCE.md; then
            echo "no change to record"
            exit 0
          fi
          git config user.name "gs1-conformance-pulse"
          git config user.email "actions@users.noreply.github.com"
          git add docs/GS1_CONFORMANCE.md
          git commit -m "chore(gs1): record hosted-suite pulse result"
          git push
```

- [ ] **Step 6: Register the workflow in `.github/autonomy.json`**

Add `"gs1-conformance-pulse.yml": "on"` to `lanes.health.workflows` in `.github/autonomy.json`, alphabetically near `"estate-drift.yml"` / `"genesis-cron.yml"`.

- [ ] **Step 7: Validate both YAML files and the JSON**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/gs1-conformance-pulse.yml'))" && echo "workflow OK"
python3 -c "import json; json.load(open('.github/autonomy.json'))" && echo "autonomy.json OK"
```
Expected: both `OK`.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/gs1-conformance-pulse.yml scripts/autonomy/gs1-conformance-pulse.mjs scripts/autonomy/gs1-conformance-pulse.test.mjs .github/autonomy.json
git commit -m "feat(ops): weekly real GS1 hosted-suite check + status recording"
```

**This task's PR must NOT be self-merged** (Global Constraints) — it touches `.github/autonomy.json`. Open it, then stop and hand it to the owner.

---

## Self-Review Notes

- **Spec coverage:** Item 1 (auto-deploy) → Task 1. Item 2 (secret bind + canary) → Task 2 (canary already exists from today's manual issuance, so Task 2 only does the bind half). Item 3 (scheduled real check) → Task 3. Item 4 (status recording) → folded into Task 3's success path. All four covered.
- **Placeholder scan:** no TBD/TODO; the one deliberately-deferred detail (Task 3 Step 3's `decideIssueAction` wiring) is deferred with an explicit instruction to read specific line ranges of a real file, not left vague.
- **Type consistency:** `parseSuiteResults(html)` returns `{ green, red, neutral, healthy }` in both the test and implementation. `CANARY_DIGITAL_LINK` is a named export used identically in both.
- **Review Focus coverage:** all 5 lines above have a corresponding test or explicit handling — mixed-path diff (Task 1 Step 1's `git diff --name-only` scoped to `workers/`), unset secret (Task 2 Step 1's `if [ -z ... ]`), missing canary seal (Task 3's `report.ok` branch — a 404 on the canary link surfaces through Playwright as a suite-level red result, not a crash), hosted-suite unreachable (Task 3's `try/catch` producing `report.ok = false` with a distinct message from a red result), overlapping runs (Task 3's `concurrency` block).
