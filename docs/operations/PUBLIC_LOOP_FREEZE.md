# Public-loop freeze — updated 2026-09-19

Autonomous scale stays paused until a stranger can **pay (or smoke-pay) and activate** without a login code. Access is no longer the gate.

**Safe tick (does not thaw this freeze):** weekday `genesis-cron.yml` hits `GET /api/automation/cron` only. See `docs/operations/GENESIS_CRON.md`. Do not uncomment `worker-app/wrangler.toml` GROUP B crons or enable gov-mint / outreach from that path.

## Update - 2026-09-19 GovChain NFT deploy path (item 5)

Item 5 is **not met yet**. Public Base RPC (`https://mainnet.base.org`) still returns `eth_getCode = 0x` for the Polygon AuthiChainNFT `0x4da4D2675e52374639C9c954f4f653887A9972BE` on chain 8453. No other AuthiChainNFT address is documented on Base. Ops EOA `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d` remains funded (~0.002 ETH, nonce 0 as of 2026-09-19).

What changed: the signed-deploy path is now in-repo and Actions-ready (`.github/workflows/deploy-govchain-nft-base.yml`). After this lands on `main`, the **only remaining human step** for item 5 is a `workflow_dispatch` with `dry_run=false` (ops key + likely Alchemy already in repo secrets). Until that run prints an address with `getCode != 0x`:

- Do **not** set Actions secret `GOVCHAIN_NFT_CONTRACT` to a guessed address.
- Do **not** enable `gov-mint.yml` (id `304825951`).
- Do **not** dispatch mint with `dry_run=false`.

After a live deploy: set `GOVCHAIN_NFT_CONTRACT` to the new Base address, confirm getCode (Basescan + RPC), then enable `gov-mint.yml` and dispatch **`dry_run=true`** only. Sibling enable order (lowest blast first): gov-ingest `304824543` → gov-score `304825517` → gov-proposals `304825758` → gov-mint `304825951` → gov-notify `304826125` → gov-engine `261329391`. See `docs/operations/base-chain-integration.md`.

## Status - 2026-09-18 staged re-enable

Stage 1 and 2 workflows were re-enabled 2026-09-18 with owner approval. This overrides the Frozen list below for these nine only.

**Live (enabled):** verify-scheduled-jobs, verify-integrations, verify-outreach-secrets, schema-drift, seo-regression, guardrail-digest, reddit-monitor, pipeline-tick, social-credentials-check.

**Still frozen (no outbound until stage 1-2 runs are read and owner approves each):** b2b-outreach, email-proposals, content-publish, content-routine-pr, marketing-autonomous, gen-seo-pages, weekly-video, browser-vision-tasks, agentz-orchestration, automerge-dependabot, dependabot-auto-merge.

**Frozen until item 5 (still open — no Base bytecode as of 2026-09-19):** gov-engine, gov-ingest, gov-mint, gov-notify, gov-proposals, gov-score. Deploy workflow is ready; `GOVCHAIN_NFT_CONTRACT` still needs bytecode on 8453.

**Gate before any outbound:** read at least one post-enable run of each live workflow. Last known runs before the freeze: schema-drift (PR run 2026-09-15) and seo-regression (2026-09-14) had **failed** and must be understood first; the other live workflows last succeeded.

## Update - 2026-09-18 smoke test (item 3)

Owner-attested: the DPP smoke buyer (`visit_id=smoke_check_1789786486`, live Stripe checkout session) completed checkout and reached `/dpp/thanks` ("Payment received / DPP audit provisioned") with the `/dpp/activate` link. Workstream item 3 is treated as **met on owner attestation**. The agent confirmed the thanks page renders in production but did not independently verify the `provisionPurchase` webhook record or the activate step.

Next: re-enable frozen workflows in staged order, lowest blast radius first, with owner approval before any outbound (outreach/publish) workflow. Keep `gov-mint.yml` disabled until `GOVCHAIN_NFT_CONTRACT` has bytecode on 8453 (item 5). The owner click is now `deploy-govchain-nft-base.yml` (`dry_run=false` on `main`), not a local unsigned script.

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

`/onboard` **is implemented** (worker-app dynamic intake: GET form, POST 303 to `/onboard/received`). Live `GET https://authichain.com/onboard` returned 200 on 2026-09-19. Estate CTAs are `govchain.us/onboard`, `strainchain.io/onboard`, and `qron.space/generate` — those landing workers must proxy the path to `APP_ORIGIN=https://authichain.com`, not 404. The stale “no implementation” claim from PR #936 is superseded.

## Live workstream (only)

Issue #878 — traffic → checkout → provision → activate → retain.

Judge progress on:

1. ~~Unauthenticated `/verify` without Access~~ **done**
2. ~~`GET /api/checkout/dpp` is a **303 to Stripe** (or JSON error), never marketing HTML~~ **done (2026-09-19)**
3. One DPP-SMOKE-E2E (or paid) certificate: webhook `provisionPurchase` → thanks → activate
4. ~~`GET /api/cron/dpp-exceptions` returns JSON (`exceptions` / `funnel` / `demoVisits`), dispatched live~~ **done (2026-09-19) - returns 401 JSON when unauthenticated, not cached HTML**
5. One signed Base deploy from ops EOA — **still open**. No AuthiChainNFT bytecode on 8453 yet. Path: merge the deploy workflow, dispatch `deploy-govchain-nft-base.yml` with `dry_run=false`, set secret `GOVCHAIN_NFT_CONTRACT`, prove `getCode != 0x`, then enable `gov-mint.yml` (`304825951`) with dry-run default true. Do not dispatch `gov-mint.yml` live (`dry_run=false`) until that proof exists.

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
