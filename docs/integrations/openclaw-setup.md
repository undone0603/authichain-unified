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
                    |
            +-------v--------+
            |  OpenClaw       |
            |  Gateway        |  (local, Node.js)
            |  :18789         |
            +-------+--------+
                    | webhook (POST /webhook/openclaw)
            +-------v--------+
            |  authichain-   |  (Cloudflare Worker)
            |  openclaw      |  claw.authichain.com
            +-------+--------+
                    | HTTP (Bearer auth)
            +-------v--------+
            |  AgentZ API    |  (FastAPI, localhost:8000)
            |  + Architect   |
            +----------------+
```

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

### 4. Set Worker secrets

```bash
cd workers/authichain-openclaw

# OpenClaw gateway URL (where OpenClaw is running)
npx wrangler secret put OPENCLAW_GATEWAY_URL
# Enter: ws://localhost:18789 (or your gateway URL)

# API key for the webhook auth
npx wrangler secret put OPENCLAW_API_KEY
# Enter a strong random string

# AgentZ API URL
npx wrangler secret put AGENTZ_API_URL
# Enter: http://localhost:8000

# AgentZ API key (must match the AGENT_SECRET in .env)
npx wrangler secret put AGENTZ_API_KEY
# Enter your AGENT_SECRET value
```

### 5. Deploy the Worker

```bash
cd workers/authichain-openclaw
npx wrangler deploy --config wrangler.toml
```

### 6. Start the AgentZ API

```bash
cd agentz
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

## Usage

Once connected, send messages from any messaging channel that OpenClaw routes:

| Command | Action |
|---------|--------|
| `help` | Show available commands |
| `agents` | List all registered AgentZ agents |
| `workflows` | List all available workflows |
| `run <id>` | Run a workflow (e.g. `run pinecone_trial_decision`) |
| `architect` | Run an Architect cycle (dry-run by default) |

### Example: WhatsApp

```
You: help
Bot: AuthiChain OpenClaw Bridge — Available commands:
     help, agents, workflows, run <id>, architect

You: architect
Bot: Architect Cycle Complete (architect-20260825T120000)
     Goal: Assess fleet health, fix failing workflows, and run priority jobs.
     Healthy: 18 -> 20
     Failing: 3 -> 1
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
curl -X POST http://localhost:8000/architect/cycle \
  -H "Authorization: Bearer $AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode": "dry-run", "goal": "Fix all failing workflows"}'
```

## Security

- The OpenClaw webhook is authenticated with `OPENCLAW_API_KEY` (Bearer token)
- The AgentZ API uses `AGENT_SECRET` for all endpoints
- The Worker does not expose credentials or secrets in responses
- All commands run in `confirm` mode by default when triggered via chat (requires
  human approval for side-effects) unless the operator explicitly sets `auto`
