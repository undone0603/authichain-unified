# Pull candidates for authichain-unified — 2026-09-20

Ranked for **money / traffic / launch**. Assets already copied under `/workspace/notes/pulled-from-undone0603/<repo>/`.  
Prices found in historical docs are **source-labeled only** — reconcile with live Stripe/`plans.ts` before any customer-facing PR (no invented prices).

---

## Ranked list

### P1 — QRON Living Portals marketing pack (`qron-webapp`)
| What | Why money/traffic | Suggested destination | Risk |
|------|-------------------|----------------------|------|
| `QRON-LIVING-PORTALS-MASTER-STRATEGY.md` | Brand positioning + mode tiers; launch narrative | `docs/marketing/qron/QRON-LIVING-PORTALS-MASTER-STRATEGY.md` or `content/launch/` | **Stale prices** ($5–35 etc.) — rewrite against live plans |
| `ONE-CLICK-LAUNCH-CHECKLIST.md` | Hour-by-hour launch execution | `docs/launch/qron-one-click-checklist.md` | Stale account names; still excellent ops skeleton |
| `TWITTER-READY-TO-POST.md` + `SOCIAL-MEDIA-CONTENT-LIBRARY.md` + `INSTAGRAM-LINKEDIN-READY.md` | Ready social → traffic → checkout | `content/social/archive-qron-2025/` then regenerate via `content-publish` | Copy mentions old prices; scrub before auto-post |
| `SAMPLE-CATALOG.md` | Productized SKU storytelling for QRON modes | `docs/marketing/qron/SAMPLE-CATALOG.md` | Image filenames may not exist in unified |

**Copied:** yes (6 markdown files).  
**Next action:** PR docs + scrub price strings to “see /pricing”. Wire best posts into content pipeline.

### P2 — EU DPP manufacturer article (`undone0603.github.io`)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| `eu-dpp-registry-launch-manufacturers.html` (+ excerpt `.md`) | SEO/inbound for DPP $ path & manufacturer outreach | `content/` blog or `workers/authichain-com` docs page; IndexNow after publish | HTML themed standalone — convert to MDX/MD; refresh dates vs EU timeline |

**Copied:** yes.  
**Next action:** Convert to unified content format; add CTA to `/pricing` + `/api/checkout/dpp`.

### P3 — Revenue engine architecture & services (`authichain-unified-revenue-engine`)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| `ARCHITECTURE.md` | End-to-end autonomous revenue mental model | `docs/strategy/legacy-revenue-engine-ARCHITECTURE.md` | Feb 2026; Airtable-centric — map to HubSpot/agentz |
| `lead-scoring.ts`, `email-engine.ts`, `revenue-tracker.ts` | Scoring + outreach email patterns | **notes only** first; selectively port into `agentz/core/outreach*` / worker | Conflict with newer outreach guardrails |
| `automation/pipeline.py` | Pipeline orchestration reference | notes / compare to `agentz/workflows` | May duplicate revenue-cycle |

**Copied:** yes.  
**Next action:** Diff vs `server/revenue-engine/*` + agentz; port only missing lead-score heuristics.

### P4 — AI business manager workers/scripts (`authichain-ai-business-manager`)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| `workers/social-engine/index.js`, `customer-engagement/index.js`, `daily-tasks/index.js` | CF worker patterns for social/engagement loops | notes → optional `workers/` or agentz handlers | Overlap with marketing-autonomous / content-publish; secrets via wrangler |
| `scripts/generate-content.js`, `weekly-digest.js` | Content + weekly exec digest | `ops/scripts/` or agentz reports | Template-fallback copy quality low; May 2026 content stale |
| workflows YAML | Cron shapes | compare to unified `.github/workflows` | Do not duplicate jobs that already run |

**Copied:** yes (scripts + 3 workers + sample content JSON).  
**Skipped:** `scripts/setup-secrets.sh` (secret present — do not copy).  
**Next action:** Steal weekly-digest → GitHub issue summary pattern if unified lacks it.

