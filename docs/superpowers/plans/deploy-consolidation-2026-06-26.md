# Deploy Consolidation Plan — single Vercel source of truth

**Date:** 2026-06-26
**Status:** Proposed (not started)
**Owner:** undone0603
**Context:** PR #426 switched Vercel to `framework: nextjs`. This exposed that the
production deploy topology is duplicated and fragile. This plan consolidates it.

---

## 1. Current state (verified 2026-06-26)

```
authichain.com ─▶ Cloudflare worker "authichain-com" (4ed85cfd…)
                    └─ proxies app routes to ─▶ authichain-unified.vercel.app
                                                 └─ Next build ERRORS (dashboard
                                                    Build Command/Output Dir override
                                                    runs Vite → no .next) → frozen on
                                                    last good VITE deploy → serves OLD app

qron-platform.vercel.app ─▶ ✅ full Next.js app, verified live
                              (x402 /api/x402/health 200, /api/v1/agent-verify,
                               programmatic-SEO /p/[slug], 8 HTTP crons, tRPC)
                              owns domains: authichain.com, www/app.authichain.com,
                               strainchain.io, govchain.us, qron.space (+ www/app)
```

### Why it's fragile
- **Two Vercel projects build the same repo** (`qron-platform` + `authichain-unified`)
  from the same `vercel.json`, but with different dashboard build-setting overrides →
  the same commit succeeds on one and ERRORs on the other.
- **A Cloudflare worker proxies between them**, pinning `authichain.com` to the wrong
  (now-broken) project. The worker hardcodes `authichain-unified.vercel.app` in its
  bundle (no `PRIMARY_APP_URL` var on the deployed worker; source-of-truth unclear —
  not deployed by `.github/workflows/deploy-cloudflare.yml`, which only deploys
  `authichain-dashboard` + `authichain-scan-validate`).
- **6 Vercel projects** total in the team (authichain-unified, authichain-unified-v2,
  qron-platform, govchain-us, strainchain-io, authichain-portfolio) and **41 Cloudflare
  workers** — heavy duplication, unclear ownership.

---

## 2. Target state

**One canonical Vercel project = `qron-platform`** serving all brand domains with the
Next.js app. No proxy hop. `authichain-unified` retired. The apex Cloudflare worker
either removed or reduced to pure brand/Host concerns it uniquely owns (if any).

```
authichain.com / strainchain.io / govchain.us / qron.space
   └─▶ qron-platform.vercel.app (Next.js, brand routing via Next middleware)
```

---

## 3. Migration steps (ordered, each reversible)

### Phase A — make the apex serve the working app (fast unblock)
Pick ONE:

- **A1 (smallest, recommended first):** Fix `authichain-unified`'s build so the apex
  worker's existing proxy target serves Next.
  1. Vercel → `authichain-unified` → Settings → Build and Deployment.
  2. Turn **OFF** the **Build Command** and **Output Directory** overrides (inherit
     `vercel.json` like `qron-platform`).
  3. Redeploy latest `main`. Verify `authichain-unified.vercel.app/api/x402/health` → 200.
  4. `authichain.com` cuts over automatically (worker already proxies there).
  - Rollback: re-enable the overrides; it returns to the Vite build.

- **A2 (cleaner target, bigger):** Repoint `authichain.com` straight at `qron-platform`,
  bypassing the worker + `authichain-unified` entirely.
  1. Confirm in Cloudflare which route binds `authichain.com/*` (worker `authichain-com`).
  2. Remove/disable that worker route (or repoint its proxy to `qron-platform.vercel.app`).
  3. Ensure Cloudflare DNS for `authichain.com` resolves to Vercel (proxied CNAME), and
     the domain is verified/active on `qron-platform`.
  - Rollback: restore the worker route.

### Phase B — x402 go-live (on whichever project serves prod)
Vercel → project → Settings → Environment Variables (Production):
- `X402_PAY_TO = 0x5db511706FB6317cd23A7655F67450c5AC6e6AA2`
- `X402_FACILITATOR_URL =` Base facilitator. Public/testing: `https://x402.org/facilitator`.
  Mainnet production: Coinbase CDP-hosted facilitator (via `@coinbase/x402`, free CDP keys)
  — confirm current URL from x402.org docs before pasting.
- Redeploy. Verify `/api/x402/health` → `"ready": true`.

### Phase C — decommission duplication
1. Once `authichain.com` serves `qron-platform`, delete/retire the `authichain-unified`
   Vercel project (and `authichain-unified-v2` if also stale).
2. Audit the 41 Cloudflare workers against `docs/superpowers/plans/worker-status-*.md`;
   remove the redundant apex/proxy worker and any dead duplicates.
3. Make `qron-platform` the only project the GitHub repo auto-deploys (disconnect the
   repo from `authichain-unified` in Vercel Git settings).

---

## 4. Risks & guardrails
- **Brand routing**: the Next app already ships a middleware (33 kB) and `qron-platform`
  already serves strainchain.io/govchain.us/qron.space — verify each brand domain renders
  its correct brand after cutover before deleting the worker.
- **Crons**: 8 HTTP crons in `vercel.json` run on whichever project Vercel schedules them;
  after consolidation confirm they fire on `qron-platform` (check `scheduledJobRuns`).
- **Auth/cookies**: `/api/trpc` now served by `src/app/api/trpc/[trpc]/route.ts`
  (cookie-based `sdk.authenticateRequest`) — verify login flows on the live domain.
- Do each phase one domain at a time; keep the previous deploy as a rollback candidate.

---

## 5. Definition of done
- `authichain.com/api/x402/health` → 200 with `"ready": true`.
- All four brand domains render their correct brand from `qron-platform`.
- `authichain-unified` retired; repo auto-deploys exactly one Vercel project.
- The redundant apex/proxy worker removed; worker inventory doc updated.
