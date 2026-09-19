# Public-loop freeze — updated 2026-09-19 (outbound streamlining)

Autonomous scale stays paused until a stranger can **pay (or smoke-pay) and activate** without a login code. Access is no longer the gate.

**Safe tick (does not thaw this freeze):** weekday `genesis-cron.yml` hits `GET /api/automation/cron` only. See `docs/operations/GENESIS_CRON.md`. Do not uncomment `worker-app/wrangler.toml` GROUP B crons or enable gov-mint / AgentZ / live cold send from that path.

## Owner directive — 2026-09-19 (staged outbound approved)

Owner approval for **staged** outbound is granted. Keep `gov-mint` / `gov-engine` frozen until `GOVCHAIN_NFT_CONTRACT` has bytecode on Base 8453. Do not enable `agentz-orchestration` or `content-publish` in this pass.

Checkout gate is met (`GET /api/checkout/dpp` → **303** to `checkout.stripe.com`). Genesis cron is live. Smoke buyer is **owner-attested**. Estate `/onboard` and `/generate` return 200 and proxy the worker-app intake.

### Streamlined outbound timeline

| Day | Window | What happens | What must not happen |
| --- | --- | --- | --- |
| **Day 0** | Immediate | **Inbound traffic funnel live.** `gen-seo-pages` + `ghost-traffic` schedules stay enabled. Stage 1–2 health jobs stay on. `marketing-autonomous` may be enabled: scheduled jobs are IndexNow + GSC sitemap pings only (no social posts). | No live cold email. No social publish. No gov-mint. |
| **Day 1** | After this doc lands | **Dry-run outbound.** Enable `content-routine-pr` (PR-only content staging), then `email-proposals` + `b2b-outreach`. Defaults and resolve-mode force `DRY_RUN=true` until a repo var is flipped. Review at least one dry-run log per workflow. | Do not set `B2B_OUTREACH_ENABLED` or `EMAIL_PROPOSALS_ENABLED`. Do not uncheck `dry_run` on dispatch. Do not enable `content-publish` or `agentz-orchestration`. |
| **Day 3** | After dry-run review | **Live cold send, one channel at a time.** Set the matching repo var (`B2B_OUTREACH_ENABLED=true` and/or `EMAIL_PROPOSALS_ENABLED=true`), then either wait for the next cron or dispatch with `dry_run` unchecked. | Still frozen: `agentz-orchestration`, `content-publish` (live LinkedIn/Reddit/X), all `gov-*` until item 5, `weekly-video`, `browser-vision-tasks`. |

### How to enable Day 1 workflows (Actions UI or `gh`)

This cloud-agent token cannot `PUT .../enable` (no admin/maintain on the Actions API). An owner or a token with `actions: write` runs:

```bash
# Day 0 inbound — already active as of 2026-09-19; re-run only if disabled
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/317153911/enable  # gen-seo-pages
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/276736651/enable  # ghost-traffic
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/300250832/enable  # marketing-autonomous (inbound pings)

# Day 1 dry-run outbound — enable AFTER the dry-run default PR is on main
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/332484969/enable  # content-routine-pr
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/302131163/enable  # email-proposals (dry-run)
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/305529641/enable  # b2b-outreach (dry-run; wait for main)
```

**Do not enable** `261329391` (gov-engine), `304825951` (gov-mint), `307144845` (agentz-orchestration), or `332964370` (content-publish).

`b2b-outreach` on current `main` still defaulted `dry_run` to **false**. Enable it only after the dry-run-default commit is merged; until then a manual dispatch would be live-shaped (still blocked unless `B2B_OUTREACH_ENABLED=true`, but do not rely on that skip).

### How to flip Day 3 live (after dry-run review)

Repo → Settings → Secrets and variables → Actions → Variables:

1. Read one successful **dry-run** log for the channel. Confirm it queued/logged and did not call Resend for a real recipient.
2. Set `B2B_OUTREACH_ENABLED=true` to allow live B2B (Monday 14:00 UTC cron, or dispatch with `dry_run` unchecked).
3. Set `EMAIL_PROPOSALS_ENABLED=true` to allow live government proposals (weekday 15:00 UTC cron, or dispatch with `dry_run` unchecked).
4. Leave both unset (or `false`) to keep every scheduled and default-manual run in dry-run.
5. Scripts fail closed: `DRY_RUN` unset or any value other than `false` is dry-run (`scripts/b2b-cold-outreach.ts`, `scripts/email-proposals.ts`).

### Audit — 2026-09-19 (Actions API)

