# AuthiChain unified (canonical product repo)

This is the **only** repo to build and deploy for AuthiChain, QRON, GovChain, and StrainChain.

- Estate map: [`docs/ESTATE.md`](docs/ESTATE.md)
- Deploy map: [`docs/NETWORK.md`](docs/NETWORK.md)
- Public hosts: [authichain.com](https://authichain.com) · [qron.space](https://qron.space) · [govchain.us](https://govchain.us) · [strainchain.io](https://strainchain.io)
- Customer CTAs: apex paths (`/onboard`, `/dapp`, `/verify`). Never `*.vercel.app`.
- MCP source: `mcp/` (org snapshot: `AuthiChain2026/authichain-mcp-server`)
- Private outreach: `undone0603/authichain-ai-business-manager` (API-only)

---

# QRON Platform & AuthiChain Unified Core

Welcome to the unified repository for the **QRON Platform** and the **AuthiChain Agentic Ecosystem**.

## Overview

- **[Frontend (Client)](client/README.md)**: Vite + React application for branded experiences.
- **[AgentZ (Core)](agentz/README.md)**: Python-based workflow orchestrator for operational tasks.
- **[Protocol](protocol/README.md)**: Open-source reference implementation of the verification protocol.

## 1. QRON Platform (Frontend & Edge)

- **Cloudflare deploy target**: root worker + `workers/*` (see `wrangler.toml` and `.github/workflows/deploy-cloudflare.yml`)
- **Legacy Next.js-compatible code**: retained in-repo where needed, not the customer URL

### Multi-domain

Traffic is routed on `Host`:

- **qron.space**: Living QR studio
- **authichain.com**: protocol, certs, API, billing
- **govchain.us**: contractor pursue + seals
- **strainchain.io**: cannabis jar / COA packs

Shared routes (`/dashboard`, `/login`, `/api`, `/onboard`) stay unified.

### Tech stack

- Web app: Vite + React (`pnpm dev`, `pnpm build`)
- Database: Drizzle + Postgres (Supabase) and D1 on Workers
- Edge: Cloudflare Workers
- Package manager: pnpm

### Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## 2. AgentZ

```bash
python -m agentz.cli list
python -m agentz.cli run authichain_pilot_deploy --mode dry-run
```

## Pilot-readiness

`install → typecheck → lint → tests → production build → deploy smoke test → real product scan`

See `docs/operations/PILOT-READY-BASELINE.md` and `docs/attestation/v0.1.md`.

## Legal

See `docs/project/LICENSE.md`.
