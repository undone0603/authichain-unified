# Contributing to AuthiChain Unified

Welcome! This is a complex polyglot monorepo combining AI agents, blockchain provenance, and an enterprise-grade product ecosystem.

## 🏗️ Architecture Overview

- **Frontend (Apps)**:
  - `apps/qron-platform`: The primary Next.js portal for administration, generation, and dashboarding.
  - `apps/client`: A React SPA for public verification and ecosystem galleries.
- **AI Orchestration (Agentz)**:
  - `agentz/`: A Python-based multi-agent framework.
  - `agentz/workflows/`: Defines the state machines for outreach, compliance, and growth.
- **Native Browser (Agent Browser)**:
  - `apps/agent-browser/`: A Rust-powered native browser bridge allowing AI agents to drive real-world browser sessions.
- **Infrastructure**:
  - **Database**: PostgreSQL (managed via Supabase/Drizzle).
  - **Blockchain**: Polygon/Bitcoin L1 for anchoring and NFT certificates.
  - **Edge**: Cloudflare Workers for high-performance API routing.

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js 22+** (with `pnpm`)
- **Python 3.12+**
- **Rust** (for `agent-browser` development)
- **Docker & Docker Compose**

### Quick Start (The Unified Way)
The fastest way to get the entire ecosystem running is using the unified Docker compose:

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 2. Launch infrastructure
docker compose up -d
```

### Manual Setup
If you prefer running services natively:

**1. Backend/Frontend:**
```bash
pnpm install
pnpm dev
```

**2. AI Agents:**
```bash
cd agentz
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-agentz.txt
python3 -m agentz.cli  # Access the agent controller
```

## 📜 Development Guidelines

### Adding a New Agent Workflow
1. Create a new handler in `agentz/workflows/handlers/`.
2. Register the workflow in `agentz/workflows/registry.yaml`.
3. Define the triggers and gates in `agentz/core/launch_gates.py`.

### Database Changes
We use Drizzle ORM. To modify the schema:
1. Update `apps/qron-platform/src/db/schema.ts`.
2. Run `pnpm db:generate`.
3. Run `pnpm db:migrate`.

### Browser Automation
If you are adding native browser capabilities, update the Rust definitions in `apps/agent-browser/cli/src/native/` and expose them via the TS bridge in `apps/agent-browser/src/`.

## 🧪 Testing & Verification
- Run the unified health check: `pnpm verify`
- Run frontend tests: `pnpm test:client`
- Run agent tests: `pytest agentz/tests`

## 🚩 Project State & Roadmap
Refer to `SYSTEM_STATE.md` and `docs/strategy/ROADMAP.md` for current priorities.
