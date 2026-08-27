# Ecosystem Consolidation Plan

**Date:** 2026-04-27
**Status:** Design / spec — pending implementation plan
**Scope:** Collapse internal duplication in `authichain-unified` and salvage best-of-each from sibling repos. Benchmarks are background context, not action items.

---

## 1. Ground truth map

Evidence-based inventory. Every claim cites a path or config line.

### 1.1 Local repos (filesystem siblings under `C:\Users\rac\`)

| Repo | Role | Last touched | Has git? | Verdict signal |
|---|---|---|---|---|
| `authichain-unified` | Canonical monorepo | 2026-04-26 | yes | `KEEP` — primary |
| `authichain` | Standalone Next.js prototype, ~14.5k LOC, 9 API routes + 9 page routes + 10 domain components | recent | yes | `SALVAGE-THEN-ARCHIVE` |
| `authichain-mobile` | Bare Expo skeleton, 3 stub screens, no backend wiring | dormant | **no** (not a git repo) | `ARCHIVE` (or `DELETE` after backup) |

### 1.2 Remote repos (under `AuthiChain/` GitHub org)

Only one public repo exists in the org per `gh repo list AuthiChain`:

- `AuthiChain/Qron-protocal` — public, last pushed 2026-02-08, no description of relevance to consolidation

The three "remote forks" visible in `git branch -a` of unified (`confident-germain`, `stupefied-almeida`, `sweet-liskov`) appear to be GitHub/Vercel auto-generated names. No evidence they contain unique salvageable content. **Action:** verify in execution Phase 0 (one `gh api` call each); if empty/duplicate, remove from `.git/config` remotes.

### 1.3 Top-level layout of `authichain-unified`

| Dir | Role | Evidence | Status |
|---|---|---|---|
| `client/` | Canonical frontend | `vite.config.ts:165` declares `root: "client"` | KEEP |
| `client/src/` | Aliased as `@/` | `vite.config.ts:159` | KEEP |
| `app/` | **Orphan** — only `globals.css` + `layout.tsx` | not in any build config | DELETE |
| `src/` | (Top-level, not the alias) — verify in Phase 0 | not referenced by build | INVESTIGATE → likely DELETE |
| `server/` | Canonical backend | `package.json:7` dev watches `server/_core/index.ts` | KEEP |
| `api/` | **Build output**, not source | `vercel.json:7` `"api/server.js"`; built by `package.json:8` esbuild | KEEP, gitignore-verify |
| `worker/` (singular) | Canonical Cloudflare Worker | `wrangler.toml:2` `main = "worker/index.ts"` | KEEP |
| `workers/` (plural) | **20 standalone worker projects, none deployed by `deploy-cloudflare.yml`** | each has own `wrangler.toml`; CI workflow only runs `wrangler deploy` from repo root | RECONCILE (see §4) |
| `packages/` | Workspace pkgs — only `vector-store/` exists | pnpm workspace | KEEP, expand boundary |
| `lib/` | 2 files: `ecosystem.ts`, `industries.ts` | small; check imports | INVESTIGATE — fold into `client/src/lib/` or `packages/` |
| `components/` | 2 files: `ecosystem-footer.tsx`, `ecosystem-nav.tsx` | small | INVESTIGATE — fold into `client/src/components/` |
| `contracts/` | Web3 contracts | thirdweb dep present | KEEP |
| `drizzle/` | DB migrations | active | KEEP |
| `docs/`, `knowledge/` | Docs/content | active | KEEP |
| `scripts/` | Dev/deploy scripts | active | KEEP |
| `dist/` | Vite build output | gitignore-verify | KEEP |
| `public/` | Static assets | active | KEEP |

---

## 2. Verdicts table

| Artifact | Verdict | Rationale | Reversibility |
|---|---|---|---|
| `authichain-unified/app/` | `DELETE` | 2 orphaned files, not built, not imported | trivial — `git revert` |
| `authichain-unified/src/` (top-level) | `INVESTIGATE → DELETE` if confirmed orphan | not in build config | trivial |
| `authichain-unified/components/` | `MERGE-INTO client/src/components/ecosystem/` | 2 files, ecosystem-specific, belongs near other UI | one PR, mechanical |
| `authichain-unified/lib/` | `MERGE-INTO client/src/lib/` (or `shared/`) | 2 files, no clear separate purpose | one PR, mechanical |
| `authichain-unified/workers/` (plural) | `RECONCILE` per §4 | 20 worker projects, deployment story unclear | medium — may be production |
| `authichain-mobile` | `ARCHIVE` | no git, no backend wiring, no value | reversible if backed up |
| `authichain` (Next.js sibling) | `SALVAGE-THEN-ARCHIVE` per §5 | real domain code worth lifting; obsolete after lift | reversible — keep tagged backup |
| Remote forks (`confident-germain` etc.) | `INVESTIGATE → REMOVE remote` if empty | likely auto-named, no evidence of unique content | trivial — `git remote remove` |
| CLAUDE.md "8 Cloudflare Workers" claim | `CORRECT` to match reality (1 deployed + N scaffolded) | doc/code drift hides the real architecture | trivial |
| `todo.md` at repo root | `OUT OF SCOPE` | feature backlog, not consolidation | n/a |

