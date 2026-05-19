# AgentZ: AuthiChain Autonomous Launch Conventions

This document defines the architectural and operational standards for the AgentZ autonomous trust infrastructure.

## Core Agents
- **Scout Agent** (`agentz/core/scout.py`): Uses `browser-use` for real-world business discovery.
- **Builder Agent** (`agentz/core/builder.py`): Manages identity registration and Branded Physical QR assets.
- **Media Agent** (`agentz/core/media.py`): Generates "StoryMode" narration and Queued HeyGen video avatars.
- **Trust Agent** (`agentz/core/trust.py`): Monitors scan patterns and manages Dynamic Identity Timelines.
- **Growth Agent** (`agentz/core/growth.py`): Coordinates QRON rewards and Community Verification nudges.
- **Blockchain Agent** (`agentz/core/blockchain.py`): Real-world Polygon anchoring via `web3.py`.
- **HubSpot Agent** (`agentz/core/hubspot.py`): Hot lead identification and contact resolution.
- **Microsite Agent** (`agentz/core/microsites.py`): Autonomous Vercel deployments and R2 asset management.
- **Compliance Agent** (`agentz/core/compliance.py`): Monitors EU DPP regulatory mandates and flags ledger gaps.
- **Billing Agent** (`agentz/core/billing.py`): Manages Stripe Metered Billing for Headless Trust API usage.
- **Redemption Agent** (`agentz/core/redemption.py`): Handles QRON burning for merchant discounts (Layer 2 Siphon).
- **Analytics Agent** (`agentz/core/analytics.py`): Generates public-facing industry authenticity rankings.
- **Marketing Agent** (`agentz/core/marketing.py`): Viral trend detection and TikTok/X creative generation.
- **Pi Agent** (`agentz/core/pi.py`): Manages Pi Network Studio registration and Pi Browser auth.
- **Pages Agent** (`agentz/core/pages.py`): Manages "Living Product Page" metadata (Token-Gated Chapters).

## Limit-Proofing (Hardened Infrastructure)
- **Multi-Provider Failover**: `agentz/core/llm.py` implements a waterfall strategy: Cerebras → DeepSeek → LM Studio → Ollama. (GPT-4o and Gemini are commented out until OpenAI billing is restored and a valid `GEMINI_API_KEY` is set.)
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

## Vercel Project Configuration (Critical)
- **Project**: `authichain-unified-v2`
- **Framework**: Must be set to **Vite** (not Next.js).
- **Build Command**: `pnpm run build`
- **Output Directory**: `dist`
- **Note**: The code is a Vite-based single-page application. Incorrectly setting the framework to Next.js causes asset requests (JS/CSS) to return `text/html`, resulting in fatal white screens.

## Deliverable: Living Product Pages
Every scan MUST resolve to a configuration that includes:
1. Authenticity Score & Dynamic Timeline.
2. StoryMode AI Narration/Video (Queued).
3. AI Concierge Personification (Voice of Product).
4. Token-Gated Chapters (Hidden Content).
5. QRON Reward & Burn Utility (Merchant Discounts).
