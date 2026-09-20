# Undone0603 GitHub repo inventory — 2026-09-20

**Method:** `gh api` only (no clones). Compared against remote `undone0603/authichain-unified` (`main`, last push ~2026-09-20 08:05 EDT).  
**Scope:** all 29 repos from `/tmp/undone-repos.json`.  
**Secrets:** never printed; see `/workspace/notes/SECRET_PATHS_NOTED.txt` for path-only notes.  
**Pulled text:** `/workspace/notes/pulled-from-undone0603/`.

Times below are **ET** (America/New_York).

---

## Score legend
| Score | Meaning |
|------:|---------|
| 5 | Unique, revenue/launch-relevant, worth PR or active reuse |
| 4 | Strong unique docs/code; reconcile before merge |
| 3 | Partial overlap or niche product; keep notes |
| 2 | Superseded snapshot / thin; archive candidate |
| 1 | Skip / unrelated fork / empty |

**Overlap:** none = not in unified · partial = some concepts/code already there · superseded = README says use unified / landed in workers

---

## Live monorepo (baseline)

### authichain-unified
- **Purpose:** Canonical multi-tenant Authichain / QRON / StrainChain / GovChain platform (Next.js, CF Workers, Supabase, agentz, Stripe/x402, outreach).
- **Last push:** 2026-09-20 ~08:05 ET · public · TypeScript · `main`
- **Notable:** `docs/`, `workers/*`, `agentz/`, `server/revenue-engine/`, `content/social/`, pricing/Stripe/x402 already deep.
- **Overlap:** N/A (target)
- **Usefulness:** 5 (destination)

---

## PRIORITY SCAN

### 1. authichain-ai-business-manager (private)
- **Purpose:** Autonomous BD — health checks, content gen, CRM/Notion sync, token metrics, CF workers (daily-tasks, social-engine, customer-engagement).
- **Last push:** 2026-09-20 ~05:05 ET · JS · `main`
- **Notable paths:** `scripts/*.js`, `workers/*/index.js`, `.github/workflows/*`, `content/generated/`, massive `reports/{health,token,notion-sync}/` (ops noise).
- **Overlap:** **partial** — unified `agentz/` + marketing/outreach workflows supersede most BD loops; workers/scripts still unique patterns (weekly digest, social-engine worker shape).
- **Usefulness:** **4**
- **Notes:** `scripts/setup-secrets.sh` — secret present (env→gh secret); do not copy. Repo mostly report commits; source still valuable for PR into `ops/` or `agentz` notes.

### 2. authichain_premium (public)
- **Purpose:** Historical NFT auth marketplace (Oct 2025).
- **Last push:** 2026-09-16 ~06:43 ET · TS · `clean-branch`
- **Notable:** README explicitly **Superseded** → unified. Demo passwords called out as historical (do not reuse).
- **Overlap:** **superseded**
- **Usefulness:** **2** — archive in GitHub Settings.

### 3. authichain-protocol (private)
- **Purpose:** Manus-built PoA protocol platform (objects, agents, AuthiCharacters, marketplace, Pricing/Docs pages).
- **Last push:** 2026-05-09 ~16:34 ET · TS · `main`
- **Notable:** `client/src/pages/{Pricing,Docs,Home,Marketplace,Verify}.tsx`, drizzle schema, tRPC-style API surface in Docs.
- **Overlap:** **partial** — product ideas folded into unified; Pricing tiers ($0/$49/$199/Custom) are **historical**, conflict with unified pricing reconciliation docs.
- **Usefulness:** **4** — copy/positioning + historical tier inventory for reconciliation; do not ship prices blindly.

### 4. authichain (private)
- **Purpose:** Early Next.js 14 + Supabase + GPT-4 Vision TrueMark product auth.
- **Last push:** 2026-05-09 ~15:13 ET
- **Notable:** classic `app/` structure, `supabase/schema.sql` (sibling of archive).
- **Overlap:** **superseded** by unified (+ archive tag).
- **Usefulness:** **2**

### 5. authichain-archive (private)
- **Purpose:** Frozen Next.js sibling (`archive/2026-04-27` tag).
- **Last push:** 2026-04-27 ~11:15 ET · Shell
- **Overlap:** **superseded**
- **Usefulness:** **1–2** — freeze only.

### 6. authichain-unified-revenue-engine (private)
- **Purpose:** Feb 2026 autonomous revenue architecture: CF worker lead scoring, email engine, Airtable CRM, revenue tracker + Python pipeline.
- **Last push:** 2026-02-19 ~16:35 ET · TS · `master`
- **Notable:** `ARCHITECTURE.md`, `automation/pipeline.py`, `workers/src/services/{lead-scoring,email-engine,revenue-tracker,airtable}.ts`
- **Overlap:** **partial** — unified has `server/revenue-engine/` + agentz outreach; this ARCHITECTURE + lead-scoring/email templates are still unique reference.
- **Usefulness:** **5** — top pull for monetization playbook / worker patterns.
- **Caveat:** `workers/node_modules` was committed (do not pull).

### 7. authichain-os
- **Purpose:** Stub (`README` only: “authichain-protocol-os”).
- **Last push:** 2026-02-25 ~08:10 ET
- **Overlap:** none meaningful
- **Usefulness:** **1**

