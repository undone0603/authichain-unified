# AuthiChain Estate — Capability Catalog

_Compiled 2026-07-15 by walking every executable surface. Companion to `docs/NETWORK.md` (deploy map) and `docs/superpowers/specs/`. Status legend: **LIVE** = runs on a schedule or serves prod traffic · **ON-DEMAND** = deployed, fires only when called · **DORMANT** = deployed but nothing triggers it · **GATED** = requires a secret/flag/approval to do anything._

## 1. The app backend — 44 tRPC routers (`server/routers.ts`)

One Express app (`server/_core/app.ts`), deployed as the Vercel `qron-platform` project, serves all principal domains. tRPC surface, grouped by capability:

- **Auth & identity:** `auth`, `system`, `admin` (admin-gated), `reputation` (points/trust — tables live, populated on authentic scans)
- **Core product (authentication):** `products`, `authenticate`, `certificates`, `qrcode`, `supplyChain`, `provenance` via API
- **Web3:** `nft`, `blockchain`, `staking`, `character` (on-chain agent identities)
- **Revenue:** `subscription`, `payments`, `stripeConnect`, `sales`, `marketplace`, `bonuses`, `referral`, `affiliate`
- **Growth/marketing:** `marketing`, `emailCampaigns`, `emailDrafts`, `autopilot`, `abTesting`, `analytics`, `feedback`, `personalization`
- **Verticals:** `govchain` (gov procurement), `metrc` (cannabis compliance), `whiteLabel`
- **AI/media:** `ai`, `heygen` (video), `macrohard`, `qron` (QR art gen)
- **Ops/internal:** `notifications`, `dashboard`, `hubspot`, `missions`, `tasks`, `devTeam`, `scheduler`, `executive`

Health (verified 2026-08-07): `pnpm check` 0 errors · `pnpm test` 704/704 · `pnpm build` green.

> The previous figure here read "503/503" while the suite actually had 3 failures
> across 2 files, and "0 errors" while `pnpm check` reported 20. Both are true as
> of this edit. If you change this line, re-run both commands first — a health
> claim nobody re-checks is the same defect this repo spent a night removing from
> its marketing surfaces.

## 2. Next API routes (~60 groups under `src/app/api/`)

REST surface alongside tRPC. Notable live/critical ones:

- **Money in:** `/api/stripe/webhook` (canonical Stripe Dashboard URL; signature-verified, provisions guests by email + welcome email). Retired `/api/webhooks/stripe` is a 404 — do not register it in Dashboard. Also `/api/checkout`, `/api/subscribe`, `/api/trial`, `/api/upgrade`, `/api/upsell`, `/api/x402` (**LIVE** agent micropayments — see §7)
- **Admin ops:** `/api/admin/ops` (admin-gated, aggregates `scheduled_job_runs` → OpsDashboard) ← wired 2026-07-15
- **Autonomous cron endpoints** (CRON_SECRET-bearer gated): `/api/cron/{pipeline,jobs,retention,dunning,govchain,competitive-monitor,nurture-replies,dpp-exceptions}`, `/api/automation/cron`, `/api/trial-reminder`. GitHub `autonomous-business-cycle.yml` schedules are retired; DPP stalls also print from `scripts/revenue-cycle.ts --phase=report`.
- **Lead capture / outreach:** `/api/lead-capture`, `/api/leads`, `/api/crm`, `/api/agentz/webhook` (logs to Supabase + upserts leads — a heartbeat, NOT an agent executor), `/api/social-proof`, `/api/waitlist`, `/api/testimonials`
- **Product surface:** `/api/verify`, `/api/certificate`, `/api/seal`, `/api/generate` (QR art), `/api/provenance`, `/api/qron`, `/api/industrial`, `/api/governance`, `/api/strainchain`, `/api/govchain`
- **Integrations:** `/telegram` Mini App (Passport $49 Menu Button), `/api/telegram` (QRON Nightstamp webhook — do not reuse for StrainChain), `/api/gpt` (GPT plugin), `/api/mcp`, `/api/keys` (API key mgmt), `/api/usage`, `/api/team`, `/api/x402`

## 3. Cloudflare Workers — 42 live, 31 in repo (⚠ 11-worker drift)

Repo-managed (`workers/*`, deployed by `.github/workflows/deploy-cloudflare.yml` + `deploy-workers.yml`):

