# Launch high-value backlog

**Audience:** coordinator / owner. Execute this list; do not re-audit the monorepo.  
**Audited:** 2026-09-19 from `main` @ `35322ea3` plus live curls and GitHub Actions API.  
**Constraint:** $0 until first revenue — no Workers Paid, no Cloudflare Containers spend, no paid SaaS. Do **not** invent `OPENCLAW_GATEWAY_URL`.  
**This PR (x402 docs):** public `GET /x402` HTML + catalog/backlog mark the rail **ready** (not `not_configured`). Prior PR: fail-closed schedules + claw↔AgentZ `mode` + ghost-traffic probes + `/api/funnel` aliases.

Secret **names** only. No values.

---

## Scores (0–5)

| #   | Surface                           |   Score | One-line                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (a) | First Stripe / DPP smoke purchase | **4.0** | `GET /api/checkout/dpp` **303** to `checkout.stripe.com` (live). Smoke buyer owner-attested. Gap: Dashboard must hit `/api/stripe/webhook` (legacy URL 404/410); `/api/funnel` was 404 (fixed in this PR, needs deploy).                                                                                           |
| (b) | B2B / email live-send reliability | **1.5** | Workflows **active**, `OWNER_LIVE_SEND` attested true, scripts fail-closed. **Guardrail API 404s** on apex; client defaults to `app.authichain.com`. Parallel: _Unblock B2B outreach + guardrail_.                                                                                                                 |
| (c) | AgentZ ↔ claw productionization   | **3.5** | Tunnel `/health` 200 sovereign; claw `agentz_api: configured`. Chat `run` now sends `?mode=` + JSON; FastAPI honors both. Architect / `*email*` stay dry-run unless explicit `live`. Access service token still owner. Do not invent `OPENCLAW_GATEWAY_URL`.                                                       |
| (d) | x402 agent payments               | **4.5** | **Ready (not `not_configured`).** Live `GET /api/x402/health` → 200 `ready` / `trustless`; payTo `0xaebf…e437`, Base 8453, Circle USDC, $0.05/call, PayAI reachable. `POST /api/x402` → 402 + EIP-712 extra. Public docs `https://authichain.com/x402`. Do not rebind secrets away from the owner-authorized treasury. // pragma: allowlist secret |
| (e) | app.* / brand surfaces            | **4.0** | Four apex + estate `/onboard`/`/generate` **200**. `app.authichain.com/dashboard` **200**. `app.authichain.com/` **302 → /dashboard** (#1068). Vertical `*chain-io` routes mostly commented.                                                                                                                       |
| (f) | Autonomous revenue loops          | **3.5** | Checkout + genesis + `/api/funnel` live. Schedule `DRY_RUN` fail-closed (orchestration + content-publish). Claw/AgentZ mode honored. `ghost-traffic` does real light probes. Funnel accepts `dpp_published` / `verification` / `retained` aliases. Next `/api/dpp/publish` + `/verify` still not on edge.          |

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
| Funnel mount + `isDppOffer` priceId | #1067. Live `POST /api/funnel` → 400 (mounted, not 404).                                                                                                                                                                                                                                                                          |
| Orchestration schedule fail-closed  | #1065 + this PR. Schedule sets `dry_run=true`; never `inputs.dry_run \|\| 'false'`.                                                                                                                                                                                                                                               |
| `app.authichain.com/` 302           | #1068. Edge-router + landing redirect `/` → `/dashboard`.                                                                                                                                                                                                                                                                         |
| x402 health mount                   | #1068. `GET /api/x402/health` on landing + edge. Bind workflow #1072/#1074 (payTo / tokenomics EOA + PayAI) — do not invent pay-to. See `docs/strategy/WEB3_IDENTITY.md`.                                                                                                                                                         |
| x402 live rail                      | Health **ready** / trustless; unpaid `POST /api/x402` **402**. PayTo + Circle USDC + PayAI already bound — **do not rebind**. Self-pay smokes succeeded (proof only).                                                                                                                                                             |
| x402 public docs                    | `GET https://authichain.com/x402` (and `/docs/x402`) → 200 HTML: price, payTo, health URL, unpaid 402 curls. No facilitator URL, no keys.                                                                                                                                                                                         |
| Claw ↔ AgentZ `mode` contract       | This PR. Query + JSON body; architect/cold-email fail-closed without `live`.                                                                                                                                                                                                                                                      |
| `content-publish` schedule dry-run  | This PR. Schedule no longer omit-`--dry-run` fail-open. Push-to-main still publishes validated bundles.                                                                                                                                                                                                                           |
| Ghost-traffic light probes          | This PR. Four estate apexes + `/api/x402/health` + `/api/funnel`. Exit non-zero on unexpected 5xx.                                                                                                                                                                                                                                |
| Funnel DPP stage aliases            | This PR. `/api/funnel` accepts `dpp_published` / `verification` / `retained` without breaking `attributed_visit`.                                                                                                                                                                                                                 |

---

## Parallel agents — do not duplicate

Live Cursor agents (2026-09-19) on the same repo:

| Agent                                    | Scope                                                          | Overlap in this audit                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enable Outbound AgentZ orchestration** | Unfreeze / harden `agentz-orchestration.yml`, claw→AgentZ exec | Schedule `DRY_RUN` + claw `mode` **this PR**. Remaining: Access service token (owner); `AGENTZ_WEBHOOK_SECRET` on edge; do not enable Containers. |
| **Unblock B2B outreach + guardrail**     | Live send reliability                                          | Guardrail mount + 5xx fallback shipped (#1069 / edge mount). Do not reopen here.                                                                  |
| **Launch revenue + product path fixes**  | x402 + `app.*` product                                         | x402 health + `app.*` 302 shipped (#1068). **x402 is ready** — do not rebind `X402_*`. Public docs `/x402`.                                       |

This PR only does: fail-closed schedules, claw↔AgentZ mode, ghost-traffic probes, funnel DPP aliases, docs.

---

## False positives

| Claim                                                                    | Reality                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| AgentZ `/health` body looks like the wrong worker                        | Intentional FastAPI (`agentz/api/main.py` L60–62). HEAD is 405 (GET-only).                                                     |
| `docs/ROUTING.md` / `ESTATE.md`: `app.authichain.com` 522                | Stale. `/dashboard` is 200; apex `/` is **302 → /dashboard**.                                                                  |
| `PUBLIC_LOOP_FREEZE.md` “Day 1 enable / stay frozen” tables              | Stale vs GitHub: `b2b-outreach`, `email-proposals`, `marketing-autonomous`, `agentz-orchestration`, `gov-mint` are **active**. |
| `docs/launch/LAUNCH_CHECKLIST.md` “ALL SYSTEMS ACTIVE”                   | Marketing checklist (SendGrid/Gmail, luxury mission). Not the live DPP loop.                                                   |
| `docs/superpowers/plans/2026-08-07-x402-agent-verification.md` “unbuilt” | Stale. Paywall + edge mount + facilitator bind are live; health is **ready**. Public surface is `/x402`.                       |
| `workers/dpp-fulfillment` is the access-grant path                       | Adjunct CRM/email only. Access = edge webhook → `fulfillDppPaidSession`.                                                       |
| `workers/stripe-webhook` is production DPP                               | Dead for DPP (QRON profile upsert). Canonical is edge `/api/stripe/webhook`.                                                   |
| Enabling `agentz-orchestration` runs the Python fleet                    | It runs TS scripts + webhook log only (`docs/CAPABILITIES.md`).                                                                |
| `ghost-traffic` green = funnel volume                                    | Light probes only (apex GET + two API mounts). Not organic browse volume.                                                      |
| Checkout HEAD 204 = broken                                               | Intentional. **GET** is 303.                                                                                                   |
| `claw` health `agentz_api: configured` = AgentZ reachable                | Env var present only; no live probe, no Access service-token headers in repo.                                                  |
| `OPENCLAW_GATEWAY_URL` missing is a code bug                             | Owner-set. Health correctly reports `not_set`. Do not invent a URL.                                                            |
| Dual `worker-app/` vs `services/worker-app/`                             | CI deploys `worker-app/` only. Hygiene, not a launch blocker.                                                                  |
| Vertical `*chain-io` workers without `[[routes]]`                        | Not customer-facing. CTAs use apex `/dapp`.                                                                                    |
| `authichain-telegram` still in deploy matrix                             | Archived product. CI noise only (`passport-demo` flake is the known red).                                                      |
| `isDppOffer` metadata-only on edge                                       | Primary CTA sets `metadata.offer` in `createDppCheckoutSession`. PriceId align is Payment Link defense (this PR).              |

---

## GitHub workflow state (2026-09-19 API)

| Workflow                                           | State                 | Note                                                                                                                             |
| -------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `b2b-outreach`                                     | **active**            | Live send if `OWNER_LIVE_SEND=true` **and** guardrail allows                                                                     |
| `email-proposals`                                  | **active**            | Dry-run default on dispatch; schedule follows owner var                                                                          |
| `agentz-orchestration`                             | **active**            | Schedule resolve-mode **dry-run** (fail-closed). #1070 job-env parse fix. Live qualify/HubSpot only on dispatch `dry_run=false`. |
| `gov-mint`                                         | **active**            | Dispatch default `dry_run=true`                                                                                                  |
| `gov-engine` / ingest / score / proposals / notify | **disabled_manually** | Leave until sibling order                                                                                                        |
| `content-publish`                                  | **disabled_manually** | Schedule now fail-closed dry-run (safe to re-enable). Push-to-main still live.                                                   |
| `marketing-autonomous`                             | **active**            | IndexNow + GSC only. Social posting retired to `content-publish`.                                                                |
| `genesis-cron`                                     | **active**            | Safe tick                                                                                                                        |
| `content-routine-pr`                               | (see GitHub)          | PR-only inbound                                                                                                                  |

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

### P0-1b. Edge webhook threw before fulfill — harden observability + replay (2026-09-20)

- **Problem:** Apex `handleStripeWebhook` called Drizzle `getDb()` (requires `DATABASE_URL`) for idempotency/audit _before_ `fulfillDppPaidSession`. `authichain-edge-router` hydrates Stripe + Supabase only — not `DATABASE_URL`. Paid `checkout.session.completed` then 400'd and never wrote `payment_succeeded` / `provisioned`. Live `stripe_events` stayed empty even for prior successes (edge wrote Drizzle `activity_log`, which also failed).
- **Not the cause (do not invent an `is_demo` skip fix):** `isDppOffer` matches live `smoke_check_1789786486` (`cs_live_a1y4Tu…`) — metadata has `offer` + `plan`. `$0` promo / `is_demo` / `smoke_*` visit id are not fulfill filters (`is_demo` only skips Resend email). Funnel only has `checkout_started` because fulfill never ran.
- **Follow-up (2026-09-20 Resend):** HTTP 200 + `payment_succeeded` landed; `provisioned` still missing. Guest `profiles` insert omitted `user_id` which was `NOT NULL` + FK to empty `auth.users`. Error swallowed as `no_identity`. See `20260920000002_profiles_guest_user_id_nullable.sql`.
- **7d shape:** ~41 `checkout_started` vs 1 `payment_succeeded` / 1 `provisioned`. Stripe 7d: 3 complete/paid sessions, all $0 smoke; 0 nonzero charges.
- **Contrast:** `dpp_smoke_1789591727` has `payment_succeeded` → `provisioned` → `merchant_activated` (Next handler, 2026-09-17, before apex was canonical).
- **Owner Dashboard (do not block on login):** `we_1UGTCS…` → Resend `checkout.session.completed` for `cs_live_a1y4Tu…`. Expect historical non-2xx; after deploy expect 2xx + funnel rows.
- **Fix (this PR):**
  1. Persist every verified delivery into `stripe_events` (event id, type, session id, HTTP outcome, error). Optional migration adds the extra columns; handler falls back to the live 3-col table. A row is **not** a fulfill lock.
  2. Fail-open Drizzle; fulfill every paid DPP `checkout.session.completed` / `async_payment_succeeded`, including $0 promo (`payment_succeeded` still writes before provision).
  3. Replay-safe: Drizzle `alreadyProcessed` still re-runs DPP fulfill (idempotent via session-id dedupe).

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

### P0-4. Fail-closed `agentz-orchestration` scheduled `DRY_RUN` — **shipped**

- **Shipped:** #1065 + this PR. Schedule always `dry_run=true`. `qualify-leads.ts` treats `DRY_RUN !== "false"` as dry. HubSpot sync job skipped when dry-run.
- **Test:** `agentz/tests/test_schedule_fail_closed.py`.

---

## P1

### P1-1. Claw → AgentZ `mode` query + Access token — **mode shipped; Access owner**

- **Shipped (this PR):** Claw appends `?mode=` + JSON body. FastAPI `resolve_execution_mode` honors query then body. Architect / `*email*` coerce to dry-run unless `live=true`.
- **Tests:** `agentz/tests/test_mode_contract.py`, `workers/authichain-openclaw/src/agentz-mode.test.ts`.
- **Still owner:** Cloudflare Access service token headers on claw if the tunnel policy requires them. Do not invent `OPENCLAW_GATEWAY_URL`. `AGENT_SECRET` default `"authichain-secret"` in `agentz/api/main.py` is still a foot-gun.

### P1-2. x402 on the edge — **ready (not `not_configured`)**

- **Shipped:** Landing + edge `GET /api/x402/health` / `GET /api/x402` (#1068). Bind #1072/#1074/#1076 (payTo / tokenomics EOA + PayAI + Base USDC). Live health: `ready`, `trustless`, $0.05, payTo `0xaebf…e437`. Unpaid POST → 402 + EIP-712 extra. Public docs `/x402`. Identity: `docs/strategy/WEB3_IDENTITY.md`.
- **Do not:** rebind payTo or facilitator; invent a new receiving address; dispatch another live settle unless verifying a deploy regression.
- **Remaining:** third-party discovery (this docs page) and first _external_ agent payment — not owner plumbing.

### P1-3. Port `POST /api/dpp/publish` + `/api/dpp/verify` to edge — **partial**

- **Shipped (this PR):** `POST /api/funnel` accepts `dpp_published` / `verification` / `retained` (and `attributed_visit`) aliases and maps them onto the funnel enum + `metadata.loop_stage`. Existing `visit_landing_page` + `dpp_loop:attributed_visit` path unchanged.
- **Gap remaining:** Next `src/app/api/dpp/publish` and `/api/dpp/verify` still insert/verify the `products` row. Those routes are **not** mounted on `worker-app`. Recording the stage via `/api/funnel` does **not** publish a DPP. Full state-machine smoke still needs the Next (or edge-wrapped) product write.

### P1-4. Owner: apply recent Supabase migrations

- **Problem:** `20260919000001` / `00002` add `api_usage` + `white_label_clients.provisioning_state` (comments cite live `42P01`). Apply status not verifiable from repo. `schema-drift.yml` fail-opens on bad `DATABASE_URL` unless `--strict`.
- **Evidence:** `supabase/migrations/20260919000001_add_api_usage_and_provisioning_state.sql`; `.github/workflows/schema-drift.yml` L84–91.
- **Why:** Attestation verify + vendor onboarding break without tables.
- **Effort:** S (`supabase db push` / MCP apply).
- **Risk:** High until applied; apply is owner-gated.
- **Owner:** Supabase project admin. Open PR #1048 is a migration-history reset — do not fight it.

### P1-5. `content-publish` fail-open latch — **shipped**

- **Shipped (this PR):** Schedule resolve-mode forces `dry_run=true` and passes `--dry-run`. Push-to-main still publishes validated bundles. Dispatch live only when `dry_run=false`.
- **Test:** `agentz/tests/test_schedule_fail_closed.py`.

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
| P2-3  | `app.authichain.com/` 404 — **shipped 302**                     | #1068; live GET `/` 302 → `/dashboard`           | S      | Done                                                                                   |
| P2-4  | Drop `authichain-telegram` + `passport-demo` from deploy matrix | `deploy-workers.yml`; steward skill flake        | S      | CI noise, not revenue                                                                  |
| P2-5  | `services/agentz/` vs root `agentz/` drift                      | Containers/API use root `agentz/`                | M      | Wrong-tree PRs never ship                                                              |
| P2-6  | Expand AgentZ container env beyond 3 secrets                    | `workers/authichain-agentz/src/env.ts`           | M–L    | Chat `run` / architect confirm fail preflight. **$0:** stay on tunnel, not Containers. |
| P2-7  | OpenClaw gateway reverse path                                   | `OPENCLAW_GATEWAY_URL` health-only; no fetch     | M      | Owner must supply real URL first                                                       |
| P2-8  | Sibling `gov-*` enable after mint proof                         | `docs/operations/base-chain-integration.md`      | Owner  | ingest → score → proposals → mint → notify → engine                                    |
| P2-9  | `ghost-traffic` real browse — **light probes shipped**          | This PR: 4 apex + x402/funnel; fail on 5xx       | S      | Still not organic browse volume. Full Playwright/BrowserBase stays later.              |
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

**x402 (already bound on landing — do not rebind the URL):**  
`X402_PAY_TO`, `X402_FACILITATOR_URL`, `X402_USDC_ASSET` on `authichain-com` and `authichain-edge-router`. Same names on sister apexes `qron-space`, `strainchain-io`, `govchain-us` so a third-party pay can settle. Names only.

**Do not set:** guessed `GOVCHAIN_NFT_CONTRACT` if `eth_getCode` is empty.

---

## Coordinator sequence (no re-audit)

1. **Owner (5 min):** Stripe Dashboard endpoint = `https://authichain.com/api/stripe/webhook`. Confirm last delivery 2xx. Bind missing edge secrets from the list above.
2. **Funnel is mounted.** Re-curl `POST /api/funnel` — expect 400 (bad body) or 201/500 JSON, never 404.
3. **B2B:** watch one scheduled/dispatch log with `OWNER_LIVE_SEND=true` (guardrail already mounted).
4. **AgentZ mode + fail-closed schedules shipped (this PR).** Owner: Access service token on claw if policy requires it; bind `AGENTZ_WEBHOOK_SECRET` on edge. Do not enable Containers spend.
5. **x402 is ready.** Public docs `/x402`. Do not rebind `X402_*`. First _external_ agent payment is discovery, not owner bind.
6. **Owner:** `supabase db push` for `20260919*` if not applied; optional sibling `gov-*` enable after mint proof.
7. **Leave off:** Workers Paid / Containers until a paid DPP or x402 settlement exists. `content-publish` schedule is now fail-closed (safe to re-enable).

### Live probes (copy-paste)

```bash
curl -sI https://authichain.com/api/checkout/dpp          # GET 303
curl -s -X POST https://authichain.com/api/stripe/webhook # 400 JSON
curl -s -X POST https://authichain.com/api/funnel -H 'content-type: application/json' -d '{}'  # 400 after deploy, not 404
curl -s https://agentz.authichain.com/health              # sovereign / Polygon
curl -s https://claw.authichain.com/health                # agentz_api configured; gateway not_set OK
curl -s https://authichain.com/api/x402/health            # 200 ready / trustless
curl -sI https://authichain.com/x402                      # 200 HTML docs
curl -sS -i -X POST https://authichain.com/api/x402 -H 'content-type: application/json' -d '{"sealId":"demo"}'  # 402
curl -sI https://app.authichain.com/                      # 302 → /dashboard
curl -sI -X POST https://authichain.com/api/guardrail/check  # mounted (not 404) after B2B agent
```