### 8. authichain-com / qron-space / qron-platform / qron-harvest / qron-starter-v2 / qron-webapp / qron

| Repo | Last push (ET) | Purpose | Overlap | Score |
|------|----------------|---------|---------|------:|
| authichain-com | 2026-09-16 ~06:42 | Landing snapshot; README → `workers/authichain-com` | superseded | 2 |
| qron-space | 2026-09-16 ~06:42 | Landing snapshot → `workers/qron-space` | superseded | 2 |
| qron-platform | 2026-09-16 ~06:42 | Historical Next+Worker sketch | superseded | 2 |
| qron-harvest | 2026-09-16 ~06:43 | HARVEST Living Seal pilot stub (Wilson Harper NFC) | partial (unified has `workers/harvestchain-io`) | 3 |
| qron-starter-v2 | 2026-03-25 ~17:11 | Full QRON starter README + OpenAPI; modes/pricing framing | partial | **4** |
| qron-webapp (priv) | 2025-12-15 ~08:59 | **Goldmine** marketing pack: Living Portals strategy, launch checklist, social libraries, Telegram bot | **none/partial** (not found as same filenames in unified tree) | **5** |
| qron (fork) | 2026-05-02 ~21:13 | Upstream fork; no unique Authichain IP assumed | skip unless diff later | 1 |

### 9. strainchain-io / strainchain-telegram-app

| Repo | Last push (ET) | Notes | Overlap | Score |
|------|----------------|-------|---------|------:|
| strainchain-io | 2026-09-16 ~06:42 | Landing snapshot → unified worker | superseded | 2 |
| strainchain-telegram-app | 2025-07-04 ~16:33 | HTML mini-app + **PDFs**: Business Proposal, Technical Whitepaper; Privacy/ToS are Claude artifact URL stubs only | partial | **3** (PDF binaries not pulled; note for manual extract) |

### 10. govchain.us
- Landing snapshot → `workers/govchain-us`. Superseded. Score **2**.

### 11. claimpilot
- **Purpose:** Class-action claim eligibility scoring engine + Supabase migration + Next routes (2026-09-15).
- **Last push:** 2026-09-15 ~11:43 ET
- **Notable:** `lib/claimpilot/engine.ts`, `supabase/migrations/202609150001_claimpilot.sql`
- **Overlap:** **none** in unified (no claimpilot hits via contents/search before rate limit).
- **Usefulness:** **3–4** — adjacent monetization product; “notes / optional vertical,” not core Authichain launch unless productized.

### 12. cf-workers (private)
- **Purpose:** “Maison Elite autonomous dropship + supporting workers”
- **Last push:** 2026-05-29 ~18:44 ET
- **Tree:** **empty repo** (API 409). Nothing to pull.
- **Usefulness:** **1** — recreate or find content elsewhere.

### 13. undone0603.github.io
- **Purpose:** Technical blog — EU DPP / brand protection article + index.
- **Last push:** 2026-07-17 ~15:17 ET
- **Notable:** `eu-dpp-registry-launch-manufacturers.html`, `index.html`
- **Overlap:** **partial** — unified has EU DPP compliance docs; this is **SEO/content** article not the same file.
- **Usefulness:** **5** — republish under unified content/blog for DPP traffic.

### 14. collective-cloud (private)
- **Purpose:** 3D globe community mapping (Workers preview). Not Authichain primary.
- **Last push:** 2026-09-19 ~16:59 ET
- **Transferable:** CF Workers static deploy patterns only.
- **Usefulness:** **2** (notes only)

---

## SKIP / low priority (brief)

| Repo | Why skip | Score |
|------|----------|------:|
| antigravity-sdk-python | Upstream fork | 1 |
| AuthiChain-1 | Fork; no unique IP scan | 1 |
| agent-browser | Fork; already vendored under unified `apps/agent-browser` | 1 |
| stable-diffusion-webui | Unrelated fork | 1 |
| magic_eye | Unrelated fork | 1 |
| nextjs-boilerplate (priv) | Generic boilerplate | 1 |
| Validation-key | README-only stub | 1 |

---

## Cross-cutting search notes (gh code search)

Most hits for `pricing`, `stripe`, `x402`, `IndexNow`, `passport`, `DPP`, `outreach`, `license` resolve inside **authichain-unified** already — estate is consolidated. Unique residual IP is concentrated in:
1. `qron-webapp` marketing docs  
2. `authichain-unified-revenue-engine` architecture/services  
3. `authichain-ai-business-manager` workers/scripts  
4. `undone0603.github.io` DPP article  
5. `authichain-protocol` historical Pricing/Docs/Home  
6. `claimpilot` engine  
7. StrainChain telegram **PDFs** (not copied)

Rate limit hit mid-search; further searches deferred — inventory still complete via trees/READMEs.

---

## Archive recommendation (revenue-first hygiene)

After confirming DNS on unified workers, archive in GitHub Settings:  
`authichain_premium`, `authichain-com`, `qron-space`, `qron-platform`, `strainchain-io`, `govchain.us` (already self-labeled superseded).