---

## 3. Internal consolidation moves

Each move = one PR. Ordered by risk inside §7.

| # | Move | Files affected | Risk | Verification |
|---|---|---|---|---|
| C1 | Delete `app/` | 2 files | LOW | `pnpm build && pnpm check` pass |
| C2 | Investigate + likely delete top-level `src/` | TBD | LOW | grep for imports; build pass |
| C3 | Move `components/*.tsx` → `client/src/components/ecosystem/` and update imports | 2 files + import sites | LOW | typecheck + visual smoke test of nav/footer |
| C4 | Move `lib/*.ts` → `client/src/lib/` (or `shared/` if used by both client and server) | 2 files + import sites | LOW | typecheck + grep for imports from server |
| C5 | Update CLAUDE.md "8 workers" claim to reflect actual deployed surface (1 + N scaffolded with status table) | doc only | NONE | n/a |
| C6 | Resolve `worker/` vs `workers/` naming — see §4 for the substantive call; this PR is renaming/doc only | doc + possibly dir rename | LOW–MED | nothing breaks if we only doc |

---

## 4. Worker fleet reality check

CLAUDE.md claims "8 specialized Cloudflare Workers (Hub, Studio, API, Automation)." Reality:

- **1 worker is deployed by CI** (`worker/index.ts` via `.github/workflows/deploy-cloudflare.yml`)
- **20 standalone worker projects exist under `workers/`**, each with its own `wrangler.toml`. None are deployed by the main CI workflow.

