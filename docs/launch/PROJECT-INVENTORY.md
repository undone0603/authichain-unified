# Project Inventory

## Baseline
- **Repository:** `undone0603/authichain-unified` (`main` @ `87ce5b5f59faeea5d7aaa7db9c18c7e389606bca`)
- **Package Manager:** `pnpm@10.28.2`
- **Runtime:** Node `>=22.9.0`
- **Architecture:** Cloudflare-first architecture

## Core Ecosystem Surfaces (Production-Ready / Active)
- **AuthiChain Core** (`authichain.com`, `app.authichain.com` — `authichain-com`, `authichain-edge-router`, `worker-app/`, `api/`, `authichain-revenue-worker`):
  - **Capabilities:** Protocol verify, JWKS, GS1, DPP checkout (`/api/checkout/dpp`), Stripe webhook (`/api/stripe/webhook`), x402.
  - **Blockers:** Stripe Dashboard webhook alignment, B2B guardrail 404 on apex vs `app.authichain.com`, and `launch-gates-report.json` failing gates.
- **QRON** (`qron.space` — `workers/qron-space`, `workers/qron-image-gen`, `workers/authichain-qron-provenance`, `apps/qron-platform`):
  - **Capabilities:** Living QR studio and generation.
  - **Blockers:** Duplicate transitional workers in `apps/qron-platform/workers/` vs `workers/`.
- **StrainChain** (`strainchain.io` — `workers/strainchain-io`):
  - **Capabilities:** Regulated goods provenance and passports (`/onboard`, `/genetics`, `/passport`).
- **GovChain** (`govchain.us` — `workers/govchain-us`, `contracts/`):
  - **Capabilities:** Public-sector/contractor trust and seals (`/onboard`).
- **AgentZ & MCP/A2A** (`agentz/`, `mcp/`, `workers/authichain-agentz`, `workers/authichain-openclaw`, `workers/authichain-agentz-webhook`):
  - **Capabilities:** Autonomous agent orchestration, D1 memory, Cloudflare tunnel (`agentz.authichain.com`, `claw-gateway.authichain.com`).
  - **Blockers:** Access service token scoping (`#2537`), draft PRs `#2536`/`#2508`.

## Supporting & Vertical Workers (`workers/*`, `apps/*`, `packages/*`)
- **Critical Live External:** `authichain-verify-worker` (`#2540`/`#2535`)
- **Workers & Gateways:** `authichain-api-gateway`, `authichain-dashboard`, `gs1-resolver` (PR `#2602`), `dpp-fulfillment`, `stripe-reconcile`, `resend-relay`
- **Apps:** `apps/agent-browser`, `apps/chatbot`, `apps/verifier-web`
- **Packages (`packages/*`):** `config`, `contracts`, `evidence`, `libs`, `policy`, `shared`, `verifier`
- **Duplicate-Transitional Workers (`duplicate-transitional`):** `ai-classification`, `analytics`, `auth`, `blockchain`, `stripe-webhook`
- **Identity-Collision (`identity-collision`, critical):** `authichain-consensus-engine`

## Superseded / Archived Repos (from `docs/ESTATE.md` & `docs/NETWORK.md`)
- Legacy Vercel deployments (`scripts/guard-vercel-deploy.mjs`)
- Root `worker/` stub (no `[[routes]]`)
- 34 retired worker bundles in `docs/archive/cf-workers/`
