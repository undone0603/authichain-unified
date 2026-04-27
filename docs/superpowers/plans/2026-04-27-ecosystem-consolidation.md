# Ecosystem Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `authichain-unified` the clean canonical repo by deleting orphaned dirs, reconciling the worker fleet against deployed reality, salvaging high-value code from the `authichain` Next.js sibling, and archiving the dead `authichain-mobile` skeleton.

**Architecture:** Five sequential phases. Phase 0 is investigation only (no code changes) and produces a worker-status table that gates Phase 3. Phases 1–2 are independent of Phase 4 and can run in any order after Phase 0. Each task is one PR — independently reviewable, independently revertable with `git revert`.

**Tech Stack:** pnpm 10, Node 22, Vite, tsx, esbuild, Cloudflare wrangler, Drizzle ORM, Vitest. Project commands: `pnpm dev`, `pnpm build`, `pnpm check` (= `tsc --noEmit`), `pnpm test` (= `vitest run`).

**Source spec:** `docs/superpowers/specs/2026-04-27-ecosystem-consolidation-design.md` (commit `c9f0656`).

---

## File Structure

This plan touches structure across the repo. The destinations established here are referenced in later tasks.

**Doomed files (deleted by the plan):**
- `app/globals.css`, `app/layout.tsx` — orphaned Next.js leftovers
- `src/` (top-level) — orphan, pending P0.3 confirmation
- (Possibly) some `workers/<name>/` subdirs — only after Phase 0 marks them PHANTOM

**Files moved by the plan:**
- `components/ecosystem-footer.tsx` → `client/src/components/ecosystem/footer.tsx`
- `components/ecosystem-nav.tsx` → `client/src/components/ecosystem/nav.tsx`
- `lib/ecosystem.ts` → `client/src/lib/ecosystem.ts` (or `shared/ecosystem.ts` if server uses it; decided in P0.4)
- `lib/industries.ts` → `client/src/lib/industries.ts` (or `shared/industries.ts`)

**New files created by the plan:**
- `docs/superpowers/plans/2026-04-27-ecosystem-consolidation.md` (this file)
- `docs/superpowers/plans/worker-status-2026-04-27.md` (Phase 0 output — worker reality table)
- `docs/superpowers/plans/lift-log-2026-04-27.md` (Phase 4 lift provenance log)
- One new salvage file per Phase-4 lift (paths listed in each Phase-4 task)
- New tests under `client/src/__tests__/` or `server/_core/__tests__/` per lift

**Files modified across multiple PRs:**
- `CLAUDE.md` — Phase 1.2 corrects the "8 workers" claim
- `.git/config` — Phase 1.3 may remove dead remotes (no commit needed; local only)

---

## Conventions used by every task

- **Working directory** is always `C:\Users\rac\authichain-unified` unless the task says otherwise.
- **Git workflow:** create a branch named `consolidate/<phase>-<short-name>`, commit, push, open PR. The plan shows the branch + commit; the engineer opens the PR with `gh pr create`.
- **Verification gate:** every PR must pass `pnpm check && pnpm build` before merge. UI moves additionally need a manual browser smoke check.
- **Reversibility note:** each PR is one logical change. Do not bundle.

---

# PHASE 0 — INVESTIGATION (no code changes)

Output: a written worker-status table + answers to three structural questions. Phase 3 cannot run safely without this.

## Task 0.1: Set up the Phase 0 output document

**Files:**
- Create: `docs/superpowers/plans/worker-status-2026-04-27.md`

- [ ] **Step 1: Create the empty status doc with required sections**

```bash
cat > docs/superpowers/plans/worker-status-2026-04-27.md <<'EOF'
# Worker Fleet Reality — Phase 0 Output

**Date:** 2026-04-27

## Question 1: For each `workers/<name>/` subdir, is it DEPLOYED, SCAFFOLDED, or PHANTOM?

| Dir | Declared name | Status | Last deploy | Notes |
|---|---|---|---|---|

## Question 2: Are the three "remote forks" empty?

| Remote | Last commit | Unique content? | Action |
|---|---|---|---|

## Question 3: Is top-level `src/` orphaned?

(Output of `grep -rn "from .*['\"]\\.\\./\\.\\./src" client/ server/ worker/ workers/`)

## Question 4: Where does `lib/ecosystem.ts` and `lib/industries.ts` get imported from?

(Output of `grep -rn "from.*['\"].*lib/ecosystem\|lib/industries" client/ server/ worker/ workers/`)
EOF
```

- [ ] **Step 2: Commit the scaffold**

```bash
git checkout -b consolidate/p0-scaffold
git add docs/superpowers/plans/worker-status-2026-04-27.md
git commit -m "docs(consolidation): scaffold Phase 0 worker-status output"
git push -u origin consolidate/p0-scaffold
```

Open PR. Merge after the rest of Phase 0 fills it in (Tasks 0.2–0.5).

---

## Task 0.2: Inventory worker deployments (P0.1)

**Files:**
- Modify: `docs/superpowers/plans/worker-status-2026-04-27.md` (Question 1 table)

- [ ] **Step 1: For each of the 20 worker dirs, query Cloudflare**

Run this inside the repo root. Requires `wrangler` CLI authenticated (`wrangler whoami` returns an account).

```bash
for d in workers/*/; do
  name=$(grep -E "^name" "$d/wrangler.toml" | sed -E 's/name *= *"([^"]+)"/\1/')
  echo "=== $d ($name) ==="
  wrangler deployments list --name "$name" 2>&1 | head -5
done | tee /tmp/worker-deploys.txt
```

Expected: each block shows either deployment list with timestamps, or `Worker not found`.

- [ ] **Step 2: Classify each worker**

Read `/tmp/worker-deploys.txt`. For each:
- Has deploys in last 90 days → **DEPLOYED**
- Worker exists in Cloudflare but no recent deploy → **DEPLOYED-STALE** (treat as DEPLOYED for safety)
- `Worker not found` AND `wc -l workers/<name>/src/*.ts` shows >50 LOC → **SCAFFOLDED**
- `Worker not found` AND <50 LOC or empty `src/` → **PHANTOM**

- [ ] **Step 3: Fill Question 1 of the status doc**

Edit `docs/superpowers/plans/worker-status-2026-04-27.md`. Populate the Question 1 table with one row per dir, e.g.:

```
| authichain-api | authichain-api | DEPLOYED | 2026-04-15 | active production |
| qron-image-gen | qron-image-gen | PHANTOM | never | empty src/, delete in P3.1 |
```

- [ ] **Step 4: Commit on a Phase-0 branch**

```bash
git checkout -b consolidate/p0-worker-inventory
git add docs/superpowers/plans/worker-status-2026-04-27.md
git commit -m "docs(consolidation): P0.1 worker deployment inventory"
git push -u origin consolidate/p0-worker-inventory
```

---

## Task 0.3: Investigate "remote forks" (P0.2)

**Files:**
- Modify: `docs/superpowers/plans/worker-status-2026-04-27.md` (Question 2 table)

- [ ] **Step 1: Inspect each remote**

```bash
for fork in confident-germain stupefied-almeida sweet-liskov; do
  echo "=== AuthiChain/$fork ==="
  gh api "repos/AuthiChain/$fork" --jq '{pushed_at, size, default_branch, description}' 2>&1 || echo "NOT FOUND"
done
```

