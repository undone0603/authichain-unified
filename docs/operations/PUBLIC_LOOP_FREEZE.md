# Outbound-spend freeze — revenue path is LIVE (2026-09-19)

> **Coordinator:** workflow enable-state and owner-attested progress in this file lag GitHub as of 2026-09-19 evening. Do not re-audit from the tables below. Execute from `docs/LAUNCH_HIGH_VALUE_BACKLOG.md`. In particular: `OWNER_LIVE_SEND` is owner-attested true; `b2b-outreach` / `email-proposals` / `agentz-orchestration` / `gov-mint` are **active** in GitHub; first Base gov-mint and AgentZ tunnel (`https://agentz.authichain.com/health`) are owner-attested live. Historical “Day 1 / stay frozen” rows are archive.

This freeze blocked **autonomous cold outbound** (Resend/social spam) and **gov-mint**. It did **not** freeze Stripe or DPP checkout.

**First-dollar path (LIVE):** traffic → onboard → `GET /api/checkout/dpp` (**303** to `checkout.stripe.com`) → provision → activate. Use the owner's existing assets here. Do not wait on outreach or AgentZ to take a payment.

**Still frozen (spend / mint):** live cold email from `email-proposals` / `b2b-outreach` unless `OWNER_LIVE_SEND=true` **and** dispatch unchecks `dry_run`, live social publish (`content-publish`), and all `gov-*` until `GOVCHAIN_NFT_CONTRACT` has bytecode on Base 8453.

**AgentZ orchestration (dry-run, 2026-09-19):** `agentz-orchestration.yml` may be enabled now that AgentZ is live at `https://agentz.authichain.com` (named Tunnel → uvicorn) and claw at `https://claw.authichain.com` reports `agentz_api: configured`. Schedule is dry-run only (claw/AgentZ health + architect `dry-run`; no AgentZ cold email). See `docs/operations/AGENTZ_ORCHESTRATION.md`. This is **not** a thaw of `content-publish` or genesis outbound.

**Safe tick (does not thaw cold send):** weekday `genesis-cron.yml` hits `GET /api/automation/cron` only. See `docs/operations/GENESIS_CRON.md`. Do not uncomment `worker-app/wrangler.toml` GROUP B crons.

## Owner directive — 2026-09-19 (first dollar, then staged outbound)

Checkout is live. Smoke buyer is owner-attested. Estate `/onboard` and `/generate` return 200. Frustration that "everything is frozen" is a docs problem: the revenue path was already on; only cold-send spend and gov-mint stayed off.

`gov-mint` / `gov-engine` stay frozen until bytecode on 8453. Enable `agentz-orchestration` in **dry-run** now (live AgentZ host is up). Do not enable `content-publish`.

**AgentZ hosting on the $0 path** is a free Cloudflare Tunnel to local uvicorn (`docs/integrations/openclaw-setup.md`, `scripts/agentz-tunnel/`). Orchestration dry-run is `docs/operations/AGENTZ_ORCHESTRATION.md`. That is not social publish. Do **not** enable Workers Paid or Containers until there is revenue.

### What to run now (traffic → checkout)

| Lane                        | Status                                                                                                     | Workflows                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Revenue (LIVE)**          | Do not disable                                                                                             | Stripe DPP checkout, `/onboard`, genesis cron, Stage 1–2 verifiers                            |
| **Traffic (enable if off)** | `gen-seo-pages` + `ghost-traffic` already **active**; enable `content-routine-pr` + `marketing-autonomous` | Inbound / PR-only. `ghost-traffic` is a stub (logs targets; no real browse volume)            |
| **Cold outbound (dry-run)** | Enable after this PR is on `main`                                                                          | `email-proposals`, `b2b-outreach` — `dry_run` default **true**, `OWNER_LIVE_SEND` unset/false |
| **AgentZ orchestration**    | Enable after this PR is on `main` (dry-run)                                                                | `agentz-orchestration` — schedule always dry-run; claw + AgentZ health; architect dry-run only |
| **Spend / mint (FROZEN)**   | Leave disabled                                                                                             | `content-publish`, `gov-mint`, other `gov-*`                                                  |