| Workflow | State | Last conclusion | Notes |
| --- | --- | --- | --- |
| `ghost-traffic` | **active** | success 2026-09-19 schedule ([35454152990](https://github.com/undone0603/authichain-unified/actions/runs/35454152990)) | Job ran (not skipped). Handler is still a **stub** — logs four targets, sends no browse traffic. Not a small in-repo unblock; do not treat a green check as real funnel volume. |
| `gen-seo-pages` | **active** | success 2026-09-18 dispatch; last schedule 2026-09-11 | Weekly Friday 09:00 UTC. Writes `content/seo/pages.json` only. |
| `seo-regression` | **active** | success 2026-09-19 after two earlier dispatch failures the same day | Brand homepages, sitemaps, robots all 200 as of this audit. |
| `reddit-monitor` | **active** | success 2026-09-19 schedule | Intelligence only; no posts. |
| `pipeline-tick` | **active** | last schedule success 2026-09-16; recent pushes skipped (no `[pipeline-proof]`) | Outbound still fail-closed in `server/outreach/send-guard.ts`. |
| `content-routine-pr` | **disabled_manually** | last success 2026-09-14 (push) | PR-only. Enable on Day 1. |
| `content-publish` | **disabled_manually** | last success 2026-09-14 | **Stay frozen** — live LinkedIn/Reddit/X. |
| `marketing-autonomous` | **disabled_manually** | last success 2026-09-14 schedule | Scheduled = IndexNow + GSC only. Enable as Day 0/1 inbound. |
| `b2b-outreach` | **disabled_manually** | scheduled runs skipped (var gate); last real failure 2026-08-31 | Enable on Day 1 **after** dry-run defaults land on main. |
| `email-proposals` | **disabled_manually** | success 2026-09-15 schedule | Already defaulted dry-run on main. Enable on Day 1. |
| `agentz-orchestration` | **disabled_manually** | success 2026-09-16 schedule | **Stay frozen.** |
| `gov-engine` / `gov-mint` | **disabled_manually** | — | **Stay frozen** until `GOVCHAIN_NFT_CONTRACT` has bytecode on 8453. |

### Live vs frozen after this pass

**Inbound live:** `gen-seo-pages`, `ghost-traffic` (stub), `seo-regression`, `reddit-monitor`, `pipeline-tick`, Stage 1–2 verifiers (`verify-scheduled-jobs`, `verify-integrations`, `verify-outreach-secrets`, `schema-drift`, `guardrail-digest`, `social-credentials-check`), `genesis-cron`.

**Day 1 enable (dry-run / PR-only):** `content-routine-pr`, `marketing-autonomous`, `email-proposals`, `b2b-outreach`.

**Still frozen:** `agentz-orchestration`, `content-publish`, `weekly-video`, `browser-vision-tasks`, `automerge-dependabot`, `dependabot-auto-merge`, all `gov-*`, and **live** cold send until Day 3 vars are set.

## Status - 2026-09-18 staged re-enable

Stage 1 and 2 workflows were re-enabled 2026-09-18 with owner approval. This overrides the Frozen list below for these nine only.

**Live (enabled):** verify-scheduled-jobs, verify-integrations, verify-outreach-secrets, schema-drift, seo-regression, guardrail-digest, reddit-monitor, pipeline-tick, social-credentials-check.

**Still frozen after the 2026-09-19 streamlining (see timeline above):** content-publish, weekly-video, browser-vision-tasks, agentz-orchestration, automerge-dependabot, dependabot-auto-merge. Day 1 dry-run enable list is `content-routine-pr`, `marketing-autonomous`, `email-proposals`, `b2b-outreach` — not live send. `gen-seo-pages` and `ghost-traffic` are already **active**.

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

Workstream items 2 and 4 below are now met. Item 3 is **met on owner attestation** (see the 2026-09-18 smoke-test note). Staged (dry-run) outbound may proceed per the Day 0 / Day 1 / Day 3 timeline at the top of this doc. Live cold send still waits for Day 3 var flips after dry-run review.

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
5. One signed Base deploy from ops EOA — still blocked until `GOVCHAIN_NFT_CONTRACT` has bytecode on 8453. Do not dispatch `gov-mint.yml`.

## Frozen (historical — 2026-09-16 disable)

The 2026-09-16 disable list is superseded by the 2026-09-18 Stage 1–2 re-enable and the 2026-09-19 streamlining at the top of this doc. Do not treat `gen-seo-pages`, `ghost-traffic`, or the Stage 1–2 verifiers as frozen.

**Remain disabled:** AgentZ, automerge-dependabot, browser-vision, content-publish, weekly-video, all `gov-*`. Day 1 dry-run enables (`content-routine-pr`, `marketing-autonomous`, `email-proposals`, `b2b-outreach`) use the commands in the owner-directive section.

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
2. Delete or Bypass; keep Access on `dashboard.*`, `admin.*`, `/admin`, claw/openclaw
3. Confirm: `curl -sI https://authichain.com/verify` is not 302 to `cloudflareaccess.com`