| Worker                                                                                                                                                                                                                                                               | Capability                                                               | Status                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| `authichain-com`                                                                                                                                                                                                                                                     | Apex marketing site + app-path proxy → app.authichain.com                | LIVE (funnel fixed 2026-07-15) |
| `qron-space`, `govchain-us`, `strainchain-io`                                                                                                                                                                                                                        | Brand landing + SEO layer                                                | LIVE                           |
| `authichain-api`, `authichain-api-gateway`, `authichain-gateway`                                                                                                                                                                                                     | API edge routing                                                         | LIVE                           |
| `authichain-scan-validate`, `authichain-qron-provenance`                                                                                                                                                                                                             | QR scan validation + provenance (D1 `authichain-provenance` = 5a6672a7…) | LIVE                           |
| `authichain-autopilot`                                                                                                                                                                                                                                               | 6h cron automation                                                       | LIVE                           |
| `qron-automation`                                                                                                                                                                                                                                                    | uptime (30m) / SEO ping (6h) / digest (12h)                              | LIVE                           |
| `qron-outreach`                                                                                                                                                                                                                                                      | Cold-email sender (QRON 6/6 + DPP 4/4 queues **exhausted**)              | GATED, queues empty            |
| `qron-image-gen`                                                                                                                                                                                                                                                     | QR art generation                                                        | ON-DEMAND                      |
| `stripe-webhook`, `stripe-webhook-worker`                                                                                                                                                                                                                            | Stripe event handling                                                    | ON-DEMAND                      |
| `resend-relay`                                                                                                                                                                                                                                                       | Email relay (3000/day verified)                                          | ON-DEMAND                      |
| `authichain-telegram`, `bitcoin-auth`, `blockchain`, `ai-classification`, `analytics`, `auth`, `authichain-chain-data`, `authichain-license-issuer`, `authichain-consensus-engine`, `authichain-infra`, `authichain-bridge`, `authichain-dashboard`, `watchchain-io` | Vertical/support services                                                | ON-DEMAND                      |

**Live-but-not-in-repo (drift — regrew 27→42 since June):** `authichain-revenue-worker` (new 07-07), `authichain-outreach-engine` (D1 cold-email, resurrected), `outreach-queue`, `qron-daily-ops` (6am health digest, has dead hardcoded keys), `qron-self-heal`, `qron-ai-api`, `qron-portfolio`, `gmail-relay-z`, `qron-edge`, `authichain-verify-worker`, `authichain-consensus-engine`, and others. **These deploy from nowhere in the repo — source lives only on Cloudflare.**

## 4. Supabase edge functions — 80+ (project `nhdnkzhtadfkkluiulhs`)

A large automation layer invisible to repo code search. Key clusters:

- **Product:** `qron-generate`, `authichain-{register,verify,scan,classify,products,nft-mint,batch-register}`, `qron-register`, `authichain-scout`
- **Revenue:** `stripe-webhook`, `stripe-worker`, `stripe-setup`, `qron-checkout`, `storefront-checkout`, `qron-revenue-reactor`, `authichain-{subscription,trial-convert,pricing-api}`
- **Outreach/growth (the real engine):** `automation-orchestrator`, `qron-drip-sequence` (23-prospect 7-step drip), `groq-personalize` (LLM copy), `nurture-engine`, `drip-fire`, `agentZ-{growth-engine,batch-outreach,ph-tracker,ph-post,approve}`, `z-mail`, `gmail-send`, `lead-capture-to-crm`
- **Ops:** `qron-daily-ops-v2`, `autonomous-ops`, `authichain-{watchdog,cron-master,ops-report,anomaly-engine,competitive-intel}`, `performance-cascade`, `multi-platform-coordinator`, `n8n-workflow-registry`
- **Verticals:** `strainchain-{pilot-handler,bulk-seed,pdf-labels}`, `authichain-dpp-generator`, `grant-tracker`, `compliance-proxy`

## 5. Schedulers — what actually fires, and when

**GitHub Actions (the real cron layer — ~15 scheduled workflows):**

- `autonomous-business-cycle.yml` — the former 14-job daily scheduler was **retired on 2026-09-08**. The file is manual `workflow_dispatch` only. It is not a live daily cycle.
- `outreach-trigger.yml` (every 4h) + `dpp-outreach-trigger.yml` (every 8h) → qron-outreach worker. **Both hit exhausted queues — no-ops burning minutes.**
- `b2b-outreach.yml` (Mondays 14:00) → `scripts/b2b-cold-outreach.ts` (Apollo-enriched)
- `gov-engine.yml` (6am) + gov-{ingest,score,mint,notify,proposals}.yml — gov procurement pipeline
- `ghost-traffic.yml` (9am ET) → agentz ghost_traffic_engine
- `marketing-autonomous.yml` (Mon/Wed/Fri — LinkedIn/Reddit/Twitter/SEO)
- `email-proposals.yml` (weekdays 15:00)
- `agentz-orchestration.yml` (8am) → Phase 0 pings `https://claw.authichain.com/health` + `https://agentz.authichain.com/health` (architect dry-run via claw if a bearer secret exists); then qualify/funnel; POSTs `/api/agentz/webhook` (logging). Schedule is dry-run. See `docs/operations/AGENTZ_ORCHESTRATION.md`.

