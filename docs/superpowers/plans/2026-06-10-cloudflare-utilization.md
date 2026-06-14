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
1. **`qron-daily-ops` has hardcoded secrets in its deployed bundle**: a Stripe secret key (`sk_live_51SXIyE…`), a Groq API key, and the Supabase anon key. (2026-06-10: `qron-fiverr` and `qron-stripe-webhook` embedded the SAME key — three bundles total.) **2026-06-11 RESOLVED: the Stripe key is EXPIRED** — verified via read-only `GET /v1/balance` → 401 `api_key_expired`; it was rolled at some point before this audit and no longer appears in the dashboard. No rotation needed. **The Groq key is also dead** (2026-06-11: `GET /v1/models` → 401 `invalid_api_key`). Both hardcoded secrets are inert; finding closed. (The Supabase anon key is public-by-design.) If qron-daily-ops is ever revived, give it fresh keys via `wrangler secret put` — note its Stripe/Groq calls currently fail at runtime, so its daily digest is partially broken anyway.
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
- **Batch 3 DONE (2026-06-11, owner-approved): 5 deleted (32→27)** — `stripe-webhook` (262KB), `stripe-provisioner` (247KB), `stripe-listener`, `authichain-stripe-listener`, `qron-stripe-webhook`. Gate cleared by recon (`scripts/batch3-recon.sh`): owner read the Stripe dashboard — 3 registered webhook endpoints, none reaching these workers (`api.authichain.com/webhook/stripe` → `authichain-api-gateway`, repo-managed, GET→401; `app.qron.space/api/webhook` → Vercel; `authichain.com/api/stripe/webhook` → apex glob → landing page); the 5 held zero routes/custom domains/crons; embedded key expired. Archived first (`scripts/batch3-decommission.sh`). Apex + api verified 200 after.
- **⚠ Vestigial Stripe webhook "brilliant-jubilee"** (`authichain.com/api/stripe/webhook`, 7 events configured): now delivers into the static landing page — Stripe sees 200 but nothing processes events. Owner will disable it in the Stripe dashboard; if real Stripe fulfillment ships later, register the Vercel app's webhook handler instead.
- **Kept orphans (5):** `gmail-relay-z` (owner-email relay used by self-heal/daily-ops), `qron-self-heal` (dormant monitor), `qron-daily-ops` (salvage after secret fix), `qron-ai-api` (QR generation backend), `qron-portfolio` (referenced by outreach copy). Final: **27 workers = 22 repo-managed + these 5.**
- **Pages cleanup DONE (2026-06-11, owner-approved): 16 → 1 (kept authichain-dashboard).** 16 projects found (not 15) — none held custom domains (deletion couldn't break DNS). Batch A: 11 dead (404/500/522) incl. `authichain-com` + `authichain-unified` Pages, which were git-connected to undone0603/authichain-unified and auto-building (and 404ing) on every push. Batch B: 4 live-but-orphaned StrainChain promos (strainchain, strainchain-frontend, strainchain1, vite-react-template) — homepage HTML snapshotted to `docs/archive/cf-pages/` first. Kept: `authichain-dashboard` (200; the production dashboard.authichain.com is the same-named WORKER, this Pages copy is a harmless staging artifact). Mechanics: simple `DELETE /pages/projects/{name}` works until error 8000076 (too many deployments) — then bulk-delete deployments (`DELETE …/deployments/{id}?force=true`, paginated 25/page, xargs -P4; tolerate individual failures — xargs exit 123 + set -e killed one run; detect "stuck" by identical id list two passes running, the project DELETE succeeds anyway once the bulk is gone). The git-connected projects had 360–1450 accumulated deployments each.
- **Vercel cleanup DONE (2026-06-11, owner-approved): 16 → 4 projects.** Deleted 12 (zac, authichain-unified — which held inert `authichain.com`+www domain claims, freeing 50-cap slots —, qron-app, authichain-unified2, undone0603-authichain-unified, agentz, build-tools, authichain_premium, authichain-unified-main, authichain-protocol, strainchain-site, deploy). Kept the 4 domain-holders: `authichain-unified-v2` (app.authichain.com + 9 brand subdomains), `qron-platform` (qron.space/www/app — app.qron.space hosts a REGISTERED Stripe webhook), `govchain-us`, `strainchain-io`. Mechanics: `vercel project rm` is interactive-only; use `vercel api "/v9/projects/{name}?teamId=…" -X DELETE --dangerously-skip-permissions`. Post-delete smoke: all 6 production domains 200.

### Verification — ALL MET (2026-06-11)
- Phase 1: apex CTA visible, /login 302 → app.authichain.com, deep paths serve the landing. ✅
- Phase 2: zero cron triggers on any orphan; both hardcoded keys verified DEAD (Stripe `api_key_expired`, Groq `invalid_api_key`) — nothing to rotate. ✅
- Phase 4 final state: **Workers 68→27** (22 repo + 5 keeps) · **Pages 16→1** (authichain-dashboard) · **Vercel 16→4** (authichain-unified-v2, qron-platform, govchain-us, strainchain-io). All 6 production domains 200 after every batch. Archives: 41 worker bundles in `docs/archive/cf-workers/`, 4 promo snapshots in `docs/archive/cf-pages/`. ✅
- Stripe webhooks: 2 real endpoints remain (api.authichain.com → authichain-api-gateway; app.qron.space → qron-platform); vestigial "brilliant-jubilee" disabled by owner. ✅
