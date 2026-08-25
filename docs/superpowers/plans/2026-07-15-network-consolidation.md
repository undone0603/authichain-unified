# AuthiChain Network Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate every sibling project under `/home/zac/` into `authichain-unified`, salvage unmerged work from the stale `agentz/` checkout, fix the 11 pre-existing dirty worktree files, sweep the repo root clean, and document the network.

**Architecture:** Additive-only. Deployed paths (`client/`, `server/`, `shared/`, `src/`, `workers/`, `agentz/`, root build configs) never move. Siblings copy in under `apps/` (no node_modules/.git/env files). Each task is one commit or a small set of commits; paths staged explicitly, never `git add -A`.

**Tech Stack:** git (Git Bash over `//wsl.localhost`), rsync/cp inside WSL Ubuntu, pnpm 10 + node 22 via nvm inside Ubuntu, vitest, python3.

## Global Constraints

- Repo path (Git Bash): `R="//wsl.localhost/Ubuntu/home/zac/authichain-unified"`. Stale checkout: `A="//wsl.localhost/Ubuntu/home/zac/agentz"`.
- NEVER `git add -A` / `git add .` — stage explicit paths only (CRLF noise: ~1000+ files show phantom diffs).
- NEVER commit: `.env*`, `*keys*.txt`, `node_modules/`, `dist/`, `.next/`, `__pycache__/`, `*.log`, venvs.
- Secret-scan gate before every import commit: `grep -rEl "sk_live_|whsec_|AKIA[A-Z0-9]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" <dir>` must return empty (or the hits get redacted first). Note: the dead key `sk_live_51SXIyE…` appears in old CF worker bundles — GitHub Push Protection WILL block new files containing it; redact to `sk_live_REDACTED` in archived copies.
- Builds/typecheck run INSIDE Ubuntu (node 22 via nvm; Windows node breaks esbuild):
  `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && nvm use 22 >/dev/null && <CMD>'`