Expected: JSON for each, or `NOT FOUND`. Note `pushed_at` and `size` (KB).

- [ ] **Step 2: Diff each against `main`**

```bash
git fetch AuthiChain/confident-germain 2>/dev/null
git log --oneline main..AuthiChain/confident-germain/HEAD 2>&1 | head -20
# repeat for stupefied-almeida and sweet-liskov
```

Expected: list of commits unique to the fork, or empty / branch-not-found.

- [ ] **Step 3: Fill Question 2 of the status doc**

For each remote, mark `Unique content?` as `YES` (with summary) or `NO`, and `Action` as `KEEP` (rare) or `REMOVE`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/worker-status-2026-04-27.md
git commit -m "docs(consolidation): P0.2 remote-fork inventory"
git push
```

---

## Task 0.4: Confirm top-level `src/` orphan (P0.3)

**Files:**
- Modify: `docs/superpowers/plans/worker-status-2026-04-27.md` (Question 3)

- [ ] **Step 1: Verify `src/` exists and inventory it**

```bash
ls -la src/ 2>&1 || echo "no top-level src/"
find src -type f 2>/dev/null | head -20
```

- [ ] **Step 2: Search for imports targeting it**

The `@/` alias resolves to `client/src/` per `vite.config.ts:159`, so we need to look for paths that escape into `../src` or absolute `src/`.

```bash
grep -rn "from ['\"][^'\"]*\\.\\./src\\b" client/ server/ worker/ workers/ 2>/dev/null | head -40
grep -rn "from ['\"]src/" client/ server/ worker/ workers/ 2>/dev/null | head -40
```

Expected: empty (= orphan confirmed) or specific import sites (= NOT orphan, plan changes needed).

- [ ] **Step 3: Record findings in Question 3 of status doc**

If empty: write `CONFIRMED ORPHAN — safe to delete in Task 1.4.` If imports found: list them and add `BLOCKED — top-level src/ is in use; remove from plan.`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/worker-status-2026-04-27.md
git commit -m "docs(consolidation): P0.3 top-level src orphan check"
git push
```

---

## Task 0.5: Inventory `lib/ecosystem.ts` + `lib/industries.ts` import sites (P0.4)

**Files:**
- Modify: `docs/superpowers/plans/worker-status-2026-04-27.md` (Question 4)

- [ ] **Step 1: Grep for imports**

```bash
grep -rn "from ['\"][^'\"]*lib/ecosystem\|from ['\"][^'\"]*lib/industries" \
  client/ server/ worker/ workers/ shared/ 2>/dev/null | tee /tmp/lib-imports.txt
```

- [ ] **Step 2: Decide target dir based on consumers**

Apply this rule:
- All imports from `client/` only → target is `client/src/lib/`
- Any imports from `server/` or `worker/` → target is `shared/` (create if needed)

- [ ] **Step 3: Record decision in Question 4 of status doc**

Include the import-site list and the chosen target dir. Phase 2.2 will use this.

- [ ] **Step 4: Commit + open the Phase-0 PR for review**

```bash
git add docs/superpowers/plans/worker-status-2026-04-27.md
git commit -m "docs(consolidation): P0.4 lib import inventory + finalize Phase 0"
git push
gh pr create --title "consolidate(P0): worker + structure investigation" \
  --body "Phase 0 of the ecosystem consolidation. No code changes — only investigation output. Gates Phase 3 (worker decisions). See docs/superpowers/plans/worker-status-2026-04-27.md."
```

---

# PHASE 1 — TRIVIAL CLEANUPS (LOW risk)

After Phase 0 PR merges, these can run in parallel.

## Task 1.1: Delete orphaned `app/` directory (PR C1)

**Files:**
- Delete: `app/globals.css`, `app/layout.tsx`, `app/`

- [ ] **Step 1: Confirm orphan one more time before deletion**

```bash
ls app/
# expected: globals.css   layout.tsx
grep -rn "from ['\"][^'\"]*\\.\\./app\\|from ['\"]app/" client/ server/ worker/ workers/ 2>/dev/null
# expected: empty output
grep -rn "['\"]app/globals\\.css\\|app/layout" . --include="*.json" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules
# expected: empty output
```

If any grep returns results, STOP and add a follow-up task — `app/` is not orphaned.

- [ ] **Step 2: Branch and delete**

```bash
git checkout -b consolidate/p1-delete-app
git rm -r app/
```

- [ ] **Step 3: Verify build still works**

```bash
pnpm check
pnpm build
```

Expected: both succeed. If `pnpm check` fails, restore (`git restore --staged app/ && git checkout app/`) and STOP.

- [ ] **Step 4: Commit + push + PR**

```bash
git commit -m "consolidate(p1): delete orphaned app/ directory

Two files (globals.css, layout.tsx) not referenced by any build config
or import. Confirmed orphan via Phase 0 grep."
git push -u origin consolidate/p1-delete-app
gh pr create --title "consolidate(p1): delete orphaned app/ directory" \
  --body "Closes the orphan. \`pnpm check && pnpm build\` pass. One file deletion, fully revertable."
```

---

## Task 1.2: Correct the CLAUDE.md "8 workers" claim (PR C5)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read current text**

```bash
grep -n "Workers\|workers" CLAUDE.md | head -10
```

Locate the line that says `8 specialized Cloudflare Workers (Hub, Studio, API, Automation)`.

- [ ] **Step 2: Branch and rewrite**

```bash
git checkout -b consolidate/p1-claude-md-workers
```

Replace the misleading line with text that matches reality. Use the worker-status table from Phase 0 as the source of truth. Suggested replacement:

```markdown
- **Edge**: 1 production Cloudflare Worker (`worker/index.ts`, deployed by `.github/workflows/deploy-cloudflare.yml`) plus N standalone worker projects under `workers/<name>/` (see `docs/superpowers/plans/worker-status-2026-04-27.md` for status of each). Multi-tenant brand routing via Host-header dispatch.
```

Substitute `N` with the actual deployed-or-scaffolded count from Phase 0.

- [ ] **Step 3: Commit + push + PR**

```bash
git add CLAUDE.md
git commit -m "consolidate(p1): correct CLAUDE.md worker-fleet claim

Was: '8 specialized Cloudflare Workers (Hub, Studio, API, Automation)'
Now: matches actual deployed surface per Phase 0 inventory.

Refs docs/superpowers/plans/worker-status-2026-04-27.md"
git push -u origin consolidate/p1-claude-md-workers
gh pr create --title "consolidate(p1): correct CLAUDE.md worker claim" \
  --body "Doc-only fix. The previous claim has drifted from reality."
```

---

## Task 1.3: Remove dead remotes (PR C-remotes — only if Phase 0 confirms empty)

**Skip this task entirely if Question 2 of the worker-status doc marks any fork as `KEEP`.**

**Files:** none (local git config only — but document the change)

- [ ] **Step 1: Verify each remote is `REMOVE` per Phase 0**

```bash
grep "Action" docs/superpowers/plans/worker-status-2026-04-27.md
```

Expect: all three remote-fork rows show `REMOVE`.

- [ ] **Step 2: Remove each remote locally + on origin**

This is a local-config change; it does NOT need a branch or PR. But announce it in the team chat (out of band) before running:

```bash
git remote remove AuthiChain/confident-germain 2>/dev/null
git remote remove AuthiChain/stupefied-almeida 2>/dev/null
git remote remove AuthiChain/sweet-liskov 2>/dev/null
git remote -v
```

Expected: only `origin` remains (and any other intentional remotes).

- [ ] **Step 3: Optional — archive each fork on GitHub**

Only if you have admin on the `AuthiChain` org and the fork shows no unique content:

```bash
gh repo archive AuthiChain/confident-germain
gh repo archive AuthiChain/stupefied-almeida
gh repo archive AuthiChain/sweet-liskov
```

Skip this step if you do not have admin or are unsure.

- [ ] **Step 4: Document the action**

```bash
git checkout -b consolidate/p1-remote-cleanup
cat >> docs/superpowers/plans/worker-status-2026-04-27.md <<'EOF'

## Phase 1.3 outcome

Removed dead local remotes: confident-germain, stupefied-almeida, sweet-liskov.
GitHub repos: <archived | left untouched — note which>.
EOF
git add docs/superpowers/plans/worker-status-2026-04-27.md
git commit -m "consolidate(p1): document removal of dead remotes"
git push -u origin consolidate/p1-remote-cleanup
gh pr create --title "consolidate(p1): document dead-remote removal" \
  --body "Local git remotes for empty AuthiChain forks removed. Doc-only commit."
```

---

## Task 1.4: Delete top-level `src/` (PR C2 — only if Phase 0 confirmed orphan)

**Skip this task entirely if Question 3 of the status doc says `BLOCKED — top-level src/ is in use`.**

**Files:**
- Delete: `src/` (top-level only — NOT `client/src/`)

- [ ] **Step 1: Final orphan verification**

```bash
grep -rn "from ['\"][^'\"]*\\.\\./src\\b\|from ['\"]src/" \
  client/ server/ worker/ workers/ shared/ 2>/dev/null
```

Expected: empty.

- [ ] **Step 2: Branch and delete**

```bash
git checkout -b consolidate/p1-delete-toplevel-src
git rm -r src/
```

- [ ] **Step 3: Verify build**

```bash
pnpm check
pnpm build
```

Expected: both succeed.

- [ ] **Step 4: Commit + push + PR**

```bash
git commit -m "consolidate(p1): delete orphaned top-level src/

Confirmed unreferenced in Phase 0 (P0.3). The active source root
remains client/src/ (aliased as @/ via vite.config.ts)."
git push -u origin consolidate/p1-delete-toplevel-src
gh pr create --title "consolidate(p1): delete orphaned top-level src/" \
  --body "Phase 0 confirmed no imports target this path. Build passes."
```

---

# PHASE 2 — INTERNAL CONSOLIDATION (LOW–MED risk)

## Task 2.1: Move `components/` into `client/src/components/ecosystem/` (PR C3)

**Files:**
- Move: `components/ecosystem-footer.tsx` → `client/src/components/ecosystem/footer.tsx`
- Move: `components/ecosystem-nav.tsx` → `client/src/components/ecosystem/nav.tsx`
- Modify: every file that imports either component

- [ ] **Step 1: Branch and inventory imports**

```bash
git checkout -b consolidate/p2-fold-components
grep -rn "ecosystem-footer\|ecosystem-nav" \
  client/ server/ worker/ workers/ shared/ 2>/dev/null | tee /tmp/eco-imports.txt
```

Save the output — every line is a file you'll edit in Step 3.

- [ ] **Step 2: Move files**

```bash
mkdir -p client/src/components/ecosystem
git mv components/ecosystem-footer.tsx client/src/components/ecosystem/footer.tsx
git mv components/ecosystem-nav.tsx client/src/components/ecosystem/nav.tsx
rmdir components/ 2>/dev/null  # only succeeds if empty
```

- [ ] **Step 3: Update each import**

For every file in `/tmp/eco-imports.txt`, change the import path. The two cases:

- `from "../../components/ecosystem-footer"` → `from "@/components/ecosystem/footer"`
- `from "../../components/ecosystem-nav"` → `from "@/components/ecosystem/nav"`

(`@/` resolves to `client/src/` per `vite.config.ts:159`.)

Use Edit tool per file, or sed for the common case:

```bash
# preview first
grep -rln "components/ecosystem-footer\|components/ecosystem-nav" client/ server/
# then edit each file from the preview manually with Edit tool
```

- [ ] **Step 4: Verify**

```bash
pnpm check
pnpm build
```

Expected: both pass.

- [ ] **Step 5: Manual smoke check**

```bash
pnpm dev
```

Open `http://localhost:5173` (or whatever vite reports), confirm the ecosystem nav and footer render on a page that uses them. Stop the dev server (`Ctrl+C`).

- [ ] **Step 6: Commit + push + PR**

```bash
git add -A
git commit -m "consolidate(p2): fold components/ into client/src/components/ecosystem/

Two ecosystem-shell components moved into the canonical client tree.
All import sites updated to use the @/ alias.

Resolves the orphaned top-level components/ directory."
git push -u origin consolidate/p2-fold-components
gh pr create --title "consolidate(p2): fold components/ into client tree" \
  --body "Mechanical move + import updates. Verified with check/build/dev smoke."
```

---

## Task 2.2: Move `lib/` into target chosen in P0.4 (PR C4)

**Files (target depends on P0.4 outcome):**
- Move: `lib/ecosystem.ts` → either `client/src/lib/ecosystem.ts` OR `shared/ecosystem.ts`
- Move: `lib/industries.ts` → either `client/src/lib/industries.ts` OR `shared/industries.ts`
- Modify: every file that imports either

- [ ] **Step 1: Branch and verify P0.4 decision**

```bash
git checkout -b consolidate/p2-fold-lib
grep "Question 4" -A 30 docs/superpowers/plans/worker-status-2026-04-27.md
```

Note the chosen target dir. The rest of this task uses `<TARGET>` as a placeholder for whichever was chosen — substitute it everywhere.

- [ ] **Step 2: Inventory imports**

```bash
grep -rln "lib/ecosystem\|lib/industries" client/ server/ worker/ workers/ shared/ 2>/dev/null | tee /tmp/lib-import-files.txt
```

- [ ] **Step 3: Move files**

If `<TARGET>` is `client/src/lib/`:

```bash
mkdir -p client/src/lib
git mv lib/ecosystem.ts client/src/lib/ecosystem.ts
git mv lib/industries.ts client/src/lib/industries.ts
rmdir lib/ 2>/dev/null
```

If `<TARGET>` is `shared/`:

```bash
mkdir -p shared
git mv lib/ecosystem.ts shared/ecosystem.ts
git mv lib/industries.ts shared/industries.ts
rmdir lib/ 2>/dev/null
```

- [ ] **Step 4: Update each import in every file from `/tmp/lib-import-files.txt`**

If target is `client/src/lib/`: change `from "../../lib/ecosystem"` (and similar) to `from "@/lib/ecosystem"`.

If target is `shared/`: change to `from "@shared/ecosystem"` if a `@shared/` alias exists in `vite.config.ts` and `tsconfig.json`. If no such alias exists, use relative paths and add a follow-up TODO to create the alias.

Open each file from `/tmp/lib-import-files.txt` in the Edit tool and update the import path.

- [ ] **Step 5: Verify**

```bash
pnpm check
pnpm build
```

- [ ] **Step 6: Commit + push + PR**

