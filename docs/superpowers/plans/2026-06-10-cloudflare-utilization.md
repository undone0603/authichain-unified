# Cloudflare Workers/Pages Utilization Plan

**Date:** 2026-06-10
**Status:** Account review complete. Strategy approved by owner: **Consolidate + salvage.**
**Cloudflare account:** `4c1869b90f13f86940aa3747839bf420` (undone.k@gmail.com)
**Complements** `2026-04-27-ecosystem-consolidation.md` (Phase 3) with live-account reality as of today.

---

## Account reality (reviewed 2026-06-10)

### Workers: 68 deployed (repo has 20 dirs + root worker + top-level src/ scaffold)
- The 8 workers listed as SCAFFOLDED in `worker-status-2026-04-27.md` were **all deployed 2026-06-02..04**.
- ~12 repo workers were bulk-redeployed **2026-06-08 16:22** (CI matrix from `.github/workflows/deploy-cloudflare.yml`, which auto-discovers every `workers/*/wrangler.toml` — including their cron triggers).
- **~47 workers have no source in this repo** (older eras): outreach/automation (authichain-outreach-engine, outreach-queue, qron-daily-ops, qron-self-heal, qron-seo-engine, qron-fiverr, gmail-relay-z), landing pages (authichain-landing-com/-qron, authentic-economy-portal, qron-portfolio, qron-demos), 4+ stripe listeners, telegram bots, one-offs (`esktop`, `auth`, `analytics`, `blockchain`, vertical clones).

### Traffic reality
| Surface | Served by | Notes |
|---|---|---|
| authichain.com `/` + www | CF Worker `authichain-com` (exact-path routes) | Polished landing — **had zero links to the product** |
| authichain.com deep paths | CF Worker `authichain-landing-com` (`authichain.com/*` glob) | 404s everything |
| authichain.com/api/qron/scan-validate* | `authichain-scan-validate` (custom-domain route) | Real edge API + D1 |
| app.authichain.com | **Vercel `authichain-unified-v2`** | The actual product (live 2026-06-10, cert issued) |
| *.authichain.com brand subdomains | Vercel `authichain-unified-v2` | Multi-tenant aliases |
| qron.space, strainchain.io, govchain.us | **Vercel** (separate projects) | DNS bypasses Cloudflare entirely — the same-named CF workers receive no traffic |

### Pages: 15 projects — effectively dead
Live: 3 StrainChain promo variants + vite-react-template. Dead (404/500/522): the other 10, including authichain-com.pages.dev and authichain-premium. **Nothing routes a production domain to Pages.** Verdict: no utilization value; archive/delete.

### 🔴 Security/risk findings (live worker code, read via Cloudflare API)
1. **`qron-daily-ops` has hardcoded live secrets in its deployed bundle**: a **live Stripe secret key** (`sk_live_51SXIyE…`), a Groq API key, and the Supabase anon key. → **Rotate the Stripe live key and Groq key**, then redeploy with `wrangler secret put`. (2026-06-10 update: `qron-fiverr` had the SAME live Stripe key hardcoded and used it for real checkout sessions — that worker is now deleted, but the key was exposed in two bundles; rotation remains mandatory.)
2. **`qron-outreach` is a live cold-email machine**: 9-company queue (Lume, Compass, Lettuce Entertain You, C3 Industries…), cron `0 */4 * * *` (redeployed by CI on 06-08), `scheduled()` auto-sends 3/tick through `resend-relay`. Its KV dedup expires after 30 days → could re-send to the same people indefinitely. Sends may currently be failing on the worker→worker hop (error 1042 observed), but that is luck, not a control. → **Remove the cron trigger / undeploy** pending an explicit outreach decision.
3. **`resend-relay` is fully armed**: verified `authichain.com` sender, SPF+DKIM+DMARC, 3000/day. Keep (it is the one good outbound channel) but treat anything that can call it as production-sensitive.
4. `qron-automation` crons (`*/30`, `0 */6`, `0 12`) and `qron-daily-ops` daily digest are owner-directed (reports to authichain@gmail.com) — benign behavior, but same hardcoded-secret problem.
5. `qron-outreach` `/status` auth uses a hardcoded default token in code.

---

## The plan (consolidate + salvage)

### Phase 1 — Connect the apex to the product ✅ STAGED (deploy pending owner authorization)
The #1 utilization gap: authichain.com (the polished landing) never linked to the live app.
- `workers/authichain-com/src/index.ts`: added nav "Launch App" CTA + hero CTA → `https://app.authichain.com`; added `/login`, `/signin`, `/app*` → 302 redirects.
- `workers/authichain-com/wrangler.toml`: added explicit routes for those paths (explicit beats the `/*` glob held by `authichain-landing-com`).
- Deploy: `npx wrangler deploy --config workers/authichain-com/wrangler.toml` (from WSL repo root).
- Verify: `curl -I https://authichain.com/login` → 302 to app.authichain.com; apex HTML contains "Launch App".

### Phase 2 — Quiesce outbound risk (owner authorization required)
- Remove cron from `workers/qron-outreach/wrangler.toml` and redeploy (or delete the worker). NOTE: CI redeploys every `workers/*/wrangler.toml` on push — removing the cron in-repo is the durable fix; dashboard-only changes get clobbered.
- Audit/strip crons of no-source workers via dashboard: qron-daily-ops, qron-self-heal, qron-seo-engine, qron-fiverr, authichain-outreach-engine, outreach-queue.
- Rotate the exposed **Stripe live key** (Stripe dashboard → roll key; update Vercel env + any worker that legitimately needs it via `wrangler secret put`) and the Groq key.