### P5 — Protocol historical pricing & home copy (`authichain-protocol`)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| `HISTORICAL_PRICING_TIERS.md` (extracted) | Reconcile vs live plans; feature checklist | `docs/strategy/historical-protocol-pricing-tiers.md` | **Conflict** with pricing reconciliation — never publish as live |
| `Pricing.tsx`, `Home.tsx` | Feature bullets / positioning language | notes; cherry-pick copy into landing | Stale Manus UI |

**Copied:** yes.  
**Next action:** Use feature lists for landing copy A/B only after money-path truth.

### P6 — QRON starter OpenAPI + README (`qron-starter-v2`)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| `README.md` | Mode catalog (11 modes), integrations list | `docs/qron/starter-legacy-readme.md` | Env var names; “under 30 minutes” claims |
| `docs/openapi.yaml` | API surface reference | compare to unified `docs/openapi.yaml` | Drift |

**Copied:** yes.  
**Next action:** Diff OpenAPI; import unique endpoints only.

### P7 — ClaimPilot engine (optional vertical)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| `engine.ts` + SQL migration | Adjacent B2C monetization | `apps/claimpilot/` **only if** product decision; else notes | Scope creep vs Authichain launch |

**Copied:** yes.  
**Next action:** Product call — keep parked unless claim funnel is in Q4 plan.

### P8 — StrainChain telegram PDFs (not copied)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| `StrainChain Business Proposal.pdf`, `Technical Whitepaper.pdf` | Partner/outreach collateral | Extract text → `docs/strategy/strainchain-*` | Binary; may be outdated legally |
| Privacy/ToS files | — | skip | Stub Claude artifact URLs only |

**Copied:** no (binaries).  
**Next action:** `gh api` download + `pdftotext` in a follow-up if needed.

### P9 — HARVEST pilot (`qron-harvest`)
| What | Why | Destination | Risk |
|------|-----|-------------|------|
| Stub `index.html` | Points to Wilson Harper NFC pilot | already mirrored by `workers/harvestchain-io` | Thin stub |

**Copied:** no (636B stub only). Notes only.

### Deprioritized / do not PR
- Superseded landings: authichain-com, qron-space, qron-platform, strainchain-io, govchain.us, authichain_premium  
- Empty: cf-workers  
- Stub: authichain-os, Validation-key  
- Unrelated forks: antigravity, agent-browser, SD webui, magic_eye, AuthiChain-1, qron fork  
- collective-cloud: non-core  

---

## Suggested PR sequence into authichain-unified

1. **docs(marketing):** QRON Living Portals pack (price-scrubbed) + launch checklist  
2. **content(seo):** EU DPP manufacturer article → publish + IndexNow money URLs  
3. **docs(strategy):** legacy revenue-engine ARCHITECTURE + historical protocol tiers (labeled non-live)  
4. **ops:** optional weekly-digest / social-engine patterns after diff vs existing workflows  
5. **product decision:** ClaimPilot vertical vs stay notes-only  
6. **follow-up:** StrainChain PDF text extraction  

## Blockers
- GitHub **code search rate limit** during scan (trees/READMEs still complete).  
- `cf-workers` empty — Maison Elite IP not recoverable from this account tree.  
- Historical **multi-price** sources (protocol $49/$199 vs QRON pack $5–35 vs unified reconciliation) — any customer-facing copy must use live Stripe/`plans.ts` only.  
- StrainChain legal stubs useless; PDFs need separate extract.  
- BD manager still actively pushing **report noise** — archive or stop report commits before merging scripts.

## Copied file index
```
pulled-from-undone0603/
  authichain-ai-business-manager/  (scripts, workers, sample content)
  authichain-protocol/             (Pricing.tsx, Home.tsx, HISTORICAL_PRICING_TIERS.md)
  authichain-unified-revenue-engine/ (ARCHITECTURE + pipeline + 3 services)
  claimpilot/                      (engine.ts, migration SQL)
  qron-starter-v2/                 (README, openapi.yaml)
  qron-webapp/                     (6 marketing markdowns)
  undone0603.github.io/            (EU DPP HTML + excerpt MD + index)
```
(~380K total text; no secrets copied.)