### Streamlined timeline

| Day       | What happens                                                                                         | What must not happen                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Day 0** | Revenue path stays live. Traffic workflows on. `marketing-autonomous` = IndexNow + GSC pings only.   | No live cold email. No social publish. No gov-mint.                               |
| **Day 1** | Enable `content-routine-pr`, then `email-proposals` + `b2b-outreach` (dry-run). Enable `agentz-orchestration` dry-run. Review one log each. | Do **not** uncheck AgentZ `dry_run` until that log is green. Do not enable `content-publish`. |
| **Day 3** | After dry-run review: **one-click live flip** below (email only).                                    | Still frozen: `content-publish`, all `gov-*` until item 5. AgentZ architect stays dry-run.    |

### Enable traffic + dry-run outbound (`gh` or Actions UI)

This cloud-agent token cannot `PUT .../enable` (Actions API 403). An owner token with `actions: write` runs:

```bash
# Traffic / inbound — re-run only if disabled
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/317153911/enable  # gen-seo-pages (already active)
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/276736651/enable  # ghost-traffic (already active)
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/332484969/enable  # content-routine-pr
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/300250832/enable  # marketing-autonomous (IndexNow/GSC)

# Dry-run cold outbound — AFTER this PR is on main (b2b dry_run default was false on old main)
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/302131163/enable  # email-proposals
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/305529641/enable  # b2b-outreach

# AgentZ orchestration (dry-run schedule; claw + AgentZ health). See AGENTZ_ORCHESTRATION.md
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/307144845/enable  # agentz-orchestration
```

**Do not enable** `261329391` (gov-engine), `304825951` (gov-mint), or `332964370` (content-publish).

### One-click live flip (`OWNER_LIVE_SEND`)

Unset or any value other than `true` means **no live send** (same as `OWNER_LIVE_SEND=false`). Scripts also fail closed: `DRY_RUN` unset ≠ live.

After reading a dry-run log that queued/logged and did not call Resend for a real recipient:

```bash
# Allow live cold send on the next b2b-outreach / email-proposals cron
gh variable set OWNER_LIVE_SEND --body true -R undone0603/authichain-unified

# Or: Settings → Secrets and variables → Actions → Variables → OWNER_LIVE_SEND = true
```

To slam it shut again: `gh variable set OWNER_LIVE_SEND --body false -R undone0603/authichain-unified`.

Manual dispatch still needs `dry_run` unchecked **and** `OWNER_LIVE_SEND=true`. One var flip is enough for scheduled runs. Do not set this until Day 3 review.

### One live B2B dispatch (after a clean dry-run)

`MAX_LIVE_SENDS` is hard-set to **2** in `b2b-outreach.yml`. QRON is the only segment with published addresses (`franchiseinfo@fastsigns.com`, `inquiries@moo.com`). Do not dispatch `segment=all` live.

```bash
# 1. Dry-run first — must exit 0 and log [DRY RUN] (no Resend)
gh workflow run b2b-outreach.yml -R undone0603/authichain-unified \
  -f segment=qron -f dry_run=true

# 2. Tiny live batch — requires vars.OWNER_LIVE_SEND=true
gh workflow run b2b-outreach.yml -R undone0603/authichain-unified \
  -f segment=qron -f dry_run=false
```

If the HTTP guardrail path returns 404 or any 5xx (including 503 `INTERNAL_API_SECRET not configured`), the script falls back to the Supabase store when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are present, so live send is not blocked by deploy/secret lag. `/api/health` 404 on those hosts is unrelated.

### Audit — 2026-09-19 (Actions API)