```bash
git add -A
git commit -m "consolidate(p2): fold lib/ into <TARGET>

Two ecosystem util files moved per P0.4 decision (consumers: <list>).
All import sites updated.

Resolves the orphaned top-level lib/ directory."
git push -u origin consolidate/p2-fold-lib
gh pr create --title "consolidate(p2): fold lib/ into <TARGET>" \
  --body "Mechanical move + import updates. P0.4 decided <TARGET> based on consumer pattern."
```

---

## Task 2.3: Rename worker dirs that don't match declared name (PR C6)

**Only run for workers marked DEPLOYED or SCAFFOLDED in Phase 0.** PHANTOM workers are deleted in Task 3.1 — skip them here.

**Affected dirs (per current `wrangler.toml` declarations):**
- `workers/license-issuer/` → declared name `authichain-license-issuer`
- `workers/qron-provenance/` → declared name `authichain-qron-provenance`
- `workers/scan-validate/` → declared name `authichain-scan-validate`
- `workers/telegram/` → declared name `authichain-telegram`
- `workers/verify-worker/` → declared name `authichain-verify-worker`

**Convention chosen:** rename DIRS to match the declared NAME. (Renaming the worker name in Cloudflare would break existing routing/bindings.)

- [ ] **Step 1: Branch**

```bash
git checkout -b consolidate/p2-worker-dir-naming
```

- [ ] **Step 2: For each affected DEPLOYED/SCAFFOLDED dir, rename**

Run only for dirs that Phase 0 marked DEPLOYED or SCAFFOLDED. Example for `license-issuer`:

```bash
git mv workers/license-issuer workers/authichain-license-issuer
```

Repeat for the others if applicable.

- [ ] **Step 3: Update any references**

```bash
grep -rln "workers/license-issuer\|workers/qron-provenance\|workers/scan-validate\|workers/telegram\|workers/verify-worker" \
  .github/ scripts/ docs/ 2>/dev/null
```

For each file in the output, update the path.

- [ ] **Step 4: Verify nothing breaks**

```bash
pnpm check
pnpm build
# spot-check that the renamed dirs still build their own workers
for d in workers/authichain-license-issuer workers/authichain-qron-provenance workers/authichain-scan-validate workers/authichain-telegram workers/authichain-verify-worker; do
  if [ -f "$d/package.json" ]; then
    (cd "$d" && pnpm install --frozen-lockfile 2>&1 | tail -3)
  fi
done
```

- [ ] **Step 5: Commit + push + PR**

```bash
git add -A
git commit -m "consolidate(p2): rename worker dirs to match declared names

Five dirs had a directory name that disagreed with their wrangler.toml
'name' field. Aligning the dir names so grep-by-name works.

The Cloudflare worker names are unchanged — only the local paths."
git push -u origin consolidate/p2-worker-dir-naming
gh pr create --title "consolidate(p2): rename worker dirs to match wrangler names" \
  --body "Naming hygiene. No deployed worker is renamed — only local paths."
```

---

# PHASE 3 — WORKER FLEET DECISIONS (MED risk, gated by Phase 0)

**Do not start Phase 3 until Phase 0's PR is merged.** Each task references the Phase 0 status table.

## Task 3.1: Delete PHANTOM workers (PR P3.1)

**Files (depends on Phase 0):**
- Delete: every `workers/<name>/` row marked `PHANTOM` in the status table

- [ ] **Step 1: Branch and list targets**

```bash
git checkout -b consolidate/p3-delete-phantom-workers
grep "PHANTOM" docs/superpowers/plans/worker-status-2026-04-27.md
```

Save the list. Each one needs Step 2 + Step 3 below.

- [ ] **Step 2: Confirm zero deploys for each PHANTOM**

For each `<dir>` in the list:

```bash
name=$(grep -E "^name" "workers/<dir>/wrangler.toml" | sed -E 's/name *= *"([^"]+)"/\1/')
wrangler deployments list --name "$name" 2>&1 | head -5
```

Expected: `Worker not found` or empty list. If you see ANY deployment, it is NOT phantom — STOP, mark it as DEPLOYED-STALE in the status doc, and skip it in this task.

- [ ] **Step 3: Delete each confirmed-phantom dir**

```bash
git rm -r workers/<dir>
# repeat for each phantom
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm check
pnpm build
```

(These workers were not in the main build anyway, so this is a safety check, not a real test.)

- [ ] **Step 5: Commit + push + PR**

```bash
git commit -m "consolidate(p3): delete PHANTOM worker dirs

These dirs had wrangler.toml but no deployed worker and <50 LOC of
substance. Confirmed phantom in Phase 0 inventory.

Deleted: <list>"
git push -u origin consolidate/p3-delete-phantom-workers
gh pr create --title "consolidate(p3): delete phantom worker dirs" \
  --body "Each deleted dir was confirmed PHANTOM in Phase 0. Listing in commit body. Reverts cleanly."
```

---

## Task 3.2: Add CI deploy job for each DEPLOYED worker not yet in CI (PR P3.2)

**Files:**
- Modify or create: `.github/workflows/deploy-workers.yml`

- [ ] **Step 1: Branch and inventory current CI**

```bash
git checkout -b consolidate/p3-ci-worker-deploys
ls .github/workflows/
grep -l "wrangler" .github/workflows/*
```

The current `deploy-cloudflare.yml` only deploys the root `worker/index.ts`. We need a separate workflow for the `workers/<name>/*` projects flagged DEPLOYED in Phase 0.

- [ ] **Step 2: Create the workflow**

Create `.github/workflows/deploy-workers.yml`:

```yaml
name: Deploy Workers (workers/*)

on:
  push:
    branches: [main]
    paths:
      - 'workers/**'
  workflow_dispatch:
    inputs:
      worker:
        description: 'Specific worker dir to deploy (leave blank for all)'
        required: false

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        # Update this list to match Phase 0 DEPLOYED workers.
        worker:
          - REPLACE_WITH_DEPLOYED_DIR_1
          - REPLACE_WITH_DEPLOYED_DIR_2
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v5
        with:
          version: 10.28.2
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
          cache: 'pnpm'
      - name: Install root deps
        run: pnpm install --frozen-lockfile
      - name: Install worker deps
        working-directory: workers/${{ matrix.worker }}
        run: |
          if [ -f package.json ]; then pnpm install --frozen-lockfile; fi
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: workers/${{ matrix.worker }}
```

- [ ] **Step 3: Replace matrix placeholders with the actual DEPLOYED dirs from Phase 0**

Open `.github/workflows/deploy-workers.yml`. Replace the two `REPLACE_WITH_DEPLOYED_DIR_*` lines with one line per DEPLOYED worker dir (e.g., `- authichain-api`, `- scan-validate`).

- [ ] **Step 4: Validate the YAML**

```bash
gh workflow view deploy-workers.yml 2>&1 | head -10
```

If `gh` complains about syntax, fix and re-run. (`gh workflow view` only works after the file is on a branch GitHub knows about — push first if needed.)

- [ ] **Step 5: Commit + push + PR (do NOT merge until tested)**

```bash
git add .github/workflows/deploy-workers.yml
git commit -m "consolidate(p3): add CI deploy workflow for workers/* fleet

Per Phase 0 inventory, N workers under workers/* are DEPLOYED but
not deployed by CI. This adds a path-triggered + manual-dispatch
workflow with one matrix entry per deployed worker.

Test: dispatch manually for one worker first; only merge after green."
git push -u origin consolidate/p3-ci-worker-deploys
```

