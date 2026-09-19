# OpenClaw Integration Guide

## Overview

[OpenClaw](https://github.com/openclaw/openclaw) is an open-source personal AI assistant
framework that connects LLMs to 77+ messaging platforms (WhatsApp, Telegram, Slack,
Discord, Signal, iMessage, etc.) through a single local gateway.

This integration bridges OpenClaw's messaging gateway to the AuthiChain AgentZ fleet,
so you can control all 30+ agents and the Unified Architect from any chat app.

## Architecture

```
WhatsApp / Telegram / Slack / Discord / ...
                    │
            ┌───────▼────────┐
            │  OpenClaw       │
            │  Gateway        │  (owner-set reachable Node host)
            │                 │  OPENCLAW_GATEWAY_URL — do not invent
            └───────┬────────┘
                    │ webhook (POST /webhook/openclaw)
            ┌───────▼────────┐
            │  authichain-   │  (Cloudflare Worker)
            │  openclaw      │  claw.authichain.com
            └───────┬────────┘
                    │ HTTP (Bearer AGENTZ_API_KEY = AGENT_SECRET)
                    │ paths: /agents /workflows /architect/cycle
                    │ (no /api prefix)
            ┌───────▼────────┐
            │  authichain-   │  (Cloudflare Containers)
            │  agentz        │  agentz.authichain.com
            │  uvicorn :8000 │  agentz.api.main:app
            └────────────────┘
```

Keep **Cloudflare Access** on `agentz.authichain.com` and `claw.authichain.com`.
Do not enable social publish from this bridge.

## Setup

### 1. Install OpenClaw

On your server or local machine:

```bash
# Install OpenClaw (requires Node 22.22.3+)
npm install -g openclaw@latest --allow-scripts=openclaw

# Run onboarding (creates workspace, configures gateway)
openclaw onboard --install-daemon

# Verify it's running
openclaw gateway status
```

### 2. Connect a channel

Follow the OpenClaw docs for your preferred channel:

- [WhatsApp](https://docs.openclaw.ai/channels/whatsapp)
- [Telegram](https://docs.openclaw.ai/channels/telegram)
- [Slack](https://docs.openclaw.ai/channels/slack)
- [Discord](https://docs.openclaw.ai/channels/discord)

### 3. Configure the webhook

In the OpenClaw gateway config, add an outbound webhook to the bridge Worker:

```json
{
  "webhooks": {
    "outbound": {
      "url": "https://claw.authichain.com/webhook/openclaw",
      "auth": "Bearer <OPENCLAW_API_KEY>"
    }
  }
}
```

### 4. Host AgentZ on Cloudflare Containers

Owner decision 2026-09-19: **Cloudflare Containers** (not Tunnel).

`workers/authichain-agentz/Dockerfile` follows `Dockerfile.agentz`
(`python:3.12-slim`, `requirements-agentz.txt`, repo-root context) but is the
API image: `EXPOSE 8000` and
`CMD uvicorn agentz.api.main:app --host 0.0.0.0 --port 8000`.
The Container class sets `defaultPort = 8000` and proxies with
`getContainer(env.AGENTZ).fetch(request)`.

`Dockerfile.agentz` / compose `agentz` stay the CLI (`python3 -m agentz.cli`).

```bash
cd workers/authichain-agentz

# Names as used by agentz.core.credentials.get():
#   get("agent_secret")         → AGENT_SECRET
#   get("supabase_url")         → SUPABASE_URL
#   get("supabase_service_key") → SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_SERVICE_KEY is accepted as an alias and forwarded to
# SUPABASE_SERVICE_ROLE_KEY.
npx wrangler secret put AGENT_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

npx wrangler deploy --config wrangler.jsonc
```

CI: **Actions → Deploy Workers → Run workflow** with `worker=authichain-agentz`.
The runner needs Docker (image build). The Cloudflare token needs Workers
Scripts edit and Containers / registry push.

After deploy (Access stays on `agentz.*` — unauthenticated curl 302s to
`strainchainexecutiveteam.cloudflareaccess.com`; that is correct):

```bash
curl -sS https://agentz.authichain.com/health
# authenticated / service-token expect: {"status":"sovereign","network":"Polygon"}
```

First request can take a minute while the container boots.

Local uvicorn remains optional for development:

```bash
cd /path/to/authichain-unified
PYTHONPATH=. python -m uvicorn agentz.api.main:app --host 0.0.0.0 --port 8000
```

### 5. Set claw Worker secrets

```bash
cd workers/authichain-openclaw

# OpenClaw gateway — owner-set reachable host only. Do not invent a URL.
npx wrangler secret put OPENCLAW_GATEWAY_URL

# API key for the webhook auth
npx wrangler secret put OPENCLAW_API_KEY

# AgentZ Containers host (also the wrangler [vars] default)
npx wrangler secret put AGENTZ_API_URL
# Enter: https://agentz.authichain.com

# Must match AGENT_SECRET on authichain-agentz
npx wrangler secret put AGENTZ_API_KEY
```

Claw calls AgentZ at `/agents`, `/workflows`, `/architect/cycle` — **no** `/api`
prefix. There is no in-flight OpenClaw PR as of 2026-09-19; this repo's
`authichain-openclaw` Worker is the coordination point.

### 6. Deploy the claw Worker

```bash
cd workers/authichain-openclaw
npx wrangler deploy --config wrangler.toml
```

## Usage

Once connected, send messages from any messaging channel that OpenClaw routes:

| Command     | Action                                              |
| ----------- | --------------------------------------------------- |
| `help`      | Show available commands                             |
| `agents`    | List all registered AgentZ agents                   |
| `workflows` | List all available workflows                        |
| `run <id>`  | Run a workflow (e.g. `run pinecone_trial_decision`) |
| `architect` | Run an Architect cycle (dry-run by default)         |

### Example: WhatsApp

```
You: help
Bot: 🦞 AuthiChain OpenClaw Bridge — Available commands:
     help, agents, workflows, run <id>, architect

You: architect
Bot: Architect Cycle Complete (architect-20260825T120000)
     Goal: Assess fleet health, fix failing workflows, and run priority jobs.
     Healthy: 18 → 20
     Failing: 3 → 1
     Net improvement: +2
```

## The Unified Architect Agent

The architect (`agentz/core/architect.py`) is a meta-agent that:

1. **Assesses** fleet health from audit logs (runs.jsonl)
2. **Plans** a prioritized action list using the LLM (LimitProofLLM waterfall)
3. **Delegates** execution through the existing Runner (respects prerequisites, rate limits)
4. **Reviews** before/after metrics and persists a cycle report

### Running directly

```bash
# Dry-run (safe — assesses and plans without executing)
python -m agentz.core.architect --mode dry-run

# Confirm mode (prompts before each action)
python -m agentz.core.architect --mode confirm

# Auto mode (full autonomous cycle)
python -m agentz.core.architect --mode auto
```

### Via the workflow registry

```bash
python -m agentz.cli run architect_cycle --mode dry-run
```

### Via the API

```bash
curl -X POST https://agentz.authichain.com/architect/cycle \
  -H "Authorization: Bearer $AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode": "dry-run", "goal": "Fix all failing workflows"}'
```

## AgentZ → OpenClaw (reverse client)

AgentZ can call the bridge Worker as a client (status, notify, command) without a
direct WebSocket to the OpenClaw Node gateway. Containers hosting and the claw
`/api` path fix live in PR #1057 — this section covers the Python client only.

```bash
export CLAW_BRIDGE_URL=https://claw.authichain.com   # optional; this is the default
export OPENCLAW_API_KEY=...                          # same secret as the Worker

python -m agentz.cli openclaw status
python -m agentz.cli openclaw notify "fleet check complete" --dry-run
python -m agentz.cli openclaw notify "fleet check complete" --send
python -m agentz.cli openclaw command agents
```

- `notify` defaults to dry-run (no channel delivery) unless `--send`.
- Client module: `agentz.integrations.openclaw.OpenClawClient`.
- Bridge reverse routes: `GET /gateway/status`, `GET /agents`, `GET /workflows`,
  `POST /notify`, Bearer on `POST /command` (accepts `OPENCLAW_API_KEY` or
  `AGENTZ_API_KEY`).

## Security

- The OpenClaw webhook is authenticated with `OPENCLAW_API_KEY` (Bearer token)
- The AgentZ API uses `AGENT_SECRET` (`credentials.get("agent_secret")`) for authenticated endpoints
- Keep Access on `agentz.*` and `claw.*`
- The Worker does not expose credentials or secrets in responses
- All commands run in `confirm` mode by default when triggered via chat (requires
  human approval for side-effects) unless the operator explicitly sets `auto`
