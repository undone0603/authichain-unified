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

### 🏆 13 Major Milestones (Phase 3 Complete)
The following autonomous capabilities are now live in the platform:
1.  **Real QRON Ledger**: Database-backed reward and claim system.
2.  **Dynamic Timelines**: Real-time product identity updates based on scan velocity.
3.  **Community Photo Proof**: GPT-4 Vision-powered verification of products "in the wild."
4.  **Autonomous Revenue Blitz**: End-to-end sales funnel (Scout -> HubSpot -> Microsite).
5.  **Digital Twin Portals**: Personalized, dynamic prospect microsites.
6.  **W3C Verifiable Credentials**: Signed JSON-LD credentials for interoperability.
7.  **$QRON Siphon Loop**: Real-world merchant discount redemption via Stripe.
8.  **Data-Driven Rankings**: Dynamic industry authenticity index.
9.  **Truth Anchor Worker**: Automated L1 (Bitcoin) and L2 (Polygon) proof worker.
10. **Agent XP Display**: Gamified user reputation and leveling system.
11. **Global Truth 3D Map**: Real-time 3D visualization of protocol activity.
12. **EU DPP Auditor**: Autonomous compliance auditing against EU mandates.
13. **Viral Media Factory**: Background rendering of AI Avatar and StoryMode assets.

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
