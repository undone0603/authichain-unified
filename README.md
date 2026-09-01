# QRON Platform & AuthiChain Unified Core

Welcome to the unified repository for the **QRON Platform** and the **AuthiChain Agentic Ecosystem**.

## 🚀 Overview

This repository is the central hub for the QRON ecosystem, integrating a high-performance frontend with a sophisticated autonomous agent orchestration layer.

- **QRON Platform**: A multi-domain web app serving specialized brands (qron.space, authichain.com, govchain.us, strainchain.io) with Cloudflare Edge integration and Drizzle ORM. **The primary dev/build scripts in this repo use Vite** (see `package.json`), with some Next.js-compatible modules/config also present.
- **AuthiChain Unified Core (AgentZ)**: A Python-based workflow orchestrator that manages autonomous agents for infrastructure fixing, revenue operations, and high-entropy supply chain audits.

> **Status:** This platform is in an active pre-traffic / early-revenue phase. Autonomous revenue and agentic workflows are built and operational in the codebase, but production usage metrics are still ramping — see commit history for ongoing hardening work.

---

## 🌐 1. QRON Platform (Frontend & Edge)

This repo is a monorepo.

- **Cloudflare deploy target**: root worker + `workers/*` services (see `wrangler.toml` and `.github/workflows/deploy-cloudflare.yml`)
- **Legacy Next.js-compatible code**: retained in-repo where needed, but not deployed via Vercel

See `docs/NETWORK.md` for the deployment map and current domains.

### Ecosystem & Multi-Domain Architecture

The QRON platform operates as a unified codebase serving four distinct branded experiences via host-based routing at the edge (Cloudflare Worker) and/or the web app layer.

- **qron.space**: Creative Studio & AI QR Art Generator.
- **authichain.com**: Enterprise Authentication Protocol & API Key Management.
- **govchain.us**: Ecosystem Governance, $QRON Staking, and DAO Voting.
- **strainchain.io**: Industrial Provenance & Digital Product Passports (DPP).

### Routing Logic

Traffic is routed based on the `Host` header. Shared application routes (like `/dashboard`, `/login`, and `/api`) remain unified across all domains, while the root path (`/`) serves the brand-specific landing page.

### Tech Stack

- **Web app (primary dev/build scripts)**: Vite + React (`pnpm dev`, `pnpm build`)
- **Next.js**: Present in the repo for compatibility/config in some areas, but **do not assume** a standard Next.js App Router project layout for the primary web build.
- **Database**: Drizzle ORM + PostgreSQL (Supabase) and a Cloudflare D1 binding for Worker-side persistence (see `wrangler.toml`).
- **Edge/fronting services**: Cloudflare Worker (`worker/index.ts`) + additional worker services
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm

### Getting Started (Frontend)

1. **Setup Environment**: `cp .env.example .env`
2. **Install Dependencies**: `pnpm install`
3. **Run Development Server**: `pnpm dev`

## 🤖 2. AuthiChain Unified Core (AgentZ)

The `agentz/` directory contains the control-plane layer for autonomous operational workflows, providing declarative, dependency-aware execution.

### Key Features

- **Workflow Registry**: Centralized declaration of operational tasks in YAML.
- **Operational Modes**: `dry-run` (validation), `confirm` (interactive), and `auto` (autonomous).
- **Dependency Resolution**: Automated ordering of prerequisite tasks.
- **Audit Logging**: Comprehensive run history in `agentz/runs.jsonl`.

### Usage (Python Agents)

```
# Inspect registered workflows
python -m agentz.cli list

# Run a specific workflow in dry-run mode
python -m agentz.cli run authichain_pilot_deploy --mode dry-run

# Run all revenue-blocking workflows in auto mode
python -m agentz.cli run --all --revenue-only --mode auto
```

## 🛠️ Unified Database & Infrastructure

- **ORM**: Drizzle is used for schema management.
- **Migrations**: `pnpm db:generate` and `pnpm db:migrate` (see `package.json` scripts).
- **Edge**: Managed via `wrangler.toml` and repo-managed `workers/*` services.
- **Deploy map**: `docs/NETWORK.md` is the canonical inventory of Cloudflare, database, and worker responsibilities.
- **Agents**: Python environment requires `pip install -r requirements-agentz.txt`.

## 🧪 Pilot-readiness

The repository uses a deployment-independent CI quality gate and a versioned AuthiChain attestation contract. The pilot baseline is:

`install → typecheck → lint → tests → production build → deploy smoke test → real product scan`

See `docs/operations/PILOT-READY-BASELINE.md` and `docs/attestation/v0.1.md` for the technical acceptance criteria.

## ⚖️ Legal & Intellectual Property

### Licensing

This repository uses a **two-part license** (AuthiChain Software License v1.1):

- **The Protocol** — the verification specification, reference verifier, and registry record format, located in `protocol/` — is licensed under the **Apache License 2.0** (see `protocol/LICENSE`). Anyone may implement it, including competitors.
- **The Platform** — everything else in this repository, including the application, the multi-agent verification pipeline, the edge deployment topology, brand implementations, and operational tooling — remains **proprietary** under the terms in `LICENSE.md`.

See `LICENSE.md` for full terms.

### Copyright

Copyright (c) 2026 AuthiChain Inc. All rights reserved. The QRON logo, AuthiChain Protocol branding, and "Living Portal" technology are trademarks of AuthiChain Inc.
