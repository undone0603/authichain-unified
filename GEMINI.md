# AgentZ: AuthiChain Autonomous Launch Conventions

This document defines the architectural and operational standards for the AgentZ autonomous trust infrastructure.

> **Read these first; they win on conflict.** This file is the AgentZ agent
> roster. It is not the operating authority. In order of precedence:
>
> 1. `docs/OPERATING_CHARTER.md`: what runs on its own and what waits for the owner.
> 2. `.github/autonomy.json`: the only switchboard for workflows and loops.
> 3. `.github/founder-business.json` and `docs/operations/FOUNDER_ONLY_BUSINESS.md`:
>    the business control plane (loops, founder-only gates, success metrics,
>    exception policy).
> 4. `CLAUDE.md` / `AGENTS.md`. The web app is **Next.js on Cloudflare**, not
>    a Vite SPA.
>
> For autonomy work, start from `docs/operations/autonomy-v7-gemini-spark-prompt.md`.

## Core Agents

- **Scout Agent** (`agentz/core/scout.py`): Uses `browser-use` for real-world business discovery.
- **Builder Agent** (`agentz/core/builder.py`): Manages identity registration and Branded Physical QR assets.
- **Media Agent** (`agentz/core/media.py`): Generates "StoryMode" narration and Queued HeyGen video avatars.
- **Trust Agent** (`agentz/core/trust.py`): Monitors scan patterns and manages Dynamic Identity Timelines.
- **Growth Agent** (`agentz/core/growth.py`): Coordinates QRON rewards and Community Verification nudges.
- **Blockchain Agent** (`agentz/core/blockchain.py`): Real-world Polygon anchoring via `web3.py`.
- **HubSpot Agent** (`agentz/core/hubspot.py`): Hot lead identification and contact resolution.
- **Microsite Agent** (`agentz/core/microsites.py`): Publishes personalized sales pages that the root Worker's microsite router serves at `<slug>.authichain.com`. #1466 moves this to a single Cloudflare KV write (`MICROSITES_KV`) and removes the old R2 and Vercel calls. Until #1466 merges, leave the Vercel path unused: anything touching Vercel waits for the owner under the charter.
- **Compliance Agent** (`agentz/core/compliance.py`): Monitors EU DPP regulatory mandates and flags ledger gaps.
- **Billing Agent** (`agentz/core/billing.py`): Manages Stripe Metered Billing for Headless Trust API usage.
- **Redemption Agent** (`agentz/core/redemption.py`): Handles QRON burning for merchant discounts (Layer 2 Siphon).
- **Analytics Agent** (`agentz/core/analytics.py`): Generates public-facing industry authenticity rankings.
- **Marketing Agent** (`agentz/core/marketing.py`): Viral trend detection and TikTok/X creative generation.
- **Pi Agent** (`agentz/core/pi.py`): Manages Pi Network Studio registration and Pi Browser auth.
- **Pages Agent** (`agentz/core/pages.py`): Manages "Living Product Page" metadata (Token-Gated Chapters).

## Limit-Proofing (Hardened Infrastructure)

- **Multi-Provider Failover**: `LimitProofLLM.providers` in `agentz/core/llm.py` is the source of truth for the waterfall. It runs local and free tiers first and paid APIs last. As of 2026-10-01 the order is Groq → LM Studio (plus an LM Studio fallback model when `LOCAL_MODEL_ID_FALLBACK` is set) → Ollama → Gemini 2.0 Flash → Cerebras → OpenRouter → DeepSeek → GPT-4o → Claude. Providers without credentials are skipped. Read the code rather than this line if they disagree.
- **Recursive Tool Binding**: Custom browser tools are autonomously reapplied to failover providers.
- **Retry Resilience**: Exponential backoff via `tenacity` on all 429 (Rate Limit) errors.

## Workflow Handlers

- `authichain_pilot_deploy`: Targeted single-business pilot.
- `authichain_expansion`: Autonomous multi-business scaling.
- `hot_lead_outreach_blitz`: Revenue Blitz (Hot Leads + Microsites + DM).
- `authichain_terminal_ops`: Finalizes the Kill-Chain (Closer + Burn + Index).
- `authichain_global_scale`: Scale-Up (FastAPI + Pi Network + Mobile).
- `authichain_compliance_audit`: Regulatory audit for EU DPP alignment.
- `authichain_daily_video_factory`: Autonomous viral content generation.

## Supabase Schema (Active)

- `products`: `id` (UUID), `name`, `brand`, `qron_id` (Integer), `industry_id`, `metadata` (JSONB).
- `scan_events`: `id` (Serial), `qron_id` (Integer), `scanned_at`, `city`, `country`.
- `redemptions`: `id` (UUID), `wallet`, `business_id`, `qron_amount`, `siphon_fee`.
- `public_reports`: `id` (Text), `data` (JSONB), `updated_at`.

## Deploy Target (Critical)

- **Cloudflare is the only deploy target.** Vercel is retired, and `.github/workflows/vercel-deploy-guard.yml` fails any workflow that reintroduces a Vercel deploy step. Do not configure or deploy a Vercel project.
- **Web app**: Next.js, built for Workers with OpenNext (`@opennextjs/cloudflare`). The Worker is `authichain-app`, configured in `wrangler.app.jsonc` and built by Cloudflare Workers Builds.
- **Edge workers**: the root `worker/` and the standalone `workers/*` deploy through the GitHub Actions deploy workflows (`deploy-cloudflare.yml`, `deploy-workers.yml` and related). Worker ownership is recorded in `config/cloudflare-estate.json`.
- **Runbook**: `docs/DEPLOY-RUNBOOK.md`. Agents never deploy directly. DNS, Cloudflare Access and secrets are founder-gated.

## Deliverable: Living Product Pages

Every scan MUST resolve to a configuration that includes:

1. Authenticity Score & Dynamic Timeline.
2. StoryMode AI Narration/Video (Queued).
3. AI Concierge Personification (Voice of Product).
4. Token-Gated Chapters (Hidden Content).
5. QRON Reward & Burn Utility (Merchant Discounts).

## Infrastructure & Revenue Setup (Required)

All deployments MUST be configured according to the master operational setup to ensure proper revenue routing and secure control plane access:

> Setting or rotating any secret below is founder-gated (charter, and
> `secrets_rotation` in `.github/founder-business.json`). An agent may list
> what is missing but never sets the values. Which wallet plays which role is
> defined in `docs/strategy/WEB3_IDENTITY.md`. Prices come only from
> `src/lib/plans.ts`.

### 1. Blockchain Treasury

- **Config**: Set `PRIVATE_KEY_ISSUER` (Treasury Wallet PK) and `TREASURY_ADDRESS` in environment secrets.
- **Goal**: NFT/Minting fees must route to the Founder's Polygon EVM wallet.

### 2. Agent API Billing

- **Config**: Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Cloudflare Worker bindings.
- **Goal**: Capture revenue from pay-per-call API keys via Stripe.

### 3. Control Plane Security (Supabase RLS)

- **Config**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is stored securely; assign Super-Admin role to Founder's UUID.
- **Goal**: Full visibility into tenant logs, registered products, and system-wide analytics, bypassing standard RLS.

### 4. Vision Engine & Infrastructure Accounts

- **Config**: Set `OPENAI_API_KEY` to the dedicated developer account with spend caps.
- **Goal**: Limit operating costs; all infrastructure must be deployed under the primary control plane account (API token/Cloudflare account).