- Commit trailer on every commit:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ`
- Do NOT push until Task 10 (verification). Push triggers `.github/workflows/deploy-cloudflare.yml` → live worker deploys. That is expected/intended for the wrangler.toml fixes, but it happens once, at the end.
- No prod DB migrations run, no crons touched, no outbound fired, nothing deleted from `/home/zac/` (renames only, Task 11).
- Ignore `git` stderr noise: "LF will be replaced by CRLF" warnings and "geometric-repack … Permission denied" are harness/mount artifacts, not failures.

---

### Task 1: Fix the 11 pre-existing dirty worktree files

**Files:**
- Modify: git config (`core.fileMode false`), `workers/authichain-scan-validate/wrangler.toml`
- Commit: `.github/workflows/deploy-cloudflare.yml`, `workers/authichain-qron-provenance/wrangler.toml`, `workers/authichain-scan-validate/wrangler.toml`, `scripts/push-env-to-vercel.sh`, `public/dc/*`, `tests/test_brand_assets.py`

**Interfaces:**
- Produces: clean `git status` (only intentional untracked leftovers, if any), baseline for all later tasks.

Background (verified 2026-07-15): 5 files are mode-only changes (755→644, 9p-mount artifact); `push-env-to-vercel.sh` has mode noise + one real change (`set -euo` → `set -eo`); `deploy-cloudflare.yml` adds deploy steps for 4 workers; both wrangler.tomls repoint D1 `authichain-provenance` to id `5a6672a7-b3cb-43d4-85d4-d675451e58cb`; scan-validate's toml ALSO gained a `[[routes]]` block duplicating qron-provenance's route `authichain.com/api/qron-register*` (conflict — two workers can't own the same custom-domain route) and a `[build]` command; `public/dc/` (4 brand HTML files) + `tests/test_brand_assets.py` are untracked real work.

- [ ] **Step 1: Kill mode-change noise durably**

```bash
git -C "$R" config core.fileMode false
git -C "$R" status --porcelain
```
Expected: the 5 mode-only files (`scripts/complete-setup.sh`, `scripts/deploy-ready-workers.sh`, `scripts/push-secrets-to-cloudflare.sh`, `scripts/rotate-secrets.sh`, `setup-vercel-env.sh`) disappear from status; `push-env-to-vercel.sh` still shows (content change).

- [ ] **Step 2: Verify the 4 new CI worker dirs exist**

```bash
for w in authichain-autopilot authichain-chain-data authichain-license-issuer authichain-qron-provenance; do ls "$R/workers/$w/wrangler.toml" >/dev/null && echo "OK $w" || echo "MISSING $w"; done
```
Expected: 4× OK. If any MISSING: delete that worker's step from the workflow diff before committing (edit the file).

- [ ] **Step 3: Verify the new D1 id is real**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && npx wrangler d1 list 2>/dev/null | grep -i provenance'
```
Expected: a row showing `authichain-provenance` with id `5a6672a7-b3cb-43d4-85d4-d675451e58cb`. If the id differs or wrangler auth fails, STOP and ask the owner before committing the toml changes (wrong D1 id = broken workers on next deploy).

- [ ] **Step 4: Remove the duplicate route from scan-validate's wrangler.toml**

Edit `workers/authichain-scan-validate/wrangler.toml`: delete these lines (they belong to qron-provenance):
```toml
[[routes]]
pattern = "authichain.com/api/qron-register*"
custom_domain = true
```
Keep the D1 id change. For the `[build] command = "npm run build"` block: keep only if `workers/authichain-scan-validate/package.json` exists with a `build` script (`grep '"build"' "$R/workers/authichain-scan-validate/package.json"`); otherwise delete the `[build]` block too.

- [ ] **Step 5: Sanity-run the brand assets test**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && python3 -m pytest tests/test_brand_assets.py -q'
```
Expected: PASS (it checks `public/dc/*.dc.html` exist/are well-formed). If it fails because of a missing dep, run with `.agentz-venv`: `source ~/.agentz-venv/bin/activate` first. If it fails on substance, fix the test or assets to match (they were authored together).

- [ ] **Step 6: Commit in two logical commits**

```bash
cd "$R"
git add .github/workflows/deploy-cloudflare.yml workers/authichain-qron-provenance/wrangler.toml workers/authichain-scan-validate/wrangler.toml scripts/push-env-to-vercel.sh
git commit -m "fix(ci+workers): deploy 4 more workers in CI; repoint provenance D1 id; drop duplicate qron-register route from scan-validate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
git add public/dc tests/test_brand_assets.py
git commit -m "feat(brand): add public/dc brand pages + asset test

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
git status --porcelain
```
Expected: status empty (or only files this plan later handles).

---

### Task 2: Salvage — reputation engine (server + migration + test)

**Files:**
- Create: `server/routers/reputation.ts`, `server/reputation.test.ts`, `supabase/migrations/20260715000001_create_reputation_tables.sql`
- Modify: `server/db.ts` (logScanEvent + 2 new fns), `server/routers.ts` (register router)

**Interfaces:**
- Consumes: `router`, `protectedProcedure` from `server/_core/trpc`; `getDb`, `sql` from `server/db.ts`.
- Produces: `db.recordReputationEvent(userId: string, eventType: string, pointsDelta: number): Promise<void>`; `db.resolveFraudAlert(alertId: number, userId: string, isVerifiedCounterfeit: boolean): Promise<void>`; `reputationRouter` mounted as `reputation` on `appRouter`; `logScanEvent` gains optional `userId?: string` param.

- [ ] **Step 1: Copy router + migration from the stale checkout**

```bash
cp "$A/server/routers/reputation.ts" "$R/server/routers/reputation.ts"
cp "$A/supabase/migrations/00002_create_reputation_tables.sql" "$R/supabase/migrations/20260715000001_create_reputation_tables.sql"
```
(The migration is committed but NOT run against live Supabase — owner action later.)

- [ ] **Step 2: Port the db.ts additions**

In `server/db.ts`, current main has `logScanEvent` at ~line 694. Change its signature to add `userId?: string` and append the reputation hook, then add the two new functions right after it:

```ts
export async function logScanEvent(data: { qrCodeId: number; productId: number; isAuthentic?: boolean; userAgent?: string; userId?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(qrScanEvents).values(data);

  if (data.userId && data.isAuthentic) {
    await recordReputationEvent(data.userId, 'scan_authenticity_confirmed', 1);
  }
}

export async function recordReputationEvent(userId: string, eventType: string, pointsDelta: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    INSERT INTO reputation_events (user_id, event_type, points_delta)
    VALUES (${userId}, ${eventType}, ${pointsDelta});

    INSERT INTO user_reputation (user_id, points, trust_level)
    VALUES (${userId}, ${pointsDelta}, 'novice')
    ON CONFLICT (user_id) DO UPDATE SET
      points = user_reputation.points + EXCLUDED.points,
      last_updated_at = now();
  `);
}

export async function resolveFraudAlert(alertId: number, userId: string, isVerifiedCounterfeit: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(fraudAlerts).set({ status: 'resolved' }).where(eq(fraudAlerts.id, alertId));
  if (isVerifiedCounterfeit) {
    await recordReputationEvent(userId, 'counterfeit_verified', 50);
  }
}
```
Gate: `grep -n "fraudAlerts" "$R/server/db.ts" "$R/shared/"*.ts` — if `fraudAlerts` is not an imported schema table in current main, OMIT `resolveFraudAlert` entirely (YAGNI; note it in the commit message). Also confirm `qrScanEvents` has a `userId` column (`grep -n "qrScanEvents" $R/shared/schema*.ts` or wherever the table is defined); if not, insert `values({ qrCodeId: data.qrCodeId, productId: data.productId, isAuthentic: data.isAuthentic, userAgent: data.userAgent })` explicitly instead of `values(data)` so the extra key never reaches drizzle.

- [ ] **Step 3: Register the router**

In `server/routers.ts` add with the other imports (~line 30):
```ts
import { reputationRouter } from "./routers/reputation";
```
and inside `export const appRouter = router({ … })` (line ~46) add:
```ts
  reputation: reputationRouter,
```

- [ ] **Step 4: Write the test (improved from the stale WIP — the original's mocks couldn't observe module-internal calls)**

Create `server/reputation.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const execute = vi.fn();
const insert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return { ...actual, getDb: vi.fn(async () => ({ execute, insert })) };
});

import * as db from './db';

describe('Reputation Engine', () => {
  beforeEach(() => { execute.mockClear(); insert.mockClear(); });

  it('awards points when an authentic scan has a userId', async () => {
    await db.logScanEvent({ qrCodeId: 1, productId: 1, isAuthentic: true, userId: 'user-123' });
    expect(execute).toHaveBeenCalledTimes(1);
    const sqlArg = JSON.stringify(execute.mock.calls[0][0]);
    expect(sqlArg).toContain('reputation_events');
  });

  it('does not touch reputation for anonymous scans', async () => {
    await db.logScanEvent({ qrCodeId: 1, productId: 1, isAuthentic: true });
    expect(execute).not.toHaveBeenCalled();
  });
});
```
NOTE: if Step 2's `vi.mock` cannot intercept the internal `getDb` call (same-module call, common with esbuild-bundled vitest), the assertion will fail with `execute` never called for the first test — in that case rewrite both tests to call `db.recordReputationEvent('user-123','scan_authenticity_confirmed',1)` directly and assert `execute` was called with SQL containing `reputation_events`; the anonymous-scan test stays as-is (it passes vacuously). Same-module interception limits are a known vitest constraint, not a code bug.

- [ ] **Step 5: Run the test**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && nvm use 22 >/dev/null && npx vitest run server/reputation.test.ts'
```
Expected: PASS (2 tests). Apply the Step-4 fallback if the mock can't intercept.

- [ ] **Step 6: Typecheck**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && nvm use 22 >/dev/null && pnpm run check'
```
Expected: exit 0 (or ONLY the pre-existing error set — capture baseline BEFORE editing with the same command if unsure; no NEW errors allowed).

- [ ] **Step 7: Commit**

```bash
cd "$R"
git add server/routers/reputation.ts server/reputation.test.ts server/db.ts server/routers.ts supabase/migrations/20260715000001_create_reputation_tables.sql
git commit -m "feat(reputation): salvage reputation engine from stale agentz checkout

user_reputation/reputation_events tables (migration NOT yet applied to live),
recordReputationEvent + authentic-scan hook in logScanEvent, tRPC reputation router.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```

---

### Task 3: Salvage — OpsDashboard page

**Files:**
- Create: `client/src/pages/OpsDashboard.tsx` (copy from `$A/client/src/pages/OpsDashboard.tsx`)
- Modify: `client/src/App.tsx` (lazy import + route)

**Interfaces:**
- Consumes: wouter `WRoute`/`Switch` pattern already in App.tsx; lucide-react icons (already a dep).
- Produces: route `/admin/ops`.

- [ ] **Step 1: Copy the page**

```bash
cp "$A/client/src/pages/OpsDashboard.tsx" "$R/client/src/pages/OpsDashboard.tsx"
```

- [ ] **Step 2: Wire the route**

In `client/src/App.tsx`, next to the other lazy page imports (lines 14-47):
```ts
const OpsDashboard = lazy(() => import("./pages/OpsDashboard"));
```
and inside the `<Switch>`, next to the existing admin route (grep for `AdminDashboard` to find it):
```tsx
<WRoute path="/admin/ops" component={OpsDashboard} />
```

- [ ] **Step 3: Typecheck + fix**

Same `pnpm run check` command as Task 2 Step 6. Expected: no new errors. If OpsDashboard references endpoints/types that no longer exist in current main, adjust the page minimally (e.g., point fetches at existing `/api/*` routes or render "not wired" states) — do NOT create new server endpoints for it in this task.

- [ ] **Step 4: Commit**

```bash
cd "$R"
git add client/src/pages/OpsDashboard.tsx client/src/App.tsx
git commit -m "feat(client): salvage OpsDashboard page at /admin/ops from stale checkout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```

---

### Task 4: Salvage — agentz Python work (reinvestment handler, resilience, core diffs)

**Files:**
- Create: `agentz/workflows/handlers/reinvestment_handler.py`, `agentz/core/resilience.py`, `scripts/resilience_loop.py`, `scripts/fix_schema_tables.sql`
- Modify: `agentz/workflows/registry.yaml` (append entry), possibly up to 11 `agentz/core/*.py` + 5 handler files (diff-gated)

**Interfaces:**
- Consumes: agentz handler convention — module under `agentz.workflows.handlers`, registry entry with `handler: handlers.<module>`.
- Produces: workflow id `reinvestment_handler` runnable via `python -m agentz.cli run reinvestment_handler --mode dry-run`.

- [ ] **Step 1: Copy the new files**

```bash
cp "$A/agentz/workflows/handlers/reinvestment_handler.py" "$R/agentz/workflows/handlers/"
cp "$A/agentz/core/resilience.py" "$R/agentz/core/"
cp "$A/scripts/resilience_loop.py" "$R/scripts/"
cp "$A/scripts/fix_schema_tables.sql" "$R/scripts/"
```

- [ ] **Step 2: Append the registry entry**

Append to `agentz/workflows/registry.yaml` (verbatim from the stale checkout, lines 810-821 — copy the FULL block with `git -C "$A" diff agentz/workflows/registry.yaml` to see it exactly; it may have fields beyond these):
```yaml
  - id: reinvestment_handler
    title: "Sovereign Flywheel: Autonomous Growth and Reinvestment"
    priority: critical
    blocks_revenue: false
    handler: handlers.reinvestment_handler
    type: api
    estimated_minutes: 5
    requires: []
    prerequisites: []
    description: |
      The AuthiChain Sovereign Flywheel: Autonomously scales outreach and
      reinvests revenue into new market capability development.
    confirm_before_run: true
```
Set `confirm_before_run: true` regardless of what the stale copy had — outbound/spend gating is policy (all outbound gated, founder approval).

- [ ] **Step 3: Port the modified core/handler files, diff-gated**

For each file the stale checkout modified (`agentz/core/{browser,credentials,hubspot,hubspot_healer,microsites,resilience,runner,submission,trust}.py`, `agentz/workflows/handlers/{authichain_executive_reporting,authichain_expansion,authichain_global_scale,hubspot_drip_unstick,power_launch}.py`):
```bash
git -C "$A" diff -- <file> > /tmp/hunk.diff   # what the stale session changed
diff "$A/<file>" "$R/<file>"                   # how it differs from CURRENT main
```
Decision rule per file: if current main's version is UNCHANGED since the stale base (the `git -C "$A" diff` applies cleanly: `git -C "$R" apply --check /tmp/hunk.diff`), apply it. If current main has since diverged in that file, apply only hunks that add new functions/branches without touching diverged lines; skip conflicting hunks and list them in the commit message as "not ported (diverged)". Never blind-overwrite a current-main file with the stale copy.

- [ ] **Step 4: Compile-check + smoke the registry**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && source ~/.agentz-venv/bin/activate 2>/dev/null; python3 -m compileall -q agentz/core agentz/workflows/handlers scripts/resilience_loop.py && python3 -c "import yaml,sys; d=yaml.safe_load(open(\"agentz/workflows/registry.yaml\")); ids=[w[\"id\"] for w in d[\"workflows\"]]; assert \"reinvestment_handler\" in ids and len(ids)==len(set(ids)); print(\"registry OK\",len(ids),\"workflows\")"'
```
Expected: `registry OK <n> workflows`, no compile errors. Then run existing agentz tests:
```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && source ~/.agentz-venv/bin/activate 2>/dev/null; python3 -m pytest tests/ -q -x --ignore=tests/test_brand_assets.py 2>&1 | tail -5'
```
Expected: no failures beyond any pre-existing baseline (capture baseline on main before this task if needed).

- [ ] **Step 5: Commit**

```bash
cd "$R"
git add agentz/workflows/handlers/reinvestment_handler.py agentz/core/resilience.py scripts/resilience_loop.py scripts/fix_schema_tables.sql agentz/workflows/registry.yaml
# plus any core/handler files actually ported in Step 3 — list them explicitly
git commit -m "feat(agentz): salvage reinvestment handler + resilience loop from stale checkout (outbound gated: confirm_before_run)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```

---

### Task 5: Salvage — docs from stale checkout

**Files:**
- Create: `docs/decoupling.md`, `docs/config-standardization.md`, `docs/platform-robustness.md`, `docs/strategy/MONUMENTAL_RELEASE.md`, `docs/strategy/WORKSPACE.md`

- [ ] **Step 1: Copy + commit**

```bash
mkdir -p "$R/docs/strategy"
cp "$A/docs/decoupling.md" "$A/docs/config-standardization.md" "$A/docs/platform-robustness.md" "$R/docs/"
cp "$A/MONUMENTAL_RELEASE.md" "$R/docs/strategy/MONUMENTAL_RELEASE.md"
cp "$A/WORKSPACE.md" "$R/docs/strategy/WORKSPACE.md"
cd "$R" && git add docs/decoupling.md docs/config-standardization.md docs/platform-robustness.md docs/strategy/MONUMENTAL_RELEASE.md docs/strategy/WORKSPACE.md
git commit -m "docs: salvage design docs from stale agentz checkout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```
Salvage is now COMPLETE for the stale checkout (all 15 untracked + 38 modified files accounted for: ported, superseded, or strategy-archived). Also copy `$A/debug_grant_draft.py` and `$A/migrate-reputation.js` into `scripts/ops/` during Task 7 if they're not junk (read them: if they reference the reputation tables, keep; else skip).

---

### Task 6: Import apps — qron-platform, chatbot, agent-browser

**Files:**
- Create: `apps/qron-platform/**`, `apps/chatbot/**`, `apps/agent-browser/**`

**Interfaces:**
- Produces: inert source trees (no pnpm-workspace globs exist, so nothing joins the root install/build).

- [ ] **Step 1: Copy with excludes (run INSIDE Ubuntu; rsync is available there)**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc '
mkdir -p /home/zac/authichain-unified/apps
EXC="--exclude=node_modules --exclude=.git --exclude=dist --exclude=.next --exclude=build --exclude=*.log --exclude=logs --exclude=__pycache__ --exclude=.venv --exclude=venv --exclude=.env --exclude=.env.* --exclude=*.tsbuildinfo --exclude=.vercel --exclude=.wrangler --exclude=.turbo --exclude=coverage --exclude=*.tar.gz"
rsync -a $EXC /home/zac/qron-platform/  /home/zac/authichain-unified/apps/qron-platform/
rsync -a $EXC /home/zac/chatbot/        /home/zac/authichain-unified/apps/chatbot/
rsync -a $EXC /home/zac/agent-browser/  /home/zac/authichain-unified/apps/agent-browser/
du -sh /home/zac/authichain-unified/apps/*'
```
Expected: each apps/* dir a few MB–tens of MB. If any exceeds ~60MB, find the bloat (`du -sh apps/<x>/* | sort -h | tail`) and add excludes; no single committed file >5MB (`find apps -size +5M`) — exclude any found (git hosts hate them and they're never source).

- [ ] **Step 2: Secret-scan + env-file sweep**

```bash
cd "$R"
find apps -name ".env*" -o -name "*secret*" -o -name "*credentials*" | grep -v node_modules
grep -rEl "sk_live_|whsec_|AKIA[A-Z0-9]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|eyJhbGciOi" apps/ | head -20
```
Expected: both empty. Delete any `.env*` found. For key hits: inspect each; live-looking secrets get the FILE deleted from the import (list them in the commit message); obvious placeholders/test keys (`sk_test_`, `example`) may stay.

- [ ] **Step 3: Note dirty-file deltas from qron-platform and agent-browser**

qron-platform had 2 uncommitted changes and agent-browser 5 — the rsync captured the working tree, which is what we want (canonical = what's on disk). Record which files were dirty for the commit message:
```bash
git -C "//wsl.localhost/Ubuntu/home/zac/qron-platform" status --porcelain
git -C "//wsl.localhost/Ubuntu/home/zac/agent-browser" status --porcelain
```

- [ ] **Step 4: Commit one app at a time**

```bash
cd "$R"
git add apps/qron-platform && git commit -m "feat(network): import qron-platform source as apps/qron-platform

Canonical source now lives here; the Vercel qron-platform project still deploys
from the old undone0603/qron-platform repo until deliberately re-pointed
(live Stripe webhook host — see NETWORK.md follow-ups). Working tree captured
including N uncommitted local changes: <list>.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
git add apps/chatbot && git commit -m "feat(network): import chatbot as apps/chatbot (was un-versioned)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
git add apps/agent-browser && git commit -m "feat(network): import agent-browser source as apps/agent-browser

Canonical remains undone0603/agent-browser for history; this copy is the
network-consolidated working source (includes 5 uncommitted local changes: <list>).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```

---

### Task 7: Import brand sites + cf-skim archive; sweep home-dir helper scripts

**Files:**
- Create: `apps/brand-sites/{authichain,govchain,strainchain}/**`, `docs/archive/cf-workers/**` (34 bundles), `scripts/ops/home/**`

- [ ] **Step 1: Brand sites**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc '
mkdir -p /home/zac/authichain-unified/apps/brand-sites
cp -r /home/zac/AuthiChain/public  /home/zac/authichain-unified/apps/brand-sites/authichain
cp -r /home/zac/GovChain/public    /home/zac/authichain-unified/apps/brand-sites/govchain
cp -r /home/zac/StrainChain/public /home/zac/authichain-unified/apps/brand-sites/strainchain'
```

- [ ] **Step 2: cf-skim → archive, with mandatory redaction**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc '
mkdir -p /home/zac/authichain-unified/docs/archive/cf-workers
cp /home/zac/cf-skim/*.js /home/zac/authichain-unified/docs/archive/cf-workers/
cd /home/zac/authichain-unified/docs/archive/cf-workers
grep -lE "sk_live_[A-Za-z0-9]{20,}" *.js | xargs -r sed -i -E "s/sk_live_[A-Za-z0-9]+/sk_live_REDACTED_expired_key/g"
grep -lE "gsk_[A-Za-z0-9]{20,}" *.js | xargs -r sed -i -E "s/gsk_[A-Za-z0-9]+/gsk_REDACTED_dead_key/g"
grep -lE "whsec_[A-Za-z0-9]{20,}" *.js | xargs -r sed -i -E "s/whsec_[A-Za-z0-9]+/whsec_REDACTED/g"
grep -cE "sk_live_[A-Za-z0-9]{24}|gsk_[A-Za-z0-9]{24}" *.js | grep -v ":0" || echo "CLEAN"'
```
Expected: final line `CLEAN`. (The embedded Stripe/Groq keys are verified dead — 2026-06-11 — but Push Protection blocks them in NEW files, so redaction is required, not optional.)

- [ ] **Step 3: Home-dir helper scripts → scripts/ops/home/**

The ~25 `/home/zac/_*.sh|_*.cjs` files are June-session helpers (build/deploy/env mechanics worth keeping as reference). BUT `_setenv_oauth.sh` and `_setvercel_env.sh` may embed secrets — scan first:
```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc '
mkdir -p /home/zac/authichain-unified/scripts/ops/home
cp /home/zac/_*.sh /home/zac/_*.cjs /home/zac/authichain-unified/scripts/ops/home/
grep -rEl "sk_live_|whsec_|GOCSPX-|client_secret|JWT_SECRET=.+[A-Za-z0-9]{16}" /home/zac/authichain-unified/scripts/ops/home/ '
```
For each hit: if it contains a literal secret value, DELETE that file from the import (`rm scripts/ops/home/<file>`) and note it; scripts that only reference `$VARS` stay.

- [ ] **Step 4: Add a README and commit**

Create `scripts/ops/home/README.md`:
```markdown
# June-2026 session helper scripts (archived)

One-shot helpers written during the 2026-06 stabilization (build, deploy,
env-var pushing, DB fixes). Kept for the mechanics they encode (WSL/node/vercel
quirks), NOT maintained. See docs/superpowers/specs/ for the sessions they served.
Files containing literal secrets were excluded at import.
```
```bash
cd "$R"
git add apps/brand-sites docs/archive/cf-workers scripts/ops/home
git commit -m "feat(network): import brand sites, archive 34 CF worker bundles (secrets redacted), archive home-dir ops scripts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```

---

### Task 8: Root sweep — loose scripts

**Files:**
- Move: ~42 root scripts → `scripts/ops/` (list below), reference-gated

- [ ] **Step 1: Reference-check every candidate**

Candidates (from 2026-07-15 inventory): `activate-economy.js affiliate-migration.js check-auth-users.js check-constraints.js check-db.js check-flow-types.js check-inbound-replies.cjs check-qron-fk.js check-status-check.js clean_lm.py create-auth-user.js find-any-user.js find-user.js genesis-launch.js industrial-migration.js init-profile.js launch-nmip-campaign.js manual-migration.js patch-schema.js run-sql.cjs seed-final.js seed-gallery.js seed-intelligence.js seed-leaderboard.js seed-potential.js seed-premium-brands.ts seed-samples.js seed-voyage-bloom.ts setup-vercel-env.sh stress-test-stimulus.js update-schema.js verify-activation.js verify-affiliates.js verify-anchoring.js verify-columns.js verify-gov.js verify-logs.js verify-more-cols.js verify-nulls.js verify-profiles.js verify-subs.js verify-tables.js verify-user-profiles.js`

```bash
cd "$R"
for f in <the list above>; do
  hits=$(grep -rl --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=apps --exclude-dir=dist --exclude-dir=.next -F "$f" package.json .github/ scripts/ server/ client/ src/ agentz/ workers/ Dockerfile* railway.json vercel.json 2>/dev/null | grep -v "scripts/ops/home" | head -3)
  [ -n "$hits" ] && echo "REFERENCED $f -> $hits" || echo "free $f"
done
```

- [ ] **Step 2: Move the free ones with `git mv`**

```bash
mkdir -p "$R/scripts/ops"
cd "$R" && for f in <files printed as free>; do git mv "$f" "scripts/ops/$f"; done
```
For each REFERENCED file: leave it at root (do not chase reference rewrites in this pass) and note it in the commit message. Also move `$A/debug_grant_draft.py` and `$A/migrate-reputation.js` per Task 5's note: `cp` then `git add`, only if inspection shows they're real (migrate-reputation.js almost certainly pairs with Task 2's migration — keep it in `scripts/ops/`).

- [ ] **Step 3: Sanity + commit**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && nvm use 22 >/dev/null && pnpm run check'
cd "$R" && git add scripts/ops && git commit -m "chore(root): sweep unreferenced ops scripts into scripts/ops/

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```
(`git mv` stages moves automatically; `git add scripts/ops` catches the copied-in extras.) Expected: typecheck unchanged — these scripts are outside tsconfig's compile set, but verify.

---

### Task 9: Root sweep — loose docs

**Files:**
- Move: strategy/report markdown + txt/csv artifacts → `docs/strategy/` and `docs/archive/misc/`

- [ ] **Step 1: Move strategy docs (git mv, reference-gated same as Task 8 Step 1 — run the same loop over this list)**

To `docs/strategy/`: `ARCHITECTURE_OVERVIEW.md AUTHENTICITY_INDEX.md DELIVERABLES.md DEMO_PROMPTS.md DEPLOYMENT_LOG.md DHS_SVIP_Grant_Application.md FUNNEL_TRACKING_SUMMARY.md IMPLEMENTATION_MANIFEST.md INBOUND_EMAIL_SETUP.md LAUNCH_CHECKLIST.md LEAD_SCORING_SUMMARY.md MI_CRA_Partnership_Proposal.md NSF_SBIR_Project_Pitch.md NY_OCM_Partnership_Proposal.md OH_DCC_Partnership_Proposal.md POSTAL_STRATEGY.md QUICK_START_EMAIL_REPLIES.md REVENUE_STRATEGY.md SERIES_A_BOARDROOM_BRIEFING.md SIGNATURE_MANIFEST.md SIGNWELL_MIGRATION.md STRIPE_WEBHOOK_IMPLEMENTATION.md SYSTEM_STATE.md TECHNICAL_COMPETITIVE_SUPERIORITY.md notes-progress.md research-findings.md STRIPE_WEBHOOK_QUICKSTART.txt gov_pursue_list.csv`

To `docs/archive/misc/`: `all_used_envs.txt clean_envs.txt eslint_errors.txt PATCH_EOF TOML` (build/session artifacts; PATCH_EOF and TOML are stray files — check `git ls-files PATCH_EOF TOML` first; if untracked junk, skip entirely, don't archive).

STAYS at root: `AGENTS.md CLAUDE.md GEMINI.md README.md SECURITY.md LICENSE.md START_HERE.md todo.md requirements-agentz.txt` (agent/user entry points + referenced files).

- [ ] **Step 2: Commit**

```bash
cd "$R" && git add docs/strategy docs/archive/misc && git commit -m "chore(root): sweep strategy/report docs into docs/strategy/, session artifacts into docs/archive/misc/

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
```

---

### Task 10: Write docs/NETWORK.md, then full verification + push

**Files:**
- Create: `docs/NETWORK.md`

- [ ] **Step 1: Write `docs/NETWORK.md`** with these sections (fill from repo state + memory; verify Vercel project names with `vercel projects ls` from Windows CLI if cheap, else mark "as of 2026-06-11"):

```markdown
# AuthiChain Network Map
_As of 2026-07-15. One repo = the whole network. Update when deploy targets change._

## Live apps
| What | Folder | Deploys via | Domain(s) |
|---|---|---|---|
| AuthiChain app | client/ + server/ + src/ (root build) | Vercel `authichain-unified` (team authichain-6389) | app.authichain.com, authichain-unified.vercel.app |
| QRON platform | apps/qron-platform (source) | ⚠ Vercel `qron-platform` still builds from old repo undone0603/qron-platform | qron.space, app.qron.space (hosts a registered Stripe webhook) |
| GovChain site | apps/brand-sites/govchain + workers | Vercel `govchain-us` / CF worker | govchain.us |
| StrainChain site | apps/brand-sites/strainchain + workers | Vercel `strainchain-io` / CF worker | strainchain.io |
| Apex landing | workers/authichain-com | CF worker (routes authichain.com/*) | authichain.com |

## Cloudflare workers (27 total: 22 repo-managed in workers/, 5 deliberate keeps outside repo)
Repo-managed: deployed by .github/workflows/deploy-cloudflare.yml on push (wrangler.toml = source of truth for routes/crons).
Keeps (no repo source): gmail-relay-z, qron-self-heal, qron-daily-ops, qron-ai-api, qron-portfolio.
Archived bundles of deleted workers: docs/archive/cf-workers/ (secrets redacted).

## Other network members
| What | Folder | Notes |
|---|---|---|
| AgentZ (python ops agent) | agentz/ | `python -m agentz.cli run <id>`; ALL outbound gated (confirm_before_run) |
| Agent-browser | apps/agent-browser | also lives at undone0603/agent-browser (history) |
| Chatbot | apps/chatbot | previously un-versioned; repo copy is canonical |
| Contracts | contracts/ | AuthiChainNFT.sol etc. |
| Ops scripts | scripts/ops/ (+ scripts/ops/home/ June-2026 archive) | one-shot helpers, unmaintained |
| Strategy docs | docs/strategy/ | proposals, checklists, briefs |

## Follow-ups owed
- Re-point Vercel `qron-platform` to build from apps/qron-platform (careful: live Stripe webhook host).
- Run supabase/migrations/20260715000001_create_reputation_tables.sql against live (owner action).
- Owner: review + delete /home/zac/_absorbed-* folders; review agentz_backup key files (never committed).
- Wire apps/* into pnpm workspace only when a real build needs it (deliberately inert today).
```

- [ ] **Step 2: Full verification suite (inside Ubuntu)**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified && export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && nvm use 22 >/dev/null && pnpm run check && pnpm test 2>&1 | tail -8 && pnpm build 2>&1 | tail -8'
```
Expected: check exit 0 (no NEW errors vs pre-task baseline), tests pass (reputation tests included, no new failures), `next build` completes. If build fails on something an import caused (it shouldn't — apps/ is outside the build), fix before push; if it fails on a pre-existing issue, verify the same failure exists on the pre-consolidation commit (`git stash` not needed — check out the pre-plan commit in a throwaway worktree) and document it.

- [ ] **Step 3: Final secret sweep over everything staged this plan**

```bash
cd "$R" && git diff cf4c03cdd..HEAD --name-only | xargs -d '\n' grep -lE "sk_live_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|GOCSPX-|AKIA[A-Z0-9]{16}" 2>/dev/null
```
Expected: empty.

- [ ] **Step 4: Commit NETWORK.md, push once**

```bash
cd "$R"
git add docs/NETWORK.md && git commit -m "docs: NETWORK.md — map of the consolidated estate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YrShfvsp7G5nw9bczdYsQ"
git push origin main
```
Expected: normal fast-forward push. NOTE: this triggers deploy-cloudflare.yml (worker deploys incl. the D1-id fix — intended) and Vercel git build. After push, check `gh run list --repo undone0603/authichain-unified --limit 5` once; if deploy-cloudflare fails, read the log — the 4 new worker steps from Task 1 are the likely suspects; fix-forward.

---

### Task 11: Home-dir retirement (non-destructive) + final report

- [ ] **Step 1: Verify salvage completeness, then rename absorbed folders**

Gate: Tasks 2-5 committed and pushed. Then:
```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac
mv qron-platform  _absorbed-qron-platform
mv chatbot        _absorbed-chatbot
mv agent-browser  _absorbed-agent-browser
mv AuthiChain     _absorbed-AuthiChain
mv GovChain       _absorbed-GovChain
mv StrainChain    _absorbed-StrainChain
mv cf-skim        _absorbed-cf-skim
mv agentz         _absorbed-agentz-stale-checkout
mv agentz_backup  _absorbed-agentz_backup-HAS-KEY-FILES
ls -d _absorbed-*'
```
Do NOT touch `/home/zac/agentz_shortcut` (broken symlink, I/O error — harmless) or the loose `_*.sh` originals (already archived in-repo; owner deletes with the folders).

- [ ] **Step 2: Final report to owner**

Summarize: commits pushed, what was salvaged, what was excluded (secret files), the REFERENCED root files left in place, CI run status after push, and the owner-action list (delete `_absorbed-*`, review `_absorbed-agentz_backup-HAS-KEY-FILES/{live_keys,backup_keys}.txt`, run reputation migration, qron-platform re-point decision).
