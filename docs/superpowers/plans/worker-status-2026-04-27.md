# Worker Fleet Reality — Phase 0 Output

**Date:** 2026-04-27
**Status:** Phase 0 complete. Gates Phase 3 of `2026-04-27-ecosystem-consolidation.md`.
**Cloudflare account:** `4c1869b90f13f86940aa3747839bf420` (undone.k@gmail.com)

---

## Summary

| Question | Outcome |
|---|---|
| Q1 — `workers/<name>/` deployment status | **12 DEPLOYED, 8 SCAFFOLDED, 0 PHANTOM** |
| Q2 — "Remote forks" status | None exist on GitHub; 3 are stale **local** branches |
| Q3 — Top-level `src/` orphan? | **NO — it's a Hono Cloudflare Worker** (Bridge/JWT/Supabase/RapidAPI). Reclassify, do not delete. |
| Q4 — Where do `lib/*` get imported? | `lib/industries.ts` used by `server/`; `lib/ecosystem.ts` has no consumers. Target: `shared/` |

---

## Q1: Worker fleet deployment status

Queried via `wrangler deployments list --name <declared-name>` against account `4c1869b9…`. Workers with no deployments returned the wrangler "not found" path.

| Dir | Declared name | Status | Last deploy | LOC | pkg.json |
|---|---|---|---|---|---|
| `authichain-api` | authichain-api | **DEPLOYED** | 2026-04-11 | 427 | no |
| `authichain-api-gateway` | authichain-api-gateway | **DEPLOYED** | 2026-04-23 | 466 | no |
| `authichain-automation` | authichain-automation | **DEPLOYED** | 2026-02-25 | 468 | no |
| `authichain-autopilot` | authichain-autopilot | SCAFFOLDED | never | 302 | no |
| `authichain-chain-data` | authichain-chain-data | SCAFFOLDED | never | 155 | no |
| `authichain-com` | authichain-com | **DEPLOYED** | 2026-04-23 | 302 | no |
| `authichain-dashboard` | authichain-dashboard | **DEPLOYED** | 2026-04-13 | 271 | no |
| `authichain-gateway` | authichain-gateway | SCAFFOLDED | never | 552 | yes |
| `govchain-us` | govchain-us | **DEPLOYED** | 2026-04-23 | 298 | no |
| `license-issuer` | authichain-license-issuer | SCAFFOLDED | never | 644 | yes |
| `qron-automation` | qron-automation | **DEPLOYED** | 2026-04-13 | 412 | no |
| `qron-image-gen` | qron-image-gen | **DEPLOYED** | 2026-04-11 | 280 | no |
| `qron-outreach` | qron-outreach | **DEPLOYED** | 2026-04-13 | 357 | no |
| `qron-provenance` | authichain-qron-provenance (+ staging) | SCAFFOLDED | never | 226 | yes |
| `qron-space` | qron-space | **DEPLOYED** | 2026-04-23 | 318 | no |
| `resend-relay` | resend-relay | **DEPLOYED** | 2026-04-03 | 91 | no |
| `scan-validate` | authichain-scan-validate (+ staging) | SCAFFOLDED | never | 193 | yes |
| `strainchain-io` | strainchain-io | **DEPLOYED** | 2026-04-23 | 272 | no |
| `telegram` | authichain-telegram | SCAFFOLDED | never | 376 | yes |
| `verify-worker` | authichain-verify-worker (+ staging) | SCAFFOLDED | never | 174 | yes |

**12 DEPLOYED workers** are all on the user's Cloudflare account, last-deployed within the past 60 days. These need CI deploy coverage in Phase 3.2 (currently only the root `worker/index.ts` is deployed by `.github/workflows/deploy-cloudflare.yml`).

**8 SCAFFOLDED workers** have substantive code (155–644 LOC) but no Cloudflare deployment record. Phase 3.3 decides each one's fate (DEPLOY-NOW / ARCHIVE-WITH-MARKER / DELETE).

**0 PHANTOM workers.** Phase 3.1 of the plan has no work — every dir has real code.

### Naming inconsistencies (5 dirs ≠ declared name)

The following dirs declare a name that doesn't match the dir name. Phase 2.3 renames the DIRS to match (changing the worker name in Cloudflare would break routing).

- `license-issuer/` declares `authichain-license-issuer`
- `qron-provenance/` declares `authichain-qron-provenance`
- `scan-validate/` declares `authichain-scan-validate`
- `telegram/` declares `authichain-telegram`
- `verify-worker/` declares `authichain-verify-worker`

All five are SCAFFOLDED — Phase 2.3 only renames if Phase 3.3 decides DEPLOY-NOW or ARCHIVE-WITH-MARKER. If DELETE, no rename needed.

---

## Q2: "Remote forks" investigation

The names `confident-germain`, `stupefied-almeida`, `sweet-liskov` initially looked like remote-tracking refs. Investigation:

1. **`gh api repos/AuthiChain/<name>` — all 404.** No GitHub repos exist with those names.
2. **`git remote -v` — no AuthiChain remotes configured.** Only `origin` (this repo's actual upstream).
3. **`git for-each-ref` — they're LOCAL BRANCHES** with slashes in the name (`refs/heads/AuthiChain/<name>`).

| Local branch | Unique commits vs main | Action |
|---|---|---|
| `AuthiChain/confident-germain` | **2 commits** — see below | INVESTIGATE before delete |
| `AuthiChain/stupefied-almeida` | 0 (empty against main) | safe DELETE |
| `AuthiChain/sweet-liskov` | 0 (empty against main) | safe DELETE |

### Unique commits on `AuthiChain/confident-germain`

- `6a01079` (2026-03-31) — "Add QR Art demo gallery at /gallery". Adds 10 PNG assets under `client/public/gallery/` (~7 MB total) for a QR-art showcase across 10 industries (Qron Space, StrainChain, AuthiChain, EV, MedChain, Haute Couture, Artisan Roasters, PropChain, StreamVault, AthleteDAO). Likely paired with a `/gallery` page that wasn't included in the diff inspection — verify before salvage.
- `db29247` (2026-03-31) — "Add .claude/launch.json with dev server configurations". Adds 1 IDE-launch-config file (23 lines).

**Recommendation:** cherry-pick both commits to main (or a salvage branch) before deleting the local branch. Gallery PNGs are real assets; the `.claude/launch.json` is dev tooling — both are reasonable to keep.

**Caveat:** `confident-germain` predates main by a wide margin. The diff showed it lacks ~12,500 lines that main has (notably `api/server.js` build output). Cherry-picking the 2 unique commits is the right move; merging the branch is not.

---

## Q3: Top-level `src/` — NOT orphaned

```
src/
├── agents/
│   └── government-lead-gen-v2.ts
└── index.ts
```

`src/index.ts` is a **Hono Cloudflare Worker** with bindings for `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY`. It includes CORS middleware and looks like a bridge/aggregator worker.

**Imports of top-level `src/` from main app code:** none found (after excluding `node_modules` noise).

**Implication:** This is effectively a 21st worker scaffold that lives outside `workers/`. It is NOT consumed by `client/`, `server/`, or the canonical `worker/index.ts` build.

**Plan revision needed:**
- Original plan Task 1.4 was "delete top-level `src/`" — this would delete a Worker. **Cancel that task.**
- Replace with: investigate `src/index.ts` against Cloudflare deployments. Either:
  - **Move to `workers/<name>/`** if it's a real worker that should be in the fleet
  - **Delete** if it's a superseded prototype
  - **Keep at top-level** with documentation if it has a structural reason to live there (unlikely)

This decision is added as **Task 0.6** below (post-Phase-0 follow-up before Phase 1.4 runs).

---

## Q4: `lib/` import inventory

```
$ grep -rn "lib/ecosystem\|lib/industries" client/ server/ worker/ workers/ shared/
```

Excluding node_modules:

- `lib/ecosystem.ts` — **0 consumers** in main code. Orphan.
- `lib/industries.ts` — **2 consumers**, both in `server/`:
  - `server/jobs/vertical-cloner.ts:3` — static import `import { classifyIndustry } from "../../lib/industries"`
  - `server/mcp/index.ts:57` — dynamic import `await import("../../lib/industries")`

`shared/` already exists at the repo root with `_core/`, `authichain-theme.ts`, `brands.ts`, `const.ts`, `subscriptionPlans.ts`, `types.ts`. Server code already imports from there.

**Decision: target is `shared/`.**

- `lib/industries.ts` → `shared/industries.ts` (must be reachable from server with same import semantics)
- `lib/ecosystem.ts` → `shared/ecosystem.ts` (orphan now, but it's the obvious sibling location; skip if confirmed unused after browsing the file)

Use relative imports (`from "../../shared/industries"`) unless a `@shared/` alias exists in `vite.config.ts` and `tsconfig.json` — verify in Phase 2.2.

---

## Plan revisions required

This Phase 0 output produces these changes to `2026-04-27-ecosystem-consolidation.md`:

| Plan task | Original | Revised |
|---|---|---|
| Task 1.3 (remove dead remotes) | Remove 3 git remotes | **Cherry-pick `confident-germain` unique commits, then delete 3 local branches** |
| Task 1.4 (delete top-level `src/`) | Delete it | **Cancel — replaced by new Task 0.6 (Hono worker disposition)** |
| Task 2.2 (fold `lib/`) | Target TBD | **Target = `shared/`** |
| Task 3.1 (delete PHANTOM workers) | Delete each phantom | **No-op — zero phantoms found** |
| Task 3.2 (CI deploys) | DEPLOYED workers | **12 specific workers (list above)** |
| Task 3.3 (SCAFFOLDED decisions) | Per-worker decision | **Covers all 8 undeployed workers (list above)** |

---

## Task 0.6 — Hono worker disposition (new task added by Phase 0)

**Why added:** Q3 revealed top-level `src/` is a Worker, not orphan source. Cannot proceed with deletions until classified.

- [ ] **Step 1: Read `src/index.ts` end-to-end and `src/agents/government-lead-gen-v2.ts`**

```bash
cat src/index.ts
cat src/agents/government-lead-gen-v2.ts
```

Identify what this worker does and whether it overlaps with any existing `workers/<name>/` worker.

- [ ] **Step 2: Check if it's deployed under any name**

```bash
cd /tmp
# pick the most likely name based on file content — try several
wrangler deployments list --name authichain-bridge 2>&1 | tail -3
wrangler deployments list --name authichain-government 2>&1 | tail -3
# add others based on hints in the code
```

- [ ] **Step 3: Decide one of**

  - **MOVE to `workers/<name>/`**: it's a real worker, just lives in the wrong place
  - **DELETE**: it's a superseded scaffold, not deployed, no unique value
  - **KEEP at top-level with docs**: rare; needs a clear structural reason

- [ ] **Step 4: Document decision in this file** (append a "Top-level src/ disposition" section)

---

## Final acceptance checklist for Phase 0

- [x] Q1 worker deployment table populated for all 20 dirs
- [x] Q2 remote forks classified (none exist; 3 stale local branches)
- [x] Q3 top-level `src/` classified (Hono worker, NOT orphan)
- [x] Q4 lib/ consumers identified, target dir decided (`shared/`)
- [x] Plan revisions enumerated (6 changes required to ecosystem-consolidation.md)
- [ ] Task 0.6 executed (Hono worker disposition) — gates Phase 1.4 cancellation
