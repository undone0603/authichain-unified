---
name: authichain-context
description: Canonical facts, URLs, stack and guardrails for the AuthiChain business. Load this before any AuthiChain, QRON, GovChain or StrainChain work so every bot and automation uses the same repo, domains, links and rules.
---

Use this as the single source of truth for AuthiChain work. If a request conflicts with it, say so instead of guessing.

CANONICAL REPO: github.com/undone0603/authichain-unified. This is the only repo to build and deploy for AuthiChain, QRON, GovChain and StrainChain. Estate map docs/ESTATE.md, deploy map docs/NETWORK.md, MCP source mcp/.

PUBLIC HOSTS: authichain.com (protocol, certs, API, billing), qron.space (living QR studio), govchain.us (contractor pursue + seals), strainchain.io (cannabis jar / COA packs). Shared routes /dashboard, /login, /api, /onboard are unified.

LINK RULE: customer-facing CTAs must use apex paths only - /onboard, /dapp, /verify. Never publish a *.vercel.app or *.workers.dev URL to a customer or in marketing.

STACK: Vite + React web app (pnpm dev / pnpm build), Cloudflare Workers edge (root wrangler.toml -> worker/index.ts, wrangler.app.jsonc for the OpenNext build, workers/* each pinning its own Wrangler 4), D1, Supabase Postgres with Drizzle, pnpm, TypeScript, Polygon NFT certificates, GPT-4 Vision product verification, AgentZ Python orchestrator (python -m agentz.cli list / run <workflow> --mode dry-run), GitHub Actions .github/workflows/deploy-cloudflare.yml.

PILOT-READINESS CHAIN (docs/operations/PILOT-READY-BASELINE.md): install -> typecheck -> lint -> tests -> production build -> deploy smoke test -> real product scan. Treat any red link as a blocker.

POSITIONING: the authentic agentic economy - an authenticity layer for agents and humans. Revenue model: self-serve SaaS subscriptions plus usage-based API billing.

GUARDRAILS
- Never fabricate customers, revenue, testimonials, certifications, audit results or regulatory approval. If a fact is not in this skill or in the repo, say unknown.
- Do not publish, post, email, spend money, sign anything, or change permissions and access without the founder's explicit go-ahead in chat. Draft it and wait.
- Never print, log or paste secrets, API keys, private keys, seed phrases or bank details. Reference secret names only.
- Multi-tenant safety is non-negotiable: every query and route must be tenant-scoped.
- Cannabis, government, medical and financial claims need review by a licensed professional. Flag them; never present output as legal advice.
- Dry-run first. For AgentZ use --mode dry-run and show the plan before a real run.
