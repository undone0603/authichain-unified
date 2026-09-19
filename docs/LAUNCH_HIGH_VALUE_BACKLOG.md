# Launch high-value backlog

**Audience:** coordinator / owner. Execute this list; do not re-audit the monorepo.  
**Audited:** 2026-09-19 from `main` @ `e4e32e75` plus live curls and GitHub Actions API.  
**Constraint:** $0 until first revenue — no Workers Paid, no Cloudflare Containers spend, no paid SaaS. Do **not** invent `OPENCLAW_GATEWAY_URL`.  
**This PR:** mounts `POST /api/funnel` on `authichain-edge-router` (DPP `attributed_visit` was 404) and aligns edge webhook DPP detection with `isDppOffer(..., priceId)`.

Secret **names** only. No values.

---

## Scores (0–5)

| #   | Surface                           |   Score | One-line                                                                                                                                                                                                                                                                  |
| --- | --------------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) | First Stripe / DPP smoke purchase | **4.0** | `GET /api/checkout/dpp` **303** to `checkout.stripe.com` (live). Smoke buyer owner-attested. Gap: Dashboard must hit `/api/stripe/webhook` (legacy URL 404/410); `/api/funnel` was 404 (fixed in this PR, needs deploy).                                                  |
| (b) | B2B / email live-send reliability | **1.5** | Workflows **active**, `OWNER_LIVE_SEND` attested true, scripts fail-closed. **Guardrail API 404s** on apex; client defaults to `app.authichain.com`. Parallel: _Unblock B2B outreach + guardrail_.                                                                        |
| (c) | AgentZ ↔ claw productionization   | **2.5** | Tunnel `/health` 200 (`{"status":"sovereign","network":"Polygon"}`); claw `/health` `agentz_api: configured`, `openclaw_gateway: not_set`. Chat `run` sends JSON `mode` that FastAPI ignores (query default `dry-run`). Parallel: _Enable Outbound AgentZ orchestration_. |
| (d) | x402 agent payments               | **1.0** | Library + Next `POST /api/v1/agent-verify` exist. Apex `/api/x402/health` and `/api/v1/agent-verify` **404**. Needs edge mount + `X402_PAY_TO` + `X402_FACILITATOR_URL`. Parallel: _Launch revenue + product path fixes_.                                                 |
| (e) | app.* / brand surfaces            | **3.5** | Four apex + estate `/onboard`/`/generate` **200**. `app.authichain.com/dashboard` **200** (docs still say 522). Apex `app.authichain.com/` is 404. Vertical `*chain-io` routes mostly commented. Parallel: same x402/app.* agent.                                         |
| (f) | Autonomous revenue loops          | **2.0** | Checkout + genesis cron live. Loop stage 1 was dropped (funnel 404). Stages `dpp_published` / `verification` / `retained` not on edge. `agentz-orchestration` **active** but scheduled `DRY_RUN` defaults **false**. `ghost-traffic` is a stub.                           |

---

## Already shipped (do not reopen)

