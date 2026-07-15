# AuthiChain Network Consolidation — Design

**Date:** 2026-07-15
**Status:** Approved by owner (scope, salvage, qron handling, structure all confirmed via Q&A)

## Goal

`authichain-unified` becomes the single home for the whole estate ("one network"):
every sibling project under `/home/zac/` lives inside the repo, the repo root is
clean, and one document maps the network. The live Vercel deploy is not disturbed —
all changes are additive; deployed paths do not move.

## Context (verified 2026-07-15)

- Repo `main` @ 10328d952 (2026-07-13), actively developed; builds with `next build`
  (`package.json` + `vercel.json`); 11 pre-existing dirty worktree files must not be
  clobbered or committed.
- `/home/zac/agentz` and `/home/zac/agentz_backup` are **stale checkouts of
  authichain-unified itself** on the legacy (pre-2026-06-11) history. `agentz` has
  53 uncommitted changes containing work absent from current main (reputation
  system, OpsDashboard, reinvestment handler, resilience loop, agentz core edits).
- `/home/zac/qron-platform` is its own GitHub repo (undone0603/qron-platform),
  deployed on Vercel serving qron.space + app.qron.space, hosting a registered
  Stripe webhook.
- `/home/zac/{chatbot, agent-browser}` are standalone projects (agent-browser has
  its own GitHub repo; chatbot has no git).
- `/home/zac/{AuthiChain, GovChain, StrainChain}` are static brand sites (each a
  single `public/` folder).
- `/home/zac/cf-skim` = 34 downloaded Cloudflare worker bundles; the repo's
  `docs/archive/cf-workers/` from June no longer exists on current main.
- `/home/zac/agentz_backup` contains `live_keys.txt` / `backup_keys.txt` — secrets
  on disk, must never be committed.

## Decisions (owner-approved)

1. **Scope:** consolidate siblings AND sweep the repo root ("Both").
2. **Stale agentz checkout:** salvage the unmerged work into current main, adapted
   to today's structure; then retire the checkout.
3. **qron-platform:** copy source into the monorepo as the new canonical home;
   the existing Vercel project keeps deploying from the old repo. Re-pointing the
   deploy is a separate follow-up (live Stripe webhook — do not touch now).
4. **Structure:** additive + root sweep. Deployed paths (`client/`, `server/`,
   `shared/`, `workers/`, `agentz/`, `src/`, root build configs) do not move.

## Target layout

```
authichain-unified/
├── client/ server/ shared/ src/      (unchanged — live app)
├── workers/ agentz/ contracts/ …     (unchanged)
├── apps/
│   ├── qron-platform/                (from /home/zac/qron-platform)
│   ├── chatbot/                      (from /home/zac/chatbot)
│   ├── agent-browser/                (from /home/zac/agent-browser)
│   └── brand-sites/
│       ├── authichain/  govchain/  strainchain/
├── scripts/
│   └── ops/                          (unreferenced loose root *.js/*.cjs/*.sh)
├── docs/
│   ├── strategy/                     (loose root strategy/report *.md)
│   ├── archive/cf-workers/           (34 bundles from /home/zac/cf-skim)
│   └── NETWORK.md                    (estate map)
└── package.json, next.config.js, …   (build files stay at root)
```

## Components

### 1. Imports under `apps/`
Copy each sibling excluding `node_modules/`, `.git/`, build outputs (`dist/`,
`.next/`, `*.tsbuildinfo`), logs, venvs, and any `.env*`/key/credential files.
Secret-scan (grep for `sk_live`, `whsec_`, `AKIA`, `-----BEGIN`, `api_key`-shaped
literals) before staging each import.

### 2. Salvage from stale `agentz/` checkout
Port into current main, adapting to today's schema/structure:
- `server/routers/reputation.ts` + `server/reputation.test.ts` (+ router wiring)
- `supabase/migrations/00002_create_reputation_tables.sql` (renumber to next free slot)
- `client/src/pages/OpsDashboard.tsx` (+ route registration)
- `agentz/workflows/handlers/reinvestment_handler.py` (+ registry.yaml entry)
- `scripts/resilience_loop.py`, `agentz/core/resilience.py`
- Modified agentz core files — diff file-by-file against current main; take only
  real changes that still apply
- Docs: `docs/decoupling.md`, `docs/config-standardization.md`,
  `docs/platform-robustness.md`, `MONUMENTAL_RELEASE.md`/`WORKSPACE.md` → `docs/strategy/`
Migration file is committed but NOT run against live Supabase (schema changes to
prod need explicit owner action, consistent with June policy).
`pnpm check` must remain green after porting; reputation tests must pass.

### 3. Root sweep (reference-checked)
For each loose root `*.js/*.cjs/*.sh` (~40 files: seed-*, verify-*, check-*,
fix-*, *-migration.js, run-sql.cjs, setup-*, launch-*, stress-test-*, …):
grep package.json, `.github/workflows/`, and source for references.
- Unreferenced → `scripts/ops/`
- Referenced → stays, or moves with the reference updated in the same commit
Loose strategy/report `*.md` (~25 files: REVENUE_STRATEGY.md, grant/proposal docs,
SERIES_A_*, LAUNCH_CHECKLIST.md, …) → `docs/strategy/`. `CLAUDE.md`, `AGENTS.md`,
`GEMINI.md`, `README.md`, `SECURITY.md`, `LICENSE.md`, `START_HERE.md` stay at root.
Build/config files at root are out of scope for the sweep.

### 4. `docs/NETWORK.md`
Estate map: every app/site/service/worker; where it deploys (Vercel project,
CF worker, domain); which repo folder owns it; deploy mechanics pointers.

### 5. Home-dir cleanup (non-destructive)
After each import is committed: rename the source folder to `_absorbed-<name>`.
Owner deletes at leisure. `agentz_backup/` is only renamed and flagged — its key
files need owner review. The stale `agentz/` checkout is renamed only after
salvage is verified complete.

## Error handling / safety rails

- Stage paths explicitly, never `git add -A` (CRLF noise rule from June).
- The 11 pre-existing dirty files are untouched and never staged.
- No secrets committed; secret-scan gate per import.
- `pnpm check` + `pnpm build` green (run inside Ubuntu with nvm node 22 per
  [[authichain-build-env]]) before any push.
- Push to `main` as normal commits; no force, no history rewrite.
- Nothing deployed, no crons touched, no outbound fired.

## Testing / verification

1. `pnpm check` green; `pnpm test` — reputation tests pass, no new failures.
2. `pnpm build` green.
3. `git status` shows only the intended dirty files remaining (the pre-existing 11).
4. Every import folder diff-verified against its source (file count + spot checks).
5. NETWORK.md cross-checked against live `vercel projects ls` / worker list where cheap.

## Out of scope (follow-ups, documented in NETWORK.md)

- Re-pointing the qron-platform Vercel project to the monorepo.
- Running the reputation Supabase migration against live.
- Deleting the `_absorbed-*` folders and reviewing agentz_backup keys (owner).
- pnpm-workspace integration of `apps/*` into the root build (imports are inert
  source until wired deliberately).