| Workflow                  | State                 | Last conclusion                                                                                                        | Notes                                                                                                                                                                           |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ghost-traffic`           | **active**            | success 2026-09-19 schedule ([35454152990](https://github.com/undone0603/authichain-unified/actions/runs/35454152990)) | Job ran (not skipped). Handler is still a **stub** — logs four targets, sends no browse traffic. Not a small in-repo unblock; do not treat a green check as real funnel volume. |
| `gen-seo-pages`           | **active**            | success 2026-09-18 dispatch; last schedule 2026-09-11                                                                  | Weekly Friday 09:00 UTC. Writes `content/seo/pages.json` only.                                                                                                                  |
| `seo-regression`          | **active**            | success 2026-09-19 after two earlier dispatch failures the same day                                                    | Brand homepages, sitemaps, robots all 200 as of this audit.                                                                                                                     |
| `reddit-monitor`          | **active**            | success 2026-09-19 schedule                                                                                            | Intelligence only; no posts.                                                                                                                                                    |
| `pipeline-tick`           | **active**            | last schedule success 2026-09-16; recent pushes skipped (no `[pipeline-proof]`)                                        | Outbound still fail-closed in `server/outreach/send-guard.ts`.                                                                                                                  |
| `content-routine-pr`      | **disabled_manually** | last success 2026-09-14 (push)                                                                                         | PR-only. Enable on Day 1.                                                                                                                                                       |
| `content-publish`         | **disabled_manually** | last success 2026-09-14                                                                                                | **Stay frozen** — live LinkedIn/Reddit/X.                                                                                                                                       |
| `marketing-autonomous`    | **disabled_manually** | last success 2026-09-14 schedule                                                                                       | Scheduled = IndexNow + GSC only. Enable as Day 0/1 inbound.                                                                                                                     |
| `b2b-outreach`            | **disabled_manually** | scheduled runs skipped (var gate); last real failure 2026-08-31                                                        | Enable on Day 1 **after** dry-run defaults land on main.                                                                                                                        |
| `email-proposals`         | **disabled_manually** | success 2026-09-15 schedule                                                                                            | Already defaulted dry-run on main. Enable on Day 1.                                                                                                                             |
| `agentz-orchestration`    | **enable (dry-run)**  | success 2026-09-16 schedule                                                                                            | Host blocker cleared (Tunnel + claw `agentz_api: configured`). Enable + dispatch `dry_run=true` `ping_agentz=true`.                                                             |
| `gov-engine` / `gov-mint` | **disabled_manually** | —                                                                                                                      | **Stay frozen** until `GOVCHAIN_NFT_CONTRACT` has bytecode on 8453.                                                                                                             |

### Live vs frozen after this pass

**Revenue LIVE (not part of this freeze):** `GET /api/checkout/dpp` → 303 Stripe, `/onboard`, estate CTAs, genesis cron.

**Inbound live:** `gen-seo-pages`, `ghost-traffic` (stub), `seo-regression`, `reddit-monitor`, `pipeline-tick`, Stage 1–2 verifiers (`verify-scheduled-jobs`, `verify-integrations`, `verify-outreach-secrets`, `schema-drift`, `guardrail-digest`, `social-credentials-check`).

**Day 1 enable (dry-run / PR-only):** `content-routine-pr`, `marketing-autonomous`, `email-proposals`, `b2b-outreach`, `agentz-orchestration`.

**Still frozen (spend / mint):** `content-publish`, `weekly-video`, `browser-vision-tasks`, `automerge-dependabot`, `dependabot-auto-merge`, all `gov-*`. `agentz-orchestration` is the dry-run enable in `docs/operations/AGENTZ_ORCHESTRATION.md`. **Live** cold email still waits for `OWNER_LIVE_SEND=true` **and** dispatch `dry_run=false` on `email-proposals` / `b2b-outreach`.

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

**Outbound-spend still off (see top of this doc):** content-publish, weekly-video, browser-vision-tasks, automerge-dependabot, dependabot-auto-merge. Dry-run enable list is `content-routine-pr`, `marketing-autonomous`, `email-proposals`, `b2b-outreach`, **`agentz-orchestration`** (claw/AgentZ health + architect dry-run; no AgentZ cold email). Revenue / checkout is **not** in this list. `gen-seo-pages` and `ghost-traffic` are already **active**.

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

Workstream items 2 and 4 below are now met. Item 3 is **met on owner attestation** (see the 2026-09-18 smoke-test note). The revenue path is live. Staged (dry-run) outbound may proceed; live cold send waits for `OWNER_LIVE_SEND=true` after dry-run review.

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
3. ~~One DPP-SMOKE-E2E (or paid) certificate: webhook `provisionPurchase` → thanks → activate~~ **met on owner attestation (2026-09-18)** — agent did not independently verify the webhook row or activate step
4. ~~`GET /api/cron/dpp-exceptions` returns JSON (`exceptions` / `funnel` / `demoVisits`), dispatched live~~ **done (2026-09-19) - returns 401 JSON when unauthenticated, not cached HTML**
5. One signed Base deploy from ops EOA — **still open**. No AuthiChainNFT bytecode on 8453 yet. Path: merge the deploy workflow, dispatch `deploy-govchain-nft-base.yml` with `dry_run=false`, set secret `GOVCHAIN_NFT_CONTRACT`, prove `getCode != 0x`, then enable `gov-mint.yml` (`304825951`) with dry-run default true. Do not dispatch `gov-mint.yml` live (`dry_run=false`) until that proof exists.

## Frozen (historical — 2026-09-16 disable)

The 2026-09-16 disable list is superseded by the 2026-09-18 Stage 1–2 re-enable and the 2026-09-19 streamlining at the top of this doc. Do not treat `gen-seo-pages`, `ghost-traffic`, or the Stage 1–2 verifiers as frozen.

**Remain disabled (spend / mint only):** automerge-dependabot, browser-vision, content-publish, weekly-video, all `gov-*`. AgentZ orchestration is the dry-run enable above. Checkout / Stripe / DPP are not in this list. Dry-run enables (`content-routine-pr`, `marketing-autonomous`, `email-proposals`, `b2b-outreach`, `agentz-orchestration`) use the commands at the top of this doc.

Still on: CI, lint, main, CodeQL, security-scan, compliance-audit, deploy-cloudflare / deploy-workers / deploy-edge-worker, nightstamp-scan-gate, revenue-cycle, production-drizzle-audit, unblock-public-access, outreach/DPP **manual** triggers, genesis-cron.

Re-enable only from the Day 0 / Day 1 lists above: `gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/<id>/enable`.

## Deploy notes

- `deploy-workers.yml` on the #1001 merge **did deploy `authichain-com`**. The workflow is red because `passport-demo` failed (standing flake — do not widen a DPP PR to fix it).
- `deploy-cloudflare.yml` failed at **Inspect build output** (`find | head` SIGPIPE under `pipefail`) before publishing `APP_WORKER`. That is what leaves `/api/*` on the wrong origin.
- **Update 2026-09-19:** run `35412089035` on `c1e256f2` (job `105813585880`) completed **Inspect build output** and **Publish application Worker + Assets** successfully - the SIGPIPE did not fire this time. Treat as an unfixed intermittent race, not a resolved bug: the line-86 `find` still doesn't prune `.git`/`node_modules` and isn't wrapped with `|| true`.
- Dispatch `deploy-workers.yml` with `worker=authichain-com` only when the landing worker changes. Do not redeploy the full matrix for a cache purge.

## Access (dashboard, if it wraps again)

Zero Trust team: **strainchainexecutiveteam**.

1. Access → Applications → **All Workers** (and any app on public brand hosts)
2. Delete or Bypass; keep Access on `dashboard.*`, `admin.*`, `/admin`, claw/openclaw, `agentz.*`
3. Confirm: `curl -sI https://authichain.com/verify` is not 302 to `cloudflareaccess.com`
