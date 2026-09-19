# Public-loop freeze — updated 2026-09-17

Autonomous scale stays paused until a stranger can **pay (or smoke-pay) and activate** without a login code. Access is no longer the gate.

## Status - 2026-09-18 staged re-enable

Stage 1 and 2 workflows were re-enabled 2026-09-18 with owner approval. This overrides the Frozen list below for these nine only.

**Live (enabled):** verify-scheduled-jobs, verify-integrations, verify-outreach-secrets, schema-drift, seo-regression, guardrail-digest, reddit-monitor, pipeline-tick, social-credentials-check.

**Still frozen (no outbound until stage 1-2 runs are read and owner approves each):** b2b-outreach, email-proposals, content-publish, content-routine-pr, marketing-autonomous, gen-seo-pages, weekly-video, browser-vision-tasks, agentz-orchestration, automerge-dependabot, dependabot-auto-merge.

**Frozen until item 5:** gov-engine, gov-ingest, gov-mint, gov-notify, gov-proposals, gov-score (`GOVCHAIN_NFT_CONTRACT` needs bytecode on 8453).

**Gate before any outbound:** read at least one post-enable run of each live workflow. Last known runs before the freeze: schema-drift (PR run 2026-09-15) and seo-regression (2026-09-14) had **failed** and must be understood first; the other live workflows last succeeded.

## Update - 2026-09-18 smoke test (item 3)

Owner-attested: the DPP smoke buyer (`visit_id=smoke_check_1789786486`, live Stripe checkout session) completed checkout and reached `/dpp/thanks` ("Payment received / DPP audit provisioned") with the `/dpp/activate` link. Workstream item 3 is treated as **met on owner attestation**. The agent confirmed the thanks page renders in production but did not independently verify the `provisionPurchase` webhook record or the activate step.

Next: re-enable frozen workflows in staged order, lowest blast radius first, with owner approval before any outbound (outreach/publish) workflow. Keep `gov-mint.yml` disabled until `GOVCHAIN_NFT_CONTRACT` has bytecode on 8453 (item 5).

## Update - 2026-09-19 verification (checkout gate)

Live production checks plus GitHub Actions job/step logs for the `deploy-cloudflare.yml` run on `c1e256f2` show the checkout gate below is now **resolved**:

- Run #2311 (job `105813585880`): every step succeeded, including **Inspect build output** and **Publish application Worker + Assets**. `APP_WORKER`/`authichain-edge-router` was redeployed with the real Next.js app.
- `GET https://authichain.com/api/checkout/dpp` returns `303` to a live `checkout.stripe.com` URL. No cache headers, no homepage HTML.
- `GET https://authichain.com/api/cron/dpp-exceptions` returns `401 {"error":"Unauthorized"}` (JSON, `no-store`) - correct for an unauthenticated call, not cached HTML.
- The `find | head` SIGPIPE noted below did not reproduce locally and did not fire on this run - looks like a timing-dependent race, not a deterministic failure.

Workstream items 2 and 4 below are now met. Item 3 (one smoke-test buyer completing the full flow) is still open - that needs an actual purchase, which was not attempted here. **Do not re-enable frozen workflows until that smoke test completes.**

## What changed

- Unauthenticated `GET https://authichain.com/verify` is **not** a 302 to `cloudflareaccess.com` (reconfirmed 2026-09-17). Apex, `qron.space`, `govchain.us`, `strainchain.io` likewise return 200 with no Access login.
- GitHub `CLOUDFLARE_API_TOKEN` still **403s** Access org/apps (`unblock-public-access.yml` lists 0 apps). Do not treat a green Access workflow as proof of policy. Keep Access off public hosts in the dashboard; grant the token `Access: Apps` Read+Edit later so the workflow can enforce it.
- Resend ownership TXT for `authichain.com` is **live** in public DNS (`resend-domain-verification=5afa5cf8ec397b18c194291c5ca0d339`). The GitHub DNS-create job still 10000s (token lacks Zone.DNS Edit). Verify the domain in the Resend UI (`RESEND_API_KEY2` is the authichain.com account per `scripts/lib/resend-preflight.ts`). Do not re-dispatch `set-authichain-resend-txt.yml`.