### Phase 3 — Salvage list (keep + document)
| Worker | Why keep |
|---|---|
| `authichain-com` | The apex landing (now linked to app) |
| `authichain-scan-validate` | Live edge API on authichain.com/api/qron/scan-validate* (D1) |
| `resend-relay` | The verified outbound email channel (3000/day) |
| `qron-image-gen` | QR-art generation used by QRON properties |
| `authichain-license-issuer`, `authichain-verify-worker`, `authichain-qron-provenance`, `authichain-gateway` | Substantive scaffolds (Stripe+JWT+ECC licensing, verification, rate-limiting) — keep dormant as future edge APIs |
| `qron-daily-ops` (after secret fix) | Useful daily owner digest |

### Phase 4 — Decommission (explicit per-batch confirmation)
- **Batch 1 DONE (2026-06-10, owner-approved):** deleted 12 workers (68→56): `esktop` (empty script), `square-feather-870cqron-token-monitor`, `proud-unit-9791qron-api-gateway`, `strainchain`, `api-strainchain`, `strainchain-nft-api`, `outreach-queue` (code-verified: consumer only marked jobs "drained", never sent; also removed its dead `outreach-jobs` queue — 0 producers), `qron-seo-engine` (qron.space DNS bypasses CF, zero traffic), `govchain`, `qron-demos`, plus risk pair `qron-fiverr` (🔴 hardcoded live Stripe key — SECOND worker with the same `sk_live_51SXIyE…` key; live checkout page) and `authichain-outreach-engine` (D1 cold-email engine with scheduled()). Code archived in `docs/archive/cf-workers/` first. Deletion mechanics: wrangler OAuth token from WSL `~/.config/.wrangler/config/default.toml` + raw API `DELETE /workers/scripts/{name}?force=true`; queue-consumer workers need the consumer detached first (error 10064).
- **Batch 2 DONE (2026-06-10, owner-approved): 24 more deleted (56→32).** Scaffolds/empties (`govchain-resolver` 0B, `auth`, `analytics`, `ai-classification`, `blockchain`), dead landings (`authichain-landing-com`, `authichain-landing-qron`, `authentic-economy-portal`), May-01 constellation (`authichain-qron-agentz`, `-autonomous-nexus`, `-ecosystem-pulse`, `-consensus-engine`), superseded (`qron-images`, `authichain-verify`, `authichain-verifier`, `admin-dashboard`, `health-monitor`), clones/demos (`watchchain-io-vertical`, `maison-elite-store`, `qron-edge-fleet`, `authichain-infra`, `authichain-marketplace-webhook`, `qrontoken-telegram-bot`), and legacy apex worker `authichain-unified`. All code archived in `docs/archive/cf-workers/`. Repo dir `workers/outreach-queue/` removed so CI can't resurrect the deleted worker.
- **Route corrections discovered via zone API:** the `authichain.com/*` + `www.authichain.com/*` globs belonged to `authichain-unified` (NOT `authichain-landing-com`, which held zero routes — the April audit was wrong). Globs re-pointed to `authichain-com` (its fallback serves the landing for any deep path — deep-path 404s are gone) and added to `workers/authichain-com/wrangler.toml` for CI durability.
- **⚠ Incident + fix:** force-deleting `authichain-unified` also deleted the apex **Workers Custom Domain** (`authichain.com` DNS record) → apex went unresolvable for ~10 min. Restored with `PUT /accounts/{acct}/workers/domains {"zone_id":…,"hostname":"authichain.com","service":"authichain-com"}` (wrangler OAuth token CAN manage workers/domains even though it cannot touch the zone DNS API). All hostnames verified after: apex 200, deep 200 + Launch App, /login 302→app, api 200, dashboard 401 (auth gate), app 200.
- **Orphans audit facts:** zero cron triggers remain on ANY orphan (schedules endpoint verified working against qron-automation's 3 crons). 🔴 `qron-stripe-webhook` is a THIRD bundle embedding the same `sk_live_51SXIyE…` key.
- **Batch 3 (pending owner's Stripe dashboard check):** `stripe-webhook`, `stripe-provisioner`, `stripe-listener`, `authichain-stripe-listener`, `qron-stripe-webhook` — verify none is a registered Stripe webhook endpoint doing real fulfillment before deleting (check while rotating the key).
- **Kept orphans:** `gmail-relay-z` (owner-email relay used by self-heal/daily-ops), `qron-self-heal` (dormant monitor), `qron-daily-ops` (salvage after secret fix), `qron-ai-api` (QR generation backend), `qron-portfolio` (referenced by outreach copy).
- 10 dead Pages projects (404/500/522) + 3 stale StrainChain promos once strainchain.io content supersedes them.
- Separate pass later: 15 non-canonical Vercel projects.

### Verification
- After Phase 1: apex CTA visible, /login redirects, app reachable from the landing.
- After Phase 2: no cron triggers remain on outreach-capable workers (dashboard check); old Stripe key revoked (Stripe dashboard shows roll date); fresh keys only in secret stores.
- After Phase 4: `workers_list` count drops to ~20 known workers; Pages list to ≤5.