- [ ] **Step 6: Manual dispatch test before merging**

```bash
gh workflow run deploy-workers.yml --ref consolidate/p3-ci-worker-deploys -f worker=<one-deployed-dir>
gh run watch
```

Expected: green run + the worker is updated (verify in Cloudflare dashboard).

If green, open the PR:

```bash
gh pr create --title "consolidate(p3): CI deploy for workers/* fleet" \
  --body "Adds matrix-based deploy for the DEPLOYED workers identified in Phase 0. Tested manually with worker=<name>."
```

---

## Task 3.3: Decide fate of SCAFFOLDED workers (PR P3.3)

**Files:**
- Modify: `docs/superpowers/plans/worker-status-2026-04-27.md` (decision column)
- Possibly delete: `workers/<name>/` for workers decided as DELETE
- Possibly add: matrix entries to `.github/workflows/deploy-workers.yml` for workers decided as DEPLOY-NOW

This task is decision-heavy and has no single mechanical recipe. Run it as a doc-first PR.

- [ ] **Step 1: Branch and list SCAFFOLDED**

```bash
git checkout -b consolidate/p3-scaffolded-decisions
grep "SCAFFOLDED" docs/superpowers/plans/worker-status-2026-04-27.md
```

- [ ] **Step 2: For each SCAFFOLDED worker, decide one of:**

  - **DEPLOY-NOW**: substance is real, finish + ship. Becomes a follow-up project, not part of consolidation.
  - **ARCHIVE**: keep code in repo with a marker file `workers/<name>/STATUS.md` saying "scaffolded, not deployed, not maintained" — leaves it visible but flagged.
  - **DELETE**: code is half-baked or superseded; remove.

Add a `Decision` column to the status table in `docs/superpowers/plans/worker-status-2026-04-27.md` and fill it in for every SCAFFOLDED row.

- [ ] **Step 3: Apply the decisions**

For each ARCHIVE row:

```bash
cat > workers/<name>/STATUS.md <<EOF
# Status: SCAFFOLDED — not deployed, not maintained

Decided 2026-04-27 in ecosystem-consolidation Phase 3.3.
See docs/superpowers/plans/worker-status-2026-04-27.md.
EOF
git add workers/<name>/STATUS.md
```

For each DELETE row:

```bash
git rm -r workers/<name>
```

For each DEPLOY-NOW row: add it to the matrix in `.github/workflows/deploy-workers.yml`. Verify a manual dispatch (Step 6 of Task 3.2) before declaring done.

- [ ] **Step 4: Verify**

```bash
pnpm check
pnpm build
```

- [ ] **Step 5: Commit + push + PR**

```bash
git add -A
git commit -m "consolidate(p3): resolve SCAFFOLDED workers

For each worker flagged SCAFFOLDED in Phase 0:
- DEPLOY-NOW: <list> — added to CI matrix
- ARCHIVE:    <list> — STATUS.md marker file added
- DELETE:     <list> — removed"
git push -u origin consolidate/p3-scaffolded-decisions
gh pr create --title "consolidate(p3): resolve SCAFFOLDED workers" \
  --body "One-sentence-per-worker decisions per Phase 0 inventory. See commit body for the mapping."
```

---

# PHASE 4 — SIBLING SALVAGE FROM `authichain` (LOW–MED per file)

**Pre-flight (run once before any Phase 4 task):**

```bash
git checkout main
git pull
ls /c/Users/rac/authichain  # confirm sibling repo still exists
```

Each Phase-4 task follows the same pattern: copy file → adapt to unified conventions → write a test → integrate → verify → commit. Source paths are absolute (`C:\Users\rac\authichain\...`); dest paths are relative to `authichain-unified`.

**Lift log:** every task appends a row to `docs/superpowers/plans/lift-log-2026-04-27.md`. Create that file in the first task.

---

## Task 4.0: Create the lift log

**Files:**
- Create: `docs/superpowers/plans/lift-log-2026-04-27.md`

- [ ] **Step 1: Branch and create**

```bash
git checkout -b consolidate/p4-lift-log
cat > docs/superpowers/plans/lift-log-2026-04-27.md <<'EOF'
# Sibling Salvage Lift Log

Every row records one file lifted from `C:\Users\rac\authichain` (Next.js sibling) into `C:\Users\rac\authichain-unified`. Provides provenance for any future "why is this code here?" question.

| Date | Source path (in authichain/) | Source LOC | Dest path (in authichain-unified/) | Notes / adaptations |
|---|---|---|---|---|
EOF
git add docs/superpowers/plans/lift-log-2026-04-27.md
git commit -m "consolidate(p4): scaffold sibling-lift log"
git push -u origin consolidate/p4-lift-log
gh pr create --title "consolidate(p4): scaffold lift log" --body "Provenance log for Phase 4 file lifts."
```

---

## Task 4.1: Lift `analytics/route.ts` (smallest, lowest coupling)

**Source:** `C:\Users\rac\authichain\app\api\analytics\route.ts` (81 LOC, Next.js handler)

**Dest decision:** AuthiChain-unified uses an Express + tRPC server (`server/_core/`). The salvaged Next.js route handler must be adapted to whichever pattern the existing server uses for analytics-shaped endpoints. Inspect first:

- [ ] **Step 1: Read existing analytics surface (if any)**

```bash
grep -rln "analytics\|counterfeit" server/_core/ 2>/dev/null
```

If a tRPC router for analytics already exists, the new code goes there as new procedures. If not, add a small Express handler in `server/_core/app.ts` that registers `/api/analytics`.

- [ ] **Step 2: Branch and read the source**

```bash
git checkout -b consolidate/p4-lift-analytics
cat /c/Users/rac/authichain/app/api/analytics/route.ts
```

Note: the source uses Next.js `Request`/`Response` and Supabase server client. AuthiChain-unified uses Express + Drizzle. The lift is a port, not a copy.

- [ ] **Step 3: Write the failing test first**

Decide test path: if existing tests live under `server/__tests__/` or `server/_core/__tests__/`, follow that. Otherwise create `server/_core/__tests__/analytics.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("analytics aggregation", () => {
  it("computes counterfeit rate from scan rows", () => {
    const rows = [
      { scan_result: "authentic", created_at: "2026-04-20" },
      { scan_result: "counterfeit", created_at: "2026-04-20" },
      { scan_result: "authentic", created_at: "2026-04-21" },
    ];
    const result = aggregateScans(rows);
    expect(result.totalScans).toBe(3);
    expect(result.counterfeitRate).toBeCloseTo(1 / 3);
    expect(result.dailyTrends).toHaveLength(2);
  });
});
```

(Replace `aggregateScans` with whatever name fits — TBD only at this template level; pick concrete name when writing.)

- [ ] **Step 4: Run test, expect FAIL**

```bash
pnpm test analytics
```

Expected: `aggregateScans is not defined` or similar.

- [ ] **Step 5: Implement the aggregation**

Create `server/_core/analytics.ts` (or wherever step 1 decided). Port the aggregation logic from the Next.js source — pure function over an array of rows, returns the shape the test expects.

- [ ] **Step 6: Wire it into the request layer**