**Supabase pg_cron on QRON-v2 (`nhdnkzhtadfkkluiulhs`), read 2026-10-06, eight active jobs:** `agentZ-growth-30min` (`*/30`, edge `agentZ-growth-engine`), `agentZ-ph-tracker-30min` (`*/30`), `ai-adapt-archive-pump` (`*/2`), `ai-adapt-archive-swh-refresh` (hourly at :07), `automation-orchestrator-daily` (14:00 UTC, edge `automation-orchestrator`), `strainchain-day25-upgrade` (09:00 UTC), `strainchain-mi-blast-daily` (00:05 UTC), `stripe-sync-worker` (every minute, edge `stripe-worker`). Each of those last runs succeeded the same day. The cron return text is `1 row` or `0 rows`, which is the SQL result count, not a mail receipt and not revenue.

**Vercel native cron (`vercel.json`):** only `/api/cron/nurture-replies`. Everything else is GitHub-driven.

## 6. AgentZ — 75 workflow ids (`agentz/workflows/registry.yaml`)

Autonomous business-operations agent. Capabilities span gov grant proposals, DocuSign blitzes, HubSpot drip repair, LinkedIn/Reddit outreach, Stripe link generation, pilot deployments (Detroit/Michigan), SEO, content multiplication, RFP capture, executive reporting, the reinvestment flywheel, and social launches.

**⚠ Safety-critical:** the CLI `run` command defaults to `--mode confirm` and dispatches through the registry runner (credential preflight treats placeholders as missing). `run --all --mode auto` is refused. The GitHub path (`agentz-orchestration.yml`) pings live claw/AgentZ and may POST claw `/architect/cycle` in **dry-run only**. It does **not** run the CLI registry (no `hot_lead_outreach_blitz` / AgentZ cold email). Prefer `--mode dry-run` until a dry-run orchestration log is green. Run env: `~/.agentz-venv`, node 22, Groq-only LLM.

## 7. Money surface

- **Stripe** acct `acct_1SXIyEGqTruSqV8T` ("Authichain+claude"), read 2026-10-06: five livemode charges, zero subscriptions, one automatic payout of $9.31. The only succeeded charge is $10 on a founder email. Four founder charges failed ($49, $49, $29, $29). `classifyRevenue` is `NO_QUALIFYING_REVENUE`. A founder charge is not a customer.
- **Revenue provisioning:** `checkout.session.completed` → find/create user by email → record revenue → welcome email. Verified working end-to-end.
- **x402 agent pay:** the live `authichain.com` health body on 2026-10-06 is `ready: true` with `paidVerify.status` `registry_not_bound`. `payTo` is the treasury ending `6e6AA2`. That response does not yet include `settlementStatus`, `settled`, or `canonicalTreasury`. The working tree adds those fields and keeps settlement not ready until registry binding. `ready` means the facilitator and payTo are configured. It is not a settlement. Live catalogs on `authichain.com` and `strainchain.io` still publish `farmUsd: 149` and a Farm payment link; that production copy is behind this tree. `$QRON` `0xAebf…E437` is not payTo. Base `8453`, Circle USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, **$0.05 / call**. // pragma: allowlist secret

## Cross-cutting risks (for a future ops pass)

1. **Worker drift** — 11 live CF workers have no repo source; `qron-daily-ops` carries dead-but-embedded secrets. Source them into `workers/` or document as deliberate.
2. **Shadow schedulers** — GitHub Actions and any Supabase `pg_cron` jobs still outside this repo are separate clocks. The 14-job business cycle was retired on 2026-09-08.
3. **AgentZ auto** — `run` defaults to `confirm`. `run --all --mode auto` is refused. A single `--mode auto` is refused by `agentzExecutionPolicy` before a handler loads. The registry has 75 ids.
4. **Outreach** — `automation-orchestrator-daily` is active and its 2026-10-06 14:00 UTC run succeeded with cron message `1 row`. That is not proof a message was delivered. Do not treat it as a send.
5. **Edge-function sprawl** — 80+ functions, most `verify_jwt:false`, undocumented; overlap with tRPC/workers unknown.
