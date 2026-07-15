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

Health: `pnpm check` 0 errors · `pnpm test` 503/503 · `pnpm build` green.

## 2. Next API routes (~60 groups under `src/app/api/`)

REST surface alongside tRPC. Notable live/critical ones:

- **Money in:** `/api/stripe/webhook` (signature-verified, provisions guests by email + welcome email), `/api/webhooks/stripe`, `/api/checkout`, `/api/subscribe`, `/api/trial`, `/api/upgrade`, `/api/upsell`, `/api/x402` (agent micropayments)
- **Admin ops:** `/api/admin/ops` (admin-gated, aggregates `scheduled_job_runs` → OpsDashboard) ← wired 2026-07-15
- **Autonomous cron endpoints** (CRON_SECRET-bearer gated, driven by GitHub Actions — see §5): `/api/cron/{pipeline,jobs,retention,dunning,govchain,competitive-monitor,nurture-replies}`, `/api/automation/cron`, `/api/trial-reminder`
- **Lead capture / outreach:** `/api/lead-capture`, `/api/leads`, `/api/crm`, `/api/agentz/webhook` (logs to Supabase + upserts leads — a heartbeat, NOT an agent executor), `/api/social-proof`, `/api/waitlist`, `/api/testimonials`
- **Product surface:** `/api/verify`, `/api/certificate`, `/api/seal`, `/api/generate` (QR art), `/api/provenance`, `/api/qron`, `/api/industrial`, `/api/governance`, `/api/strainchain`, `/api/govchain`
- **Integrations:** `/api/telegram`, `/api/gpt` (GPT plugin), `/api/mcp`, `/api/keys` (API key mgmt), `/api/usage`, `/api/team`, `/api/x402`

## 3. Cloudflare Workers — 42 live, 31 in repo (⚠ 11-worker drift)

Repo-managed (`workers/*`, deployed by `.github/workflows/deploy-cloudflare.yml` + `deploy-workers.yml`):

| Worker | Capability | Status |
|---|---|---|
| `authichain-com` | Apex marketing site + app-path proxy → app.authichain.com | LIVE (funnel fixed 2026-07-15) |
| `qron-space`, `govchain-us`, `strainchain-io` | Brand landing + SEO layer | LIVE |
| `authichain-api`, `authichain-api-gateway`, `authichain-gateway` | API edge routing | LIVE |
| `authichain-scan-validate`, `authichain-qron-provenance` | QR scan validation + provenance (D1 `authichain-provenance` = 5a6672a7…) | LIVE |
| `authichain-autopilot` | 6h cron automation | LIVE |
| `qron-automation` | uptime (30m) / SEO ping (6h) / digest (12h) | LIVE |
| `qron-outreach` | Cold-email sender (QRON 6/6 + DPP 4/4 queues **exhausted**) | GATED, queues empty |
| `qron-image-gen` | QR art generation | ON-DEMAND |
| `stripe-webhook`, `stripe-webhook-worker` | Stripe event handling | ON-DEMAND |
| `resend-relay` | Email relay (3000/day verified) | ON-DEMAND |
| `authichain-telegram`, `bitcoin-auth`, `blockchain`, `ai-classification`, `analytics`, `auth`, `authichain-chain-data`, `authichain-license-issuer`, `authichain-consensus-engine`, `authichain-infra`, `authichain-bridge`, `authichain-dashboard`, `watchchain-io` | Vertical/support services | ON-DEMAND |

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
- `autonomous-business-cycle.yml` — **14 daily jobs** hitting the CRON_SECRET-gated Vercel endpoints (pipeline 00:00, subscription-health 03:00, customer-health 05:00, automation 06:00, govchain 07:00, dunning 08:00, retention 09:00, trial-reminder 10:00, live-check 11:00, token-metrics 12:00, ecosystem-health 13:00; competitive-monitor Mondays; founder-payout 1st of month). **This is LIVE — the autonomous business cycle runs.**
- `outreach-trigger.yml` (every 4h) + `dpp-outreach-trigger.yml` (every 8h) → qron-outreach worker. **Both hit exhausted queues — no-ops burning minutes.**
- `b2b-outreach.yml` (Mondays 14:00) → `scripts/b2b-cold-outreach.ts` (Apollo-enriched)
- `gov-engine.yml` (6am) + gov-{ingest,score,mint,notify,proposals}.yml — gov procurement pipeline
- `ghost-traffic.yml` (9am ET) → agentz ghost_traffic_engine
- `marketing-autonomous.yml` (Mon/Wed/Fri — LinkedIn/Reddit/Twitter/SEO)
- `email-proposals.yml` (weekdays 15:00)
- `agentz-orchestration.yml` (8am) → POSTs `/api/agentz/webhook` (logging heartbeat only)

**Supabase pg_cron (6 jobs — shadow scheduler):** `agentZ-growth-engine` (30m), `agentZ-ph-tracker` (30m), `strainchain-mi-blast` (00:05), `strainchain-day25` (09:00), `automation-orchestrator` (14:00 — the daily drip sender), `stripe-sync-worker` (EVERY MINUTE).

**Vercel native cron (`vercel.json`):** only `/api/cron/nurture-replies`. Everything else is GitHub-driven.

## 6. AgentZ — 53 Python workflows (`agentz/workflows/registry.yaml`)

Autonomous business-operations agent. Capabilities span gov grant proposals, DocuSign blitzes, HubSpot drip repair, LinkedIn/Reddit outreach, Stripe link generation, pilot deployments (Detroit/Michigan), SEO, content multiplication, RFP capture, executive reporting, the reinvestment flywheel, and social launches.

**⚠ Safety-critical:** the CLI `run` command **defaults to `--mode auto`** (executes all side-effects without prompting). Only **1 of 53** workflows (`reinvestment_handler`) carries `confirm_before_run: true`. Global safety comes from: (a) credential preflight blocks live execution when secrets are missing, (b) the GitHub path (`agentz-orchestration.yml`) only POSTs a logging webhook and does NOT run the CLI, so the 53 workflows fire **only when run manually** (`python -m agentz.cli run <id> --mode dry-run`). **Anyone running the CLI without `--mode dry-run` fires live outbound.** Run env: `~/.agentz-venv`, node 22, Groq-only LLM.

## 7. Money surface

- **Stripe** acct `acct_1SXIyEGqTruSqV8T` ("Authichain+claude"): ~28 active payment links, 3 flagship subscription tiers (`src/app/pricing/page.tsx`, 5 buy-links live), 1 registered webhook path. **Zero successful charges ever** — every historical charge is a failed owner self-test. Constraint is traffic, not plumbing.
- **Revenue provisioning:** `checkout.session.completed` → find/create user by email → record revenue → welcome email. Verified working end-to-end.

## Cross-cutting risks (for a future ops pass)

1. **Worker drift** — 11 live CF workers have no repo source; `qron-daily-ops` carries dead-but-embedded secrets. Source them into `workers/` or document as deliberate.
2. **Shadow schedulers** — GitHub Actions + Supabase pg_cron + CF worker crons all fire independently; no single pane. The autonomous business cycle IS live daily.
3. **AgentZ default-auto** — CLI executes side-effects by default; only 1/53 workflows gated. Consider flipping the CLI default to `confirm`.
4. **Outreach** — 16% bounce rate, 0 replies ever, daily drip sends from `noreply@` with no reply-to (see `outreach-pipeline-audit` memory).
5. **Edge-function sprawl** — 80+ functions, most `verify_jwt:false`, undocumented; overlap with tRPC/workers unknown.