If using Express in `server/_core/app.ts`: add a route that pulls scans from Drizzle, calls the aggregation function, returns JSON.

If using tRPC: add a procedure to the relevant router.

- [ ] **Step 7: Run test, expect PASS**

```bash
pnpm test analytics
pnpm check
pnpm build
```

All three green.

- [ ] **Step 8: Update lift log**

Append a row to `docs/superpowers/plans/lift-log-2026-04-27.md`:

```
| 2026-04-27 | app/api/analytics/route.ts | 81 | server/_core/analytics.ts + route wiring | Ported Next.js → Express/tRPC. Aggregation extracted as pure fn. |
```

- [ ] **Step 9: Commit + push + PR**

```bash
git add -A
git commit -m "consolidate(p4): lift analytics from authichain (Next.js)

Port of authichain/app/api/analytics/route.ts (81 LOC, Next.js handler)
into authichain-unified server. Aggregation extracted as pure function
with unit tests; route wiring follows existing server pattern.

Lift logged in docs/superpowers/plans/lift-log-2026-04-27.md."
git push -u origin consolidate/p4-lift-analytics
gh pr create --title "consolidate(p4): lift analytics route" \
  --body "First Phase 4 lift. Sets the pattern for subsequent lifts. Tests + check + build pass."
```

---

## Task 4.2: Lift `verify/route.ts`

**Source:** `C:\Users\rac\authichain\app\api\verify\route.ts` (120 LOC)

Follow the same pattern as Task 4.1, with these substitutions:

- Source LOC: 120
- Read source: `cat /c/Users/rac/authichain/app/api/verify/route.ts`
- Dest hint: existing verify-related code in `server/_core/` — grep first: `grep -rln "verify" server/_core/`
- Test focus: the verification logic returns the right shape for valid/invalid product codes
- Branch: `consolidate/p4-lift-verify`
- Lift-log row: `| 2026-04-27 | app/api/verify/route.ts | 120 | <chosen dest> | <notes> |`

- [ ] **Step 1: Read source + existing dest pattern**
- [ ] **Step 2: Write failing test for the verification logic** (use the same test scaffold as 4.1, adapted)
- [ ] **Step 3: Run test, expect fail**
- [ ] **Step 4: Port logic, adapt to Drizzle / Supabase as appropriate** (existing unified code uses Drizzle; do NOT introduce a parallel Supabase client)
- [ ] **Step 5: Run test, expect pass**
- [ ] **Step 6: Verify** (`pnpm check && pnpm build`)
- [ ] **Step 7: Update lift log**
- [ ] **Step 8: Commit + push + PR**

```bash
git checkout -b consolidate/p4-lift-verify
# ... per steps above ...
git commit -m "consolidate(p4): lift verify route from authichain"
git push -u origin consolidate/p4-lift-verify
gh pr create --title "consolidate(p4): lift verify route" --body "Per Phase 4 pattern."
```

---

## Task 4.3: Lift `classify/route.ts` (OpenAI integration)

**Source:** `C:\Users\rac\authichain\app\api\classify\route.ts` (127 LOC)

Same pattern as 4.1/4.2. Specific notes:

- This handler calls OpenAI for classification. AuthiChain-unified already has `server/_core/llm.ts`. The lift should reuse that module rather than instantiating a new OpenAI client. Check first: `cat server/_core/llm.ts | head -50`.
- Test should cover: prompt construction + result parsing. Mock the OpenAI call (do NOT hit live API in tests).
- Branch: `consolidate/p4-lift-classify`

- [ ] Step 1–8 per the Task 4.2 pattern, with adaptations above.
- [ ] In the PR body, note that this lift consumed `server/_core/llm.ts` rather than introducing a new OpenAI dependency.

---

## Task 4.4: Lift `stripe/webhook/route.ts` (highest-value, highest-coupling)

**Source:** `C:\Users\rac\authichain\app\api\stripe\webhook\route.ts` (319 LOC)

This one is special:

1. AuthiChain-unified is already on Stripe v22 (per `package.json`). The source was on Stripe v17. Some API shapes will differ — the recent unified commit `e9245cc refactor(stripe): use balance.retrieve()` is a hint about what changed.
2. The source uses Airtable for idempotent event-log dedup. AuthiChain-unified has its own Stripe code already; the value of the lift is the dedup-via-Airtable pattern, NOT the wholesale handler.

Recommended approach: **adapt the dedup pattern, not copy the handler**.

- [ ] **Step 1: Branch and read both sides**

```bash
git checkout -b consolidate/p4-lift-stripe-dedup
cat /c/Users/rac/authichain/app/api/stripe/webhook/route.ts
grep -rln "stripe\|webhook" server/_core/ 2>/dev/null
# read the existing unified Stripe handler
```

- [ ] **Step 2: Identify the dedup pattern**

Read the source and extract just the idempotency check: `isEventProcessed(stripeEventId)` + `logEvent(...)`. Decide: do we want Airtable as the dedup store, or Postgres (via Drizzle, which we already have)?

Default to **Postgres** unless the user specifically wants Airtable: it's one less external dependency and the unified repo already runs Postgres.

- [ ] **Step 3: Write a failing test for the dedup**

```typescript
import { describe, it, expect } from "vitest";

describe("stripe webhook idempotency", () => {
  it("returns early when the same eventId is processed twice", async () => {
    const result1 = await handleStripeEvent({ id: "evt_test_001", type: "checkout.session.completed", data: {} });
    expect(result1.processed).toBe(true);
    const result2 = await handleStripeEvent({ id: "evt_test_001", type: "checkout.session.completed", data: {} });
    expect(result2.processed).toBe(false);
    expect(result2.reason).toMatch(/duplicate/i);
  });
});
```

- [ ] **Step 4: Add a `stripe_processed_events` table via Drizzle**

If a similar table doesn't already exist (`grep -rln "stripe_processed_events\|stripeEventId" drizzle/`), add a Drizzle migration:

```typescript
// drizzle/schema/stripe-events.ts (or wherever schema files live)
export const stripeProcessedEvents = pgTable("stripe_processed_events", {
  eventId: varchar("event_id", { length: 256 }).primaryKey(),
  type: varchar("type", { length: 128 }).notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});
```

Run `pnpm db:push` to apply.

- [ ] **Step 5: Implement dedup wrapper**

Add a `wasProcessed` / `markProcessed` helper to the existing Stripe handler:

```typescript
async function wasProcessed(eventId: string): Promise<boolean> {
  const row = await db.select().from(stripeProcessedEvents).where(eq(stripeProcessedEvents.eventId, eventId)).limit(1);
  return row.length > 0;
}

async function markProcessed(eventId: string, type: string) {
  await db.insert(stripeProcessedEvents).values({ eventId, type }).onConflictDoNothing();
}
```

Wrap the existing handler with these calls.

- [ ] **Step 6: Run test, expect pass**

```bash
pnpm test stripe
pnpm check
pnpm build
```

- [ ] **Step 7: Update lift log**

```
| 2026-04-27 | app/api/stripe/webhook/route.ts | 319 | server/_core/stripe.ts (dedup wrapper added) + drizzle migration | Lifted only the idempotency pattern; rest of handler is unified-native. Backed by Postgres, not Airtable. |
```

- [ ] **Step 8: Commit + push + PR**

