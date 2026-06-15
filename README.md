# QRON Platform & AuthiChain Unified Core

Welcome to the unified repository for the **QRON Platform** and the **AuthiChain Agentic Ecosystem**.

## 🚀 Overview

This repository is the central hub for the QRON ecosystem, integrating a high-performance frontend with a sophisticated autonomous agent orchestration layer.

- **QRON Platform**: A Next.js 14 multi-domain architecture serving specialized brands (qron.space, authichain.com, govchain.us, strainchain.io) with Cloudflare Edge integration and Drizzle ORM.
- **AuthiChain Unified Core (AgentZ)**: A Python-based workflow orchestrator that manages autonomous agents for infrastructure fixing, revenue operations, and high-entropy supply chain audits.

---

## 🌐 1. QRON Platform (Frontend & Edge)

A Next.js application with a Cloudflare Edge Worker and Drizzle ORM.

### Ecosystem & Multi-Domain Architecture

The QRON platform operates as a unified codebase serving four distinct branded experiences via Next.js Middleware.

- **qron.space**: Creative Studio & AI QR Art Generator.
- **authichain.com**: Enterprise Authentication Protocol & API Key Management.
- **govchain.us**: Ecosystem Governance, $QRON Staking, and DAO Voting.
- **strainchain.io**: Industrial Provenance & Digital Product Passports (DPP).

### Routing Logic
Traffic is routed based on the `Host` header. Shared application routes (like `/dashboard`, `/login`, and `/api`) remain unified across all domains, while the root path (`/`) serves the brand-specific landing page.

### Tech Stack
- **Framework**: [Next.js](https://nextjs.org) (App Router)
- **Database**: [Drizzle ORM](https://orm.drizzle.team) with PostgreSQL
- **Edge Runtime**: Cloudflare Workers
- **Styling**: Tailwind CSS

### Getting Started (Frontend)
1. **Setup Environment**: `cp .env.example .env`
2. **Install Dependencies**: `npm install`
3. **Run Development Server**: `npm run dev`

---

## 🤖 2. AuthiChain Unified Core (AgentZ)

The `agentz/` directory contains the control-plane layer for autonomous operational workflows, providing declarative, dependency-aware execution.

### Key Features
- **Workflow Registry**: Centralized declaration of operational tasks in YAML.
- **Operational Modes**: `dry-run` (validation), `confirm` (interactive), and `auto` (autonomous).
- **Dependency Resolution**: Automated ordering of prerequisite tasks.
- **Audit Logging**: Comprehensive run history in `agentz/runs.jsonl`.

### Usage (Python Agents)
```powershell
# Inspect registered workflows
python -m agentz.cli list

# Run a specific workflow in dry-run mode
python -m agentz.cli run vercel_fix_authichain_unified --mode dry-run

# Run all revenue-blocking workflows in auto mode
python -m agentz.cli run --all --revenue-only --mode auto
```

---

## 🛠️ Unified Database & Infrastructure

- **ORM**: Drizzle is used for schema management.
- **Migrations**: `npm run db:generate` and `npm run db:push`.
- **Edge**: Managed via `wrangler.toml` in the root.
- **Agents**: Python environment requires `pip install -r requirements-agentz.txt`.

## ⚖️ Legal & Intellectual Property

### Licensing
This project is licensed under the **AuthiChain Proprietary License**. See `LICENSE.md` for full terms. Unauthorized reproduction, distribution, or reverse engineering of the AuthiChain Protocol or its multi-domain routing architecture is strictly prohibited.

### Copyright
Copyright (c) 2026 AuthiChain Inc. All rights reserved. The QRON logo, AuthiChain Protocol branding, and "Living Portal" technology are trademarks of AuthiChain Inc.