| Item                                | Evidence                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named AgentZ tunnel                 | `GET https://agentz.authichain.com/health` → 200 `{"status":"sovereign","network":"Polygon"}`; `/docs` + `/openapi.json` are FastAPI. (#1061, #1062)                                                                                                                                                                              |
| claw `agentz_api` configured        | `GET https://claw.authichain.com/health` → `agentz_api: configured`. `AGENTZ_API_URL` secret-only (#1064). Do not put the URL back in `[vars]`.                                                                                                                                                                                   |
| OpenClaw reverse client             | #1060 merged (`agentz/integrations/openclaw.py`, claw `/notify`).                                                                                                                                                                                                                                                                 |
| $0 tunnel hosting                   | #1061/#1062. #1057 Containers code is in-repo — **do not enable Containers spend** until revenue.                                                                                                                                                                                                                                 |
| Genesis cron + `CRON_SECRET` parity | `.github/workflows/genesis-cron.yml`; `GET /api/automation/cron` → 401 JSON without bearer (correct).                                                                                                                                                                                                                             |
| First-dollar checkout               | `GET https://authichain.com/api/checkout/dpp` → **303** `checkout.stripe.com`. `/dpp` 200. Thanks/activate HTML on `authichain-com`.                                                                                                                                                                                              |
| Smoke buyer                         | Owner-attested (`PUBLIC_LOOP_FREEZE.md` item 3). Agent did not independently verify `provisionPurchase` row.                                                                                                                                                                                                                      |
| `OWNER_LIVE_SEND=true`              | Owner-attested. B2B YAML honors it (`.github/workflows/b2b-outreach.yml`).                                                                                                                                                                                                                                                        |
| Outbound dry-runs clean             | Owner-attested. Scripts skip Resend when dry-run (`scripts/b2b-cold-outreach.ts`).                                                                                                                                                                                                                                                |
| First Base gov-mint                 | Owner-attested. `gov-mint.yml` **active**, default `dry_run=true`. Sibling `gov-*` still **disabled_manually**.                                                                                                                                                                                                                   |
| UI light-enterprise + IndexNow      | #1053, #1056. Four apex 200.                                                                                                                                                                                                                                                                                                      |
| `/dapp` + `/dashboard`              | Both 200 on `authichain.com`. `app.authichain.com/dashboard` 200.                                                                                                                                                                                                                                                                 |
| Estate CTAs                         | `govchain.us/onboard` 200 (`x-served-by: govchain-us-proxy`); `qron.space/generate` 200 (`x-served-by: qron-space-proxy`); `strainchain.io/onboard` 200.                                                                                                                                                                          |
| Canonical Stripe webhook mount      | `POST https://authichain.com/api/stripe/webhook` → 400 JSON without `stripe-signature` (handler is live).                                                                                                                                                                                                                         |
| DPP exceptions + genesis auth       | Unauthenticated calls return 401 JSON, not cached HTML.                                                                                                                                                                                                                                                                           |
| Channel-partner shortlist           | `scripts/data/channel-partners-2026-09-19.json` + `--segment=partners` (dry-run default; not in `all`). Supabase leads seeded `source=channel_partner_web_scan_2026-09-19`. URL-only agencies (Canna Banana, HighMinded, Magic Plants) and DPP consultancies (GO TRACE, Provenant, DPP Agency) are research-only — not auto-send. |
| High-leverage Tier 1 five           | `scripts/data/high-leverage-2026-09-19.json` + `--segment=high_leverage` (dry-run only; not in `all`). Supabase source `high_leverage_scan_2026-09-19`: scott.krupa@ / mark.jameson@ fastsigns.com, info@stashstock.com, wendy.linscott@curaleaf.com, klong@c3industries.com. No invented emails.                                 |

---

## Parallel agents — do not duplicate

Live Cursor agents (2026-09-19) on the same repo:

| Agent                                    | Scope                                                          | Overlap in this audit                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enable Outbound AgentZ orchestration** | Unfreeze / harden `agentz-orchestration.yml`, claw→AgentZ exec | `DRY_RUN` inverted on schedule; claw JSON `mode` vs FastAPI query; Access service token; container secret surface; `AGENTZ_WEBHOOK_SECRET` on edge        |
| **Unblock B2B outreach + guardrail**     | Live send reliability                                          | `GUARDRAIL_API_URL` default `https://app.authichain.com`; `/api/guardrail/*` **not** on edge (apex 404); `INTERNAL_API_SECRET`; HubSpot env-name fallback |
| **Launch revenue + product path fixes**  | x402 + `app.*` product                                         | Mount `/api/v1/agent-verify` + `/api/x402/health`; `X402_*` secrets; `app.authichain.com/` 404; Payment Link / brand CTAs                                 |

This PR only does: funnel mount + webhook `isDppOffer` priceId + docs. Leave the three tracks above to those agents.

---

## False positives

| Claim                                                                    | Reality                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| AgentZ `/health` body looks like the wrong worker                        | Intentional FastAPI (`agentz/api/main.py` L60–62). HEAD is 405 (GET-only).                                                     |
| `docs/ROUTING.md` / `ESTATE.md`: `app.authichain.com` 522                | Stale. `/dashboard` is 200; apex `/` is 404.                                                                                   |
| `PUBLIC_LOOP_FREEZE.md` “Day 1 enable / stay frozen” tables              | Stale vs GitHub: `b2b-outreach`, `email-proposals`, `marketing-autonomous`, `agentz-orchestration`, `gov-mint` are **active**. |
| `docs/launch/LAUNCH_CHECKLIST.md` “ALL SYSTEMS ACTIVE”                   | Marketing checklist (SendGrid/Gmail, luxury mission). Not the live DPP loop.                                                   |
| `docs/superpowers/plans/2026-08-07-x402-agent-verification.md` “unbuilt” | Next paywall exists; **edge mount** is the gap.                                                                                |
| `workers/dpp-fulfillment` is the access-grant path                       | Adjunct CRM/email only. Access = edge webhook → `fulfillDppPaidSession`.                                                       |
| `workers/stripe-webhook` is production DPP                               | Dead for DPP (QRON profile upsert). Canonical is edge `/api/stripe/webhook`.                                                   |
| Enabling `agentz-orchestration` runs the Python fleet                    | It runs TS scripts + webhook log only (`docs/CAPABILITIES.md`).                                                                |
| `ghost-traffic` green = funnel volume                                    | Stub; logs four targets.                                                                                                       |
| Checkout HEAD 204 = broken                                               | Intentional. **GET** is 303.                                                                                                   |
| `claw` health `agentz_api: configured` = AgentZ reachable                | Env var present only; no live probe, no Access service-token headers in repo.                                                  |
| `OPENCLAW_GATEWAY_URL` missing is a code bug                             | Owner-set. Health correctly reports `not_set`. Do not invent a URL.                                                            |
| Dual `worker-app/` vs `services/worker-app/`                             | CI deploys `worker-app/` only. Hygiene, not a launch blocker.                                                                  |
| Vertical `*chain-io` workers without `[[routes]]`                        | Not customer-facing. CTAs use apex `/dapp`.                                                                                    |
| `authichain-telegram` still in deploy matrix                             | Archived product. CI noise only (`passport-demo` flake is the known red).                                                      |
| `isDppOffer` metadata-only on edge                                       | Primary CTA sets `metadata.offer` in `createDppCheckoutSession`. PriceId align is Payment Link defense (this PR).              |

---

## GitHub workflow state (2026-09-19 API)

| Workflow                                           | State                 | Note                                                                          |
| -------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `b2b-outreach`                                     | **active**            | Live send if `OWNER_LIVE_SEND=true` **and** guardrail allows                  |
| `email-proposals`                                  | **active**            | Dry-run default on dispatch; schedule follows owner var                       |
| `agentz-orchestration`                             | **active**            | Schedule sets `DRY_RUN: ${{ inputs.dry_run \|\| 'false' }}` → **live writes** |
| `gov-mint`                                         | **active**            | Dispatch default `dry_run=true`                                               |
| `gov-engine` / ingest / score / proposals / notify | **disabled_manually** | Leave until sibling order                                                     |
| `content-publish`                                  | **disabled_manually** | If re-enabled, schedule **fail-opens** to live social                         |
| `marketing-autonomous`                             | **active**            | IndexNow + GSC                                                                |
| `genesis-cron`                                     | **active**            | Safe tick                                                                     |
| `content-routine-pr`                               | (see GitHub)          | PR-only inbound                                                               |

---

## P0 — do next (ordered)

### P0-1. Confirm Stripe Dashboard → canonical webhook

- **Problem:** Ops docs (until this PR) told Stripe to POST `https://app.authichain.com/api/webhooks/stripe`. That path is retired (Next 410; apex 404). Paid sessions then never `fulfillDppPaidSession`.
- **Evidence:** `docs/operations/stripe-webhook-setup.md` (banner now corrected); `src/app/api/webhooks/stripe/route.ts` L51–64; live `POST /api/webhooks/stripe` → 404; live `POST /api/stripe/webhook` → 400 missing signature.
- **Why:** First real dollar without provision = angry buyer + no activate link.
- **Effort:** S (owner Dashboard click + signing-secret bind).
- **Risk:** High if still pointed at retired URL; change is reversible.
- **Owner / secrets:** Stripe Dashboard. Worker secrets on **`authichain-edge-router`**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and/or `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`, `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Done when:** Stripe event deliveries for a smoke/paid session are 2xx on `https://authichain.com/api/stripe/webhook`; a `funnel_events` row with `loop_stage=provisioned` exists.

### P0-2. Deploy this PR so `/api/funnel` is no longer 404

- **Problem:** `/dpp` JS POSTs `attributed_visit` to `/api/funnel`. Unregistered `/api/*` on the edge router falls through to ASSETS → **404**. Loop never starts; exception report looks empty at stage 1.
- **Evidence:** `workers/authichain-com/src/index.ts` L2922–2942; live `POST https://authichain.com/api/funnel` → 404 (pre-deploy); `worker-app/index.ts` ASSETS fallback ~L1366.
- **Why:** Autonomous loop metric and smoke “full chain” require an observable visit.
- **Effort:** S (this PR). Needs `deploy-cloudflare.yml` to publish `authichain-edge-router`.
- **Risk:** Low. Fail-closed if Supabase unset (500 JSON).
- **Owner / secrets:** Same Supabase pair on `authichain-edge-router`.
- **Overlap:** None (not x402, not guardrail, not AgentZ YAML).

### P0-3. Mount guardrail on edge + point B2B at apex _(parallel B2B agent)_

- **Problem:** `scripts/lib/guardrail-client.ts` defaults to `https://app.authichain.com`. `POST https://authichain.com/api/guardrail/check` → **404**. With `OWNER_LIVE_SEND=true`, scheduled B2B fail-closes or errors at the gate and looks “armed.”
- **Evidence:** `scripts/lib/guardrail-client.ts` L10–11, L36–37; `src/app/api/guardrail/check/route.ts` exists; **no** `/api/guardrail` in `worker-app/`. `b2b-outreach.yml` passes `INTERNAL_API_SECRET` but not `GUARDRAIL_API_URL`.
- **Why:** Live send reliability. Without this, outbound cannot safely spend Resend.
- **Effort:** S–M (Hono wrappers + `GUARDRAIL_API_URL: https://authichain.com` in B2B/email YAML).
- **Risk:** Medium (caps layer must fail closed).
- **Owner / secrets:** `INTERNAL_API_SECRET` on GitHub **and** `authichain-edge-router`.
- **Do not implement here** — assigned to B2B agent.

### P0-4. Fail-closed `agentz-orchestration` scheduled `DRY_RUN` _(parallel AgentZ agent)_

- **Problem:** Workflow is **active**. `DRY_RUN: ${{ inputs.dry_run || 'false' }}` → scheduled runs have no inputs → **live** qualify-leads / HubSpot sync. `qualify-leads.ts` treats only `DRY_RUN === "true"` as dry. `sync-mi-leads-hubspot.ts` ignores `DRY_RUN`.
- **Evidence:** `.github/workflows/agentz-orchestration.yml` L84, L110; `scripts/qualify-leads.ts` L10.
- **Why:** Reputation / CRM blast while freeze doc still says “stay frozen.”
- **Effort:** S (default schedule to `'true'`; honor `!== "false"` in both scripts).
- **Risk:** High if left; fix is low-blast.
- **Owner:** None beyond merge. Disable workflow immediately if the YAML fix slips.
- **Do not implement here** — assigned to Outbound AgentZ agent.

---

## P1

### P1-1. Claw → AgentZ `mode` query + Access token _(AgentZ agent)_

- **Problem:** Claw `POST` body `{ mode: "confirm" }`; FastAPI `api_run_workflow(..., mode: str = "dry-run")` is a **query** param. Chat `run <id>` stays dry-run. Claw fetch sends only `Authorization: Bearer` — no `CF-Access-Client-*`. Health does not probe AgentZ.
- **Evidence:** `workers/authichain-openclaw/src/index.ts` L81–90, L177–181; `agentz/api/main.py` L166–167.
- **Why:** Operators think chat confirmed workflows; fleet never acts. Access 302s look like “configured.”
- **Effort:** S (append `?mode=` + optional health probe). Access service token is **owner**.
- **Risk:** Medium. Do not invent `OPENCLAW_GATEWAY_URL`. Gateway is health-only today (no reverse post).
- **Secrets:** `AGENTZ_API_KEY`; owner Access service token on `authichain-openclaw` if policy requires it. `AGENT_SECRET` on AgentZ host (fail-closed; default `"authichain-secret"` in `agentz/api/main.py` L42 is a foot-gun).

### P1-2. x402 on the edge _(x402 / app._ agent)*

- **Problem:** No first-dollar agent payment on production apex.
- **Evidence:** Live `/api/x402/health` 404, `POST /api/v1/agent-verify` 404; implementations in `src/app/api/v1/agent-verify/route.ts`, `src/lib/x402.ts`.
- **Why:** Agentic economy revenue besides Stripe $299.
- **Effort:** M (Hono wrappers + secrets).
- **Risk:** Medium. Production refuses paid calls without facilitator (`src/app/api/v1/agent-verify/route.ts`).
- **Secrets:** `X402_PAY_TO`, `X402_FACILITATOR_URL` (plus optional `X402_NETWORK`, `X402_USDC_ASSET`, `X402_PRICE_USD`, `X402_DAILY_CAP_USD`) on `authichain-edge-router`.
- **MCP `verify_paid`:** stub (`server/mcp/index.ts`) — do not sell it as settlement.

### P1-3. Port `POST /api/dpp/publish` + `/api/dpp/verify` to edge

- **Problem:** Loop stages after activate cannot complete on apex. Smoke “full state machine” stalls.
- **Evidence:** Next routes exist; no `worker-app` mounts. Live unregistered `/api/*` → ASSETS.
- **Why:** Retention / exception report stays red after a real buyer.
- **Effort:** M.
- **Risk:** Low if wrappers call existing libs.
- **Overlap:** Adjacent to x402/app.* if they are already mounting leftover `/api/*`. Coordinate before a second mount PR.

### P1-4. Owner: apply recent Supabase migrations

- **Problem:** `20260919000001` / `00002` add `api_usage` + `white_label_clients.provisioning_state` (comments cite live `42P01`). Apply status not verifiable from repo. `schema-drift.yml` fail-opens on bad `DATABASE_URL` unless `--strict`.
- **Evidence:** `supabase/migrations/20260919000001_add_api_usage_and_provisioning_state.sql`; `.github/workflows/schema-drift.yml` L84–91.
- **Why:** Attestation verify + vendor onboarding break without tables.
- **Effort:** S (`supabase db push` / MCP apply).
- **Risk:** High until applied; apply is owner-gated.
- **Owner:** Supabase project admin. Open PR #1048 is a migration-history reset — do not fight it.

### P1-5. `content-publish` fail-open latch

- **Problem:** Currently disabled. If someone enables it, scheduled runs omit `inputs.dry_run` and the publish step only adds `--dry-run` when `inputs.dry_run == true` → **live social**.
- **Evidence:** `.github/workflows/content-publish.yml` L114–117.
- **Why:** Spend / reputation. Leave disabled until YAML defaults schedule to dry-run.
- **Effort:** S.
- **Risk:** High on enable; zero while disabled.

### P1-6. Bind `AGENTZ_WEBHOOK_SECRET` on edge + fix `push-secrets` worker name

- **Problem:** Orchestration POSTs `$APP_URL/api/agentz/webhook`. Handler 401s if Worker secret missing. `scripts/push-secrets-to-cloudflare.sh` still targets worker name `authichain-unified` (not `authichain-edge-router`) and omits `AGENTZ_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`.
- **Evidence:** `worker-app/index.ts` webhook handler; `scripts/push-secrets-to-cloudflare.sh` L24–26, L39–56; `deploy-cloudflare.yml` binds attestation keys only.
- **Why:** Green Actions jobs that always fail notify; fresh deploys 500 checkout.
- **Effort:** S.
- **Secrets (names):** add `AGENTZ_WEBHOOK_SECRET` to edge; rename core worker in the push script.

### P1-7. Docs: `ROUTING.md` `/api/*` split + freeze tables

- **Problem:** `docs/ROUTING.md` still says most `/api/*` → `authichain-api-gateway`. Production is `authichain-com` `APP_PREFIXES` → `APP_WORKER`. Freeze tables contradict GitHub.
- **Effort:** S (docs). This PR only banners the freeze file.

---

## P2

| ID    | Item                                                            | Evidence                                         | Effort | Why later                                                                              |
| ----- | --------------------------------------------------------------- | ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| P2-1  | `retained` never auto-written                                   | `src/lib/dpp-loop.ts` helpers + smoke test only  | M      | Success metric never green                                                             |
| P2-2  | Daily DPP exception cron is dispatch-only                       | `autonomous-business-cycle.yml` schedule retired | S      | Ops blind spot; `CRON_SECRET` already required                                         |
| P2-3  | `app.authichain.com/` 404                                       | Live HEAD 404; `/dashboard` 200                  | S      | Brand surface polish (x402/app.* agent)                                                |
| P2-4  | Drop `authichain-telegram` + `passport-demo` from deploy matrix | `deploy-workers.yml`; steward skill flake        | S      | CI noise, not revenue                                                                  |
| P2-5  | `services/agentz/` vs root `agentz/` drift                      | Containers/API use root `agentz/`                | M      | Wrong-tree PRs never ship                                                              |
| P2-6  | Expand AgentZ container env beyond 3 secrets                    | `workers/authichain-agentz/src/env.ts`           | M–L    | Chat `run` / architect confirm fail preflight. **$0:** stay on tunnel, not Containers. |
| P2-7  | OpenClaw gateway reverse path                                   | `OPENCLAW_GATEWAY_URL` health-only; no fetch     | M      | Owner must supply real URL first                                                       |
| P2-8  | Sibling `gov-*` enable after mint proof                         | `docs/operations/base-chain-integration.md`      | Owner  | ingest → score → proposals → mint → notify → engine                                    |
| P2-9  | `ghost-traffic` real browse                                     | Freeze doc stub                                  | M      | Not a small unblock; do not treat green as volume                                      |
| P2-10 | Pricing docstring vs `plans.ts`                                 | `shared/pricing.ts` vs `src/lib/plans.ts`        | S      | Legacy plan-detection only; `plans.ts` charges                                         |

---

## Secret-name checklist (owner, no values)

**Must be on `authichain-edge-router` for money:**  
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and/or `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`, `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (must match GitHub for genesis).

**Must be on `authichain-com` for protocol checkout:**  
`STRIPE_SECRET_KEY`, optional `STRIPE_PRICE_ID`.

**B2B live send:**  
`RESEND_API_KEY` or `RESEND_API_KEY2`, `INTERNAL_API_SECRET`, `GUARDRAIL_API_URL` (set to `https://authichain.com` — do not rely on default), optional `HUBSPOT_TOKEN` / `HUBSPOT_ACCESS_TOKEN`.

**claw / AgentZ:**  
`AGENTZ_API_URL` (secret-only), `AGENTZ_API_KEY`, `AGENT_SECRET`, optional owner `OPENCLAW_GATEWAY_URL` + `OPENCLAW_API_KEY`. Access service token names if policy requires (owner). Do not invent the gateway URL.

**x402 (when mounting):**  
`X402_PAY_TO`, `X402_FACILITATOR_URL`.

**Do not set:** guessed `GOVCHAIN_NFT_CONTRACT` if `eth_getCode` is empty.

---

## Coordinator sequence (no re-audit)

1. **Owner (5 min):** Stripe Dashboard endpoint = `https://authichain.com/api/stripe/webhook`. Confirm last delivery 2xx. Bind missing edge secrets from the list above.
2. **Merge + deploy this PR.** Re-curl `POST /api/funnel` — expect 400 (bad body) or 201/500 JSON, never 404.
3. **B2B agent:** mount `/api/guardrail/*`, set `GUARDRAIL_API_URL`, then watch one scheduled/dispatch log with `OWNER_LIVE_SEND=true`.
4. **AgentZ agent:** flip orchestration `DRY_RUN` fail-closed; claw `?mode=`; Access token; do not enable Containers spend.
5. _*x402 / app.* agent:_* edge-mount agent-verify + health; bind `X402_*`; fix `app.authichain.com/` 404.
6. **Owner:** `supabase db push` for `20260919*` if not applied; optional sibling `gov-*` enable after mint proof.
7. **Leave disabled:** `content-publish` until P1-5; Workers Paid / Containers until a paid DPP or x402 settlement exists.

### Live probes (copy-paste)

```bash
curl -sI https://authichain.com/api/checkout/dpp          # GET 303
curl -s -X POST https://authichain.com/api/stripe/webhook # 400 JSON
curl -s -X POST https://authichain.com/api/funnel -H 'content-type: application/json' -d '{}'  # 400 after deploy, not 404
curl -s https://agentz.authichain.com/health              # sovereign / Polygon
curl -s https://claw.authichain.com/health                # agentz_api configured; gateway not_set OK
curl -sI https://authichain.com/api/x402/health           # 404 until x402 agent
curl -sI -X POST https://authichain.com/api/guardrail/check  # 404 until B2B agent
```