```bash
git commit -m "consolidate(p4): add Stripe webhook idempotency from authichain

Lifted only the dedup pattern from authichain's webhook handler (319 LOC,
v17 Stripe), not the handler itself. unified is on Stripe v22 with its
own handler; this PR adds a stripe_processed_events table + wrapper to
make webhook delivery safely retry-able.

Source: authichain/app/api/stripe/webhook/route.ts"
git push -u origin consolidate/p4-lift-stripe-dedup
gh pr create --title "consolidate(p4): Stripe webhook idempotency" \
  --body "Adapted pattern, not copy. Postgres-backed dedup. Tests + build pass."
```

---

## Task 4.5: Lift brand-settings page + API

**Sources:**
- `C:\Users\rac\authichain\app\dashboard\brand\page.tsx` (237 LOC, React UI)
- `C:\Users\rac\authichain\app\api\brand\route.ts` (79 LOC, server handler)

Bundled into one PR because they're tightly coupled.

- [ ] **Step 1: Branch and read both**

```bash
git checkout -b consolidate/p4-lift-brand
cat /c/Users/rac/authichain/app/api/brand/route.ts
cat /c/Users/rac/authichain/app/dashboard/brand/page.tsx
```

- [ ] **Step 2: Identify the brand schema**

The page reads/writes a `brands` row. Check unified's Drizzle schema:

```bash
grep -rln "brands\|brand_id" drizzle/ shared/ 2>/dev/null
```

If a `brands` table already exists, port to that. If not, add one via Drizzle migration that matches the source's read/write shape.

- [ ] **Step 3: Write a failing test for the API handler**

```typescript
import { describe, it, expect } from "vitest";

describe("brand settings API", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await brandHandler({ user: null });
    expect(res.status).toBe(401);
  });
  it("returns the user's brand row when authenticated", async () => {
    const res = await brandHandler({ user: { id: "u1" } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name");
  });
});
```

- [ ] **Step 4: Run test, expect fail**
- [ ] **Step 5: Port the API handler to `server/_core/brand.ts`** — adapt to existing auth middleware (read `server/_core/brand-middleware.ts` first, since brand routing already exists in unified)
- [ ] **Step 6: Run test, expect pass**
- [ ] **Step 7: Port the React page to `client/src/pages/brand-settings.tsx`** — adapt to existing tRPC client and shadcn components in unified
- [ ] **Step 8: Add the route to the client router** (find existing route registration: `grep -rln "createBrowserRouter\|<Route " client/src/`)
- [ ] **Step 9: `pnpm dev` smoke check** — log in, navigate to the brand-settings page, save a change, reload, confirm persistence
- [ ] **Step 10: Update lift log + commit + push + PR**

```bash
git commit -m "consolidate(p4): lift brand-settings UI + API from authichain

UI: 237 LOC React form for brand identity (logo, colors, verification msg)
API: 79 LOC handler, adapted to unified's auth + brand-middleware

Both ported to unified conventions (tRPC where applicable, shadcn UI,
Drizzle for the brand row)."
```

---

## Task 4.6: Lift verification UI components batch

**Sources (8 components, total ~1,620 LOC):**
- `components/nft-certificate.tsx` (135)
- `components/seed-to-sale-timeline.tsx` (325)
- `components/truemark-fingerprint.tsx` (101)
- `components/microscopic-analysis.tsx` (117)
- `components/confidence-score.tsx` (99)
- `components/product-classification-card.tsx` (258)
- `components/ai-story-player.tsx` (335)
- `components/ai-story.tsx` (107)

**Approach:** these are presentational React components. TDD per-component is overkill; a render-smoke test per component is enough.

**Bundled or split?** Bundle into ONE PR because they're related (verification flow). Total touch is ~1,600 LOC — large but cohesive.

- [ ] **Step 1: Branch**

```bash
git checkout -b consolidate/p4-lift-verify-components
mkdir -p client/src/components/verify
mkdir -p client/src/components/strainchain
mkdir -p client/src/components/nft
```

- [ ] **Step 2: Copy each file** (with `cp`, not `git mv` — source repo is separate)

```bash
cp /c/Users/rac/authichain/components/nft-certificate.tsx \
   client/src/components/nft/certificate.tsx

cp /c/Users/rac/authichain/components/seed-to-sale-timeline.tsx \
   client/src/components/strainchain/timeline.tsx

cp /c/Users/rac/authichain/components/truemark-fingerprint.tsx \
   client/src/components/verify/fingerprint.tsx

cp /c/Users/rac/authichain/components/microscopic-analysis.tsx \
   client/src/components/verify/microscopic-analysis.tsx

cp /c/Users/rac/authichain/components/confidence-score.tsx \
   client/src/components/verify/confidence-score.tsx

cp /c/Users/rac/authichain/components/product-classification-card.tsx \
   client/src/components/verify/classification-card.tsx

cp /c/Users/rac/authichain/components/ai-story-player.tsx \
   client/src/components/verify/ai-story-player.tsx

cp /c/Users/rac/authichain/components/ai-story.tsx \
   client/src/components/verify/ai-story.tsx
```

- [ ] **Step 3: Adapt each file's imports**

Each component will import shadcn/ui primitives (`@/components/ui/button`, etc.) and possibly an icon library. Open each and update import paths to match unified's conventions:

- shadcn paths: `@/components/ui/X` → confirm unified has the same components; add via `npx shadcn-ui@latest add X` if missing
- Type imports: any `Props` types — keep inline (DRY: don't extract unless reused)

Run `pnpm check` after each adaptation to catch missing modules.

- [ ] **Step 4: Add a render smoke test for each component**

Create `client/src/components/__tests__/verify-components.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Certificate } from "@/components/nft/certificate";
import { Timeline } from "@/components/strainchain/timeline";
import { Fingerprint } from "@/components/verify/fingerprint";
// ...import each of the 8...

describe("verification components — render smoke", () => {
  it("Certificate renders with minimal props", () => {
    const { container } = render(<Certificate productId="p1" />);
    expect(container).toBeTruthy();
  });
  // repeat one `it` per component with whatever minimal props it needs
});
```

(Read each component's exported props to know the minimal prop set.)

- [ ] **Step 5: Run smoke tests**

```bash
pnpm test verify-components
```

Expected: 8 green tests.

- [ ] **Step 6: Verify**

```bash
pnpm check
pnpm build
```

- [ ] **Step 7: Update lift log (8 rows) + commit + push + PR**

```bash
git commit -m "consolidate(p4): lift 8 verification UI components from authichain

Components ported (paths in destination):
- client/src/components/nft/certificate.tsx (135 LOC)
- client/src/components/strainchain/timeline.tsx (325 LOC)
- client/src/components/verify/fingerprint.tsx (101 LOC)
- client/src/components/verify/microscopic-analysis.tsx (117 LOC)
- client/src/components/verify/confidence-score.tsx (99 LOC)
- client/src/components/verify/classification-card.tsx (258 LOC)
- client/src/components/verify/ai-story-player.tsx (335 LOC)
- client/src/components/verify/ai-story.tsx (107 LOC)

Render smoke tests added in client/src/components/__tests__/verify-components.test.tsx."
git push -u origin consolidate/p4-lift-verify-components
gh pr create --title "consolidate(p4): lift 8 verification UI components" \
  --body "Bundled because cohesive verification flow. Render smoke tests for each. ~1,600 LOC total."
```

---

## Task 4.7: Tag-archive `authichain`, then delete it

**Files:** none (cross-repo + filesystem operation)

- [ ] **Step 1: Confirm all valuable lifts are in unified**

```bash
cat docs/superpowers/plans/lift-log-2026-04-27.md
```

Verify that every HIGH-value row from the spec's §5.1 has a lift-log entry. If anything is missing, STOP and add a Phase-4.X task for it before proceeding.

- [ ] **Step 2: Tag the sibling**

```bash
cd /c/Users/rac/authichain
git tag -a archive/2026-04-27 -m "Final state before consolidation into authichain-unified. See unified's lift-log for what was salvaged."
git push origin archive/2026-04-27 2>&1 || echo "no remote — see Step 3"
```

- [ ] **Step 3: If `authichain` has no remote, push the tag to the unified remote as a backup**

```bash
cd /c/Users/rac/authichain
git remote add archive-target git@github.com:undone0603/authichain-archive.git 2>/dev/null || true
git push --tags archive-target
```

(Substitute the actual archive remote you control. If you don't have one, create a private repo on GitHub first via `gh repo create undone0603/authichain-archive --private`.)

- [ ] **Step 4: Verify the tag is reachable**

```bash
gh api "repos/undone0603/authichain-archive/git/refs/tags/archive/2026-04-27" 2>&1 | head -10
```

Expected: JSON response, not 404.

- [ ] **Step 5: Delete the local working dir**

```bash
cd /c/Users/rac
rm -rf authichain
```

(After Step 4 confirms the archive is pushed. This is the only point where the local sibling repo goes away.)

- [ ] **Step 6: Document in unified**

```bash
cd /c/Users/rac/authichain-unified
git checkout -b consolidate/p4-archive-authichain
cat >> docs/superpowers/plans/lift-log-2026-04-27.md <<'EOF'

## Final disposition

The `authichain` sibling repo was tag-archived as `archive/2026-04-27`
and pushed to `undone0603/authichain-archive` on 2026-04-27. Local
working copy at `C:\Users\rac\authichain` was removed. To recover any
unlifted code, clone the archive repo and check out the tag.
EOF
git add docs/superpowers/plans/lift-log-2026-04-27.md
git commit -m "consolidate(p4): document authichain sibling archival"
git push -u origin consolidate/p4-archive-authichain
gh pr create --title "consolidate(p4): document authichain archival" \
  --body "Sibling repo archived as tag archive/2026-04-27 in undone0603/authichain-archive. Local copy removed."
```

---

# PHASE 5 — `authichain-mobile` ARCHIVAL (LOW risk)

## Task 5.1: Back up `authichain-mobile` before delete

**Files:** none in unified — operates on filesystem only.

- [ ] **Step 1: Zip the directory**

```bash
cd /c/Users/rac
tar -czf authichain-mobile-archive-2026-04-27.tar.gz authichain-mobile/
ls -lh authichain-mobile-archive-2026-04-27.tar.gz
```

Expected: a `.tar.gz` file, several MB.

- [ ] **Step 2: Push the archive to a safe location**

Pick one:

- **Option A:** Upload to a private GitHub repo's release: `gh release create archive-mobile-2026-04-27 authichain-mobile-archive-2026-04-27.tar.gz --repo undone0603/authichain-archive`
- **Option B:** Move to a long-term local archive dir: `mv authichain-mobile-archive-2026-04-27.tar.gz /c/Users/rac/Documents/_archive/`
- **Option C:** Both

- [ ] **Step 3: Verify the archive is retrievable**

If Option A: `gh release view archive-mobile-2026-04-27 --repo undone0603/authichain-archive` should show the asset.

If Option B: `ls -lh /c/Users/rac/Documents/_archive/authichain-mobile-archive-2026-04-27.tar.gz` should match the size from Step 1.

---

## Task 5.2: Delete `authichain-mobile`

**Pre-condition:** Task 5.1 verified the archive exists.

- [ ] **Step 1: Final glance — anything irreplaceable?**

```bash
ls /c/Users/rac/authichain-mobile/
```

If you spot anything not in the archive (custom config, .env, etc.), STOP and add it to the archive before proceeding.

- [ ] **Step 2: Delete**

```bash
rm -rf /c/Users/rac/authichain-mobile
```

- [ ] **Step 3: Document in unified's lift log**

```bash
cd /c/Users/rac/authichain-unified
git checkout -b consolidate/p5-mobile-archived
cat >> docs/superpowers/plans/lift-log-2026-04-27.md <<'EOF'

## authichain-mobile archival

The `authichain-mobile` working dir (Expo skeleton, no git, 3 stub
screens) was archived as `authichain-mobile-archive-2026-04-27.tar.gz`
on 2026-04-27. Location: <fill in based on Step 2 of Task 5.1>.
Local working copy removed.

Salvage value at archival time: zero (no unique code, no backend
wiring, no git history).
EOF
git add docs/superpowers/plans/lift-log-2026-04-27.md
git commit -m "consolidate(p5): document authichain-mobile archival"
git push -u origin consolidate/p5-mobile-archived
gh pr create --title "consolidate(p5): document mobile archival" \
  --body "Mobile sibling backed up, removed locally. Doc-only PR in unified."
```

---

# Final acceptance check

After every PR above is merged, run:

- [ ] **Step 1: Spot-check the spec's §9 acceptance criteria**

```bash
cd /c/Users/rac/authichain-unified
ls app/ src/ lib/ components/ 2>&1  # at least app/ should be gone; the others may have moved
grep -E "8 specialized" CLAUDE.md  # should return empty
ls /c/Users/rac/authichain /c/Users/rac/authichain-mobile 2>&1  # both should be "No such file"
git log --oneline | grep -c "consolidate(" # should match the PR count
```

- [ ] **Step 2: Run the full verification suite**

```bash
pnpm check
pnpm build
pnpm test
```

All three green.

- [ ] **Step 3: Close the loop**

Add a final commit on a `consolidate/done` branch updating `CLAUDE.md` with a one-line pointer:

```markdown
## 📜 Consolidation history
The 2026-04-27 ecosystem consolidation effort is logged in
`docs/superpowers/plans/lift-log-2026-04-27.md` (sibling salvage)
and `docs/superpowers/plans/worker-status-2026-04-27.md` (worker fleet
reality check).
```

Commit + PR + merge.

---

## Self-review (done)

- **Spec coverage:** every section of the spec maps to tasks above. §1 = state-of-world, used by P0 + P1 verifications. §2 verdicts table = covered task-by-task. §3 internal moves = Tasks 1.1, 1.4, 2.1, 2.2. §4 worker fleet = Phase 0 + Phase 3. §5 sibling salvage = Phase 4. §6 benchmarks = background only, not implemented. §7 execution sequence = mirror of this plan's phase order. §8 out of scope = enforced (no feature work, no taste-only renames). §9 acceptance = covered in Final acceptance check.
- **Placeholder scan:** TBD/TODO appears only in Task 4.1 Step 3 where the test name is genuinely chosen at write-time; flagged inline so the engineer doesn't miss it. No "implement later" / "appropriate error handling" placeholders.
- **Type consistency:** function names introduced in tests match the implementation steps. The Stripe `wasProcessed`/`markProcessed` pair is consistent across the test (Step 3) and implementation (Step 5).