## Current gate (not Access)

`authichain-com` is routed as `authichain.com/*`. Thanks/activate HTML from #1001 is live. Product paths must go to `APP_WORKER` (`authichain-edge-router`).

As of 2026-09-17 21:16 UTC, `GET /api/checkout/dpp` and `GET /api/cron/dpp-exceptions` return **cached homepage HTML** (`cf-cache-status: HIT`), not Stripe/JSON. The `dpp-exceptions` dispatch that printed `OK [200]` was that HTML, not the cron. **Purge `/api*`** (or everything on the zone) and get `deploy-cloudflare.yml` past the inspect step so `APP_WORKER` is the Next app, not a stale SPA index.

**Update 2026-09-19:** superseded - see the verification note near the top of this doc. Both endpoints now return correct dynamic responses (303/JSON), not cached homepage HTML.

`/onboard` has **no implementation** in this repo. That is a product decision, not an Access or 404-link fix (PR #936). Do not add a fake route to satisfy the old checklist.

## Live workstream (only)

Issue #878 — traffic → checkout → provision → activate → retain.

Judge progress on:

1. ~~Unauthenticated `/verify` without Access~~ **done**
2. ~~`GET /api/checkout/dpp` is a **303 to Stripe** (or JSON error), never marketing HTML~~ **done (2026-09-19)**
3. One DPP-SMOKE-E2E (or paid) certificate: webhook `provisionPurchase` → thanks → activate
4. ~~`GET /api/cron/dpp-exceptions` returns JSON (`exceptions` / `funnel` / `demoVisits`), dispatched live~~ **done (2026-09-19) - returns 401 JSON when unauthenticated, not cached HTML**
5. One signed Base deploy from ops EOA — still blocked until `GOVCHAIN_NFT_CONTRACT` has bytecode on 8453. Do not dispatch `gov-mint.yml`.

## Frozen (Actions disabled 2026-09-16)

AgentZ, automerge-dependabot, B2B outreach, browser-vision, content-publish, content-routine-pr, email-proposals, gen-seo-pages, ghost-traffic, gov-engine/ingest/mint/notify/proposals/score, guardrail-digest, marketing-autonomous, pipeline-tick, reddit-monitor, repo-maintenance, seo-regression, social-credentials-check, weekly-video, verify-scheduled-jobs, verify-integrations, verify-outreach-secrets, schema-drift.

Still on: CI, lint, main, CodeQL, security-scan, compliance-audit, deploy-cloudflare / deploy-workers / deploy-edge-worker, nightstamp-scan-gate, revenue-cycle, production-drizzle-audit, unblock-public-access, outreach/DPP **manual** triggers.

Re-enable a frozen workflow only after checkout 303s and one smoke buyer completes: `gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/<id>/enable`.

## Deploy notes

- `deploy-workers.yml` on the #1001 merge **did deploy `authichain-com`**. The workflow is red because `passport-demo` failed (standing flake — do not widen a DPP PR to fix it).
- `deploy-cloudflare.yml` failed at **Inspect build output** (`find | head` SIGPIPE under `pipefail`) before publishing `APP_WORKER`. That is what leaves `/api/*` on the wrong origin.
- **Update 2026-09-19:** run `35412089035` on `c1e256f2` (job `105813585880`) completed **Inspect build output** and **Publish application Worker + Assets** successfully - the SIGPIPE did not fire this time. Treat as an unfixed intermittent race, not a resolved bug: the line-86 `find` still doesn't prune `.git`/`node_modules` and isn't wrapped with `|| true`.
- Dispatch `deploy-workers.yml` with `worker=authichain-com` only when the landing worker changes. Do not redeploy the full matrix for a cache purge.

## Access (dashboard, if it wraps again)

Zero Trust team: **strainchainexecutiveteam**.

1. Access → Applications → **All Workers** (and any app on public brand hosts)
2. Delete or Bypass; keep Access on `dashboard.*`, `admin.*`, `/admin`, claw/openclaw
3. Confirm: `curl -sI https://authichain.com/verify` is not 302 to `cloudflareaccess.com`