Declared worker names (from each subdir's `wrangler.toml`):

```
authichain-api               authichain-api-gateway
authichain-automation        authichain-autopilot
authichain-chain-data        authichain-com
authichain-dashboard         authichain-gateway
authichain-license-issuer    authichain-qron-provenance
authichain-scan-validate     authichain-telegram
authichain-verify-worker     govchain-us
qron-automation              qron-image-gen
qron-outreach                qron-space
resend-relay                 strainchain-io
```

**Phase 0 task before any worker consolidation:** for each of the 20, determine via `wrangler deployments list <name>` (or Cloudflare dashboard) whether it is:

- **DEPLOYED** — keep, document deploy mechanism, add to CI if missing
- **SCAFFOLDED** — has substance but never went live; decide salvage vs delete
- **PHANTOM** — empty stub or fully superseded by `worker/index.ts`; delete

Output of Phase 0 = a worker status table that becomes §4 of the eventual implementation plan. Without this, any move on `workers/` risks deleting production code.

**Naming hygiene:** 5 of the 20 dirs have a different name than their declared worker (e.g., `license-issuer/` declares `authichain-license-issuer`). Pick one convention and rename to match — but only after Phase 0.

---

## 5. Sibling salvage list — `C:\Users\rac\authichain` (Next.js)

Verified file paths and LOC counts. All HIGH-value items have been spot-checked (file exists, LOC matches scan).

### 5.1 HIGH-value lifts

| Source path (in `authichain/`) | LOC | Lift target (in `authichain-unified/`) | Why |
|---|---|---|---|
| `app/api/stripe/webhook/route.ts` | 319 | `server/_core/routes/stripe-webhook.ts` (or wherever current Stripe lives) | Idempotent via Airtable event-log dedup; handles 4 Stripe event types; production-shaped |
| `app/api/analytics/route.ts` | 81 | `server/_core/routes/analytics.ts` | Counterfeits-vs-authentic + 7-day trend aggregation; small and clean |
| `app/dashboard/brand/page.tsx` | 237 | `client/src/pages/brand-settings.tsx` | Brand-customization UI (logo, colors, verification message) — multi-tenant brand routing in unified can use this |
| `app/api/brand/route.ts` | 79 | paired with above | Backend for brand settings |
| `app/api/classify/route.ts` | 127 | `server/_core/routes/classify.ts` | OpenAI-backed classification — feeds AutoFlow |
| `app/api/verify/route.ts` | 120 | `server/_core/routes/verify.ts` | Core verification endpoint |
| `app/api/products/route.ts` | 118 | `server/_core/routes/products.ts` | Product CRUD |
| `app/auth/callback/route.ts` | 16 | `server/_core/routes/auth-callback.ts` | Supabase auth callback |
| `components/nft-certificate.tsx` | 135 | `client/src/components/nft/certificate.tsx` | Domain UI — NFT cert rendering |
| `components/seed-to-sale-timeline.tsx` | 325 | `client/src/components/strainchain/timeline.tsx` | Strainchain vertical UI — already a brand in unified |
| `components/truemark-fingerprint.tsx` | 101 | `client/src/components/verify/fingerprint.tsx` | Visual fingerprint UI |
| `components/microscopic-analysis.tsx` | 117 | `client/src/components/verify/microscopic-analysis.tsx` | Verification UI |
| `components/confidence-score.tsx` | 99 | `client/src/components/verify/confidence-score.tsx` | Verification UI |
| `components/product-classification-card.tsx` | 258 | `client/src/components/verify/classification-card.tsx` | Verification UI |
| `components/ai-story-player.tsx` | 335 | `client/src/components/verify/ai-story-player.tsx` | Verification UI |
| `components/ai-story.tsx` | 107 | `client/src/components/verify/ai-story.tsx` | Verification UI |

### 5.2 SKIP / ASSESS

- shadcn UI primitives (`components/ui/*`) — verify unified already has equivalents before lifting; default SKIP
- Replit integrations — only valuable if AuthiChain still uses Replit; default SKIP unless confirmed otherwise
- Vercel config — unified has its own `vercel.json`; SKIP

### 5.3 Process

Each lift = one PR. Sequence: lift the smallest/lowest-coupling first (analytics route), prove the pattern, then larger ones. Do NOT bulk-copy directories — each file gets a deliberate review so it can be adapted to unified's conventions (tRPC vs Next.js handlers, server file layout, etc.).

### 5.4 `authichain-mobile`

- No git history, no backend, three stub screens
- **Salvage value: zero**
- Action: archive (zip + push to a `_archive/` branch on a remote, or just zip and store offline), then `rm -rf`. Reversible if backed up.

---

## 6. External benchmark sidebar (background only)

Three reference projects worth glancing at when designing the consolidated architecture. Not action items.

- **OpenZeppelin Contracts + Defender** — reference for ERC-721 certificate patterns and signed-attestation flows; AuthiChain's contracts dir can borrow patterns
- **Self.id / Ceramic / Verifiable Credentials (W3C)** — reference for the data model around "claim about a physical object signed by an issuer"; useful background for the Truth Layer
- **Shopify's app extensions architecture** — reference for the multi-tenant brand-routing model in `wrangler.toml` (Authichain.com / Qron.space / Strainchain.io / Govchain.us all dispatched by Host header) — Shopify solved this at scale

These belong as a one-paragraph note in the eventual implementation plan, not as deliverables.

---

## 7. Execution sequence

Risk-ascending. Each item = one PR.

### Phase 0 — Investigate (no code changes)

| Step | Action | Output |
|---|---|---|
| P0.1 | `wrangler deployments list` for each of 20 workers | Status table: DEPLOYED / SCAFFOLDED / PHANTOM |
| P0.2 | `gh api repos/AuthiChain/{confident-germain,stupefied-almeida,sweet-liskov}` | Confirm whether the "remote forks" hold unique content |
| P0.3 | `grep -r "from \"\\.\\./src/\"" client/ server/` etc. | Confirm top-level `src/` is orphan |
| P0.4 | Verify `lib/ecosystem.ts` and `lib/industries.ts` import paths | Decide target dir for §3 C4 |

### Phase 1 — Trivial cleanups (LOW risk)

| Step | PR | Risk |
|---|---|---|
| 1.1 | C1 — delete `app/` | LOW |
| 1.2 | C5 — fix CLAUDE.md "8 workers" claim | NONE |
| 1.3 | (If P0.2 confirms empty) remove dead remotes | LOW |
| 1.4 | (If P0.3 confirms orphan) C2 — delete top-level `src/` | LOW |

### Phase 2 — Internal consolidation (LOW–MED risk)

| Step | PR | Risk |
|---|---|---|
| 2.1 | C3 — fold `components/` into `client/src/components/ecosystem/` | LOW |
| 2.2 | C4 — fold `lib/` into `client/src/lib/` (or `shared/`) | LOW |
| 2.3 | C6 — rename worker dirs to match declared names (only ones flagged DEPLOYED in P0.1) | MED |

### Phase 3 — Worker fleet decisions (MED risk, gated by Phase 0)

| Step | PR | Risk |
|---|---|---|
| 3.1 | Delete every `workers/<name>/` flagged PHANTOM in P0.1 | MED — destructive |
| 3.2 | Add CI deploy job(s) for each `workers/<name>/` flagged DEPLOYED — replace ad-hoc `deploy.sh` | MED |
| 3.3 | Decide: keep SCAFFOLDED workers or delete with archive tag | MED |

### Phase 4 — Sibling salvage from `authichain` (LOW–MED risk per file)

One PR per file (or per tightly-coupled small group). Order: smallest first.

| Step | PR | Risk |
|---|---|---|
| 4.1 | Lift `analytics/route.ts` | LOW (small, isolated) |
| 4.2 | Lift `verify/route.ts` + tests | MED |
| 4.3 | Lift `classify/route.ts` (OpenAI integration) | MED |
| 4.4 | Lift `stripe/webhook/route.ts` — adapt to current Stripe v22 API | MED |
| 4.5 | Lift brand-settings page + API | MED |
| 4.6 | Lift verification UI components batch | LOW (UI only) |
| 4.7 | Tag-archive `authichain` on its own remote, then `rm -rf C:\Users\rac\authichain` | LOW (backed up) |

### Phase 5 — `authichain-mobile` archival (LOW risk)

| Step | Action | Risk |
|---|---|---|
| 5.1 | Zip `authichain-mobile/`, push backup to a private gist or `_archive` branch | NONE |
| 5.2 | `rm -rf C:\Users\rac\authichain-mobile` | LOW (backed up) |

---

## 8. Out of scope

Explicit non-goals to prevent sprawl:

- **Not** consolidating items in `todo.md` — that's a feature backlog, separate effort
- **Not** renaming subsystems for taste (e.g., `_core/` vs `core/`) — only renames driven by reality (worker dir names that don't match declared names, post-Phase 0)
- **Not** introducing new abstractions or shared libraries beyond what the consolidation itself requires
- **Not** rewriting the salvage targets — each lift is a copy-and-minimal-adapt, not a re-architecture
- **Not** touching live production deploys until Phase 0 confirms what is live
- **Not** building the consolidated mobile app — `authichain-mobile` archives, full stop
- **Not** deciding the Truth Layer / vertical roadmap — that's product, not consolidation

---

## 9. Acceptance criteria for this consolidation effort overall

When all phases are done, these statements should be true:

1. Repo root has no orphaned top-level dirs (`app/`, possibly `src/`, possibly `components/`, possibly `lib/` are gone or absorbed)
2. CLAUDE.md accurately reflects the deployed worker count and architecture
3. Every worker that exists in the repo is either deployed via CI or explicitly marked as scaffolded with a TODO
4. `authichain` (Next.js sibling) has been archived; all worth-lifting code is in `authichain-unified` with file-level git provenance noted in commit messages
5. `authichain-mobile` is archived
6. No new features were added — purely structural consolidation
7. Every PR in the plan is independently revertable with `git revert`

---

## Appendix A — Evidence index

| Claim | Source |
|---|---|
| `client/` is build root | `vite.config.ts:165` |
| `@/` aliases to `client/src` | `vite.config.ts:159` |
| Server dev watches `server/_core/index.ts` | `package.json:7` |
| `api/server.js` is build output | `vercel.json:7` |
| Single worker deployed | `wrangler.toml:2` + `.github/workflows/deploy-cloudflare.yml:54-63` |
| 20 worker dirs | `ls workers/` |
| `app/` has 2 files | `ls app/` → `globals.css`, `layout.tsx` |
| `lib/` has 2 files | `ls lib/` → `ecosystem.ts`, `industries.ts` |
| `components/` has 2 files | `ls components/` → `ecosystem-footer.tsx`, `ecosystem-nav.tsx` |
| `packages/` has 1 pkg | `ls packages/` → `vector-store` |
| Sibling LOC | `find . -name "*.ts*" \| xargs wc -l` in `authichain/` → 14,545 |
| Stripe webhook 319 LOC | `wc -l authichain/app/api/stripe/webhook/route.ts` |
| Brand page 237 LOC | `wc -l authichain/app/dashboard/brand/page.tsx` |
| Analytics 81 LOC | `wc -l authichain/app/api/analytics/route.ts` |
| `authichain-mobile` not a git repo | absence of `.git/` directory |
| Only `Qron-protocal` in AuthiChain GitHub org | `gh repo list AuthiChain --limit 20` |
