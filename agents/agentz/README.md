# AgentZ Workflow Orchestrator

A control-plane layer on top of the existing `browser-use-qron` agent at
`C:\Users\Z\browser-use-qron`. Turns assumed/queued operational workflows
into declarative, dependency-aware, mode-controlled executions.

## Why

Existing AgentZ stack handles *one* task per invocation — write a prompt,
run the browser agent. This wrapper adds:

- **Registry** — every assumed workflow declared in one YAML file
- **Modes** — `dry-run` (describe), `confirm` (prompt per step), `auto` (run)
- **Dependency resolution** — workflows declare prerequisites, runner orders them
- **Credential preflight** — workflow blocks before launch if secrets missing
- **Audit log** — every run appended to `agentz/logs/runs.jsonl`
- **Filters** — `--priority critical,high`, `--revenue-only`, `--all`

## Install

```powershell
cd C:\Users\Z\browser-use-qron
# Drop the agentz/ folder here alongside your existing browser-use code
.\venv\Scripts\activate
pip install -r agentz\requirements-agentz.txt
copy agentz\.env.template .env
notepad .env   # fill in the values you want enabled
```

## Usage

```powershell
# Inspect what's registered
python -m agentz.cli list

# Show execution plan without running
python -m agentz.cli plan --priority critical,high

# Dry-run a single workflow (no side effects)
python -m agentz.cli run vercel_fix_authichain_unified --mode dry-run

# Confirm-mode: prompts before each step
python -m agentz.cli run --priority critical --mode confirm

# Full auto: run all revenue-blocking workflows unattended
python -m agentz.cli run --all --revenue-only --mode auto
```

## Modes Explained

| Mode | Behavior |
|------|----------|
| `dry-run` | Prints `WOULD: <action>` for every step. Touches nothing. Default. |
| `confirm` | Prints `NEXT: <action>`, waits for `y/N/skip-all`. Safe for first runs. |
| `auto` | Executes everything. Workflows flagged `confirm_before_run: true` are still promoted to confirm mode for safety. |

## Pre-loaded Workflows

The registry currently knows about these (derived from your operational state):

**Critical** (blocks downstream systems)
- `pinecone_trial_decision` — handle ~May 2 trial expiry

**High — Infrastructure**
- `vercel_fix_authichain_unified` — preset Vite → Other
- `gsc_setup_authichain` / `gsc_setup_qron` — Search Console verification
- `stripe_mcp_reconnect` — restore Claude.ai Stripe connector
- `n8n_activate_workflows` — flip 10 dormant blueprints live

**High — Revenue**
- `hubspot_drip_unstick` — release 29 stuck prospects
- `hubspot_near_term_followups` — Cloud Cannabis, Oakley Signs, PufCreativ, Lettuce
- `linkedin_strainchain_outreach` — Michigan cannabis decision-makers (capped 18/day)

**Medium — Distribution**
- `reddit_qron_post` — r/QRcode + r/generative
- `polygon_grants_submit`

**Low — Maintenance**
- `revoke_temp_pat` — close access window after Vercel fix
- `pipeline_health_report` — weekly snapshot

## Adding a Workflow

1. Add an entry to `agentz/workflows/registry.yaml`
2. Create handler `agentz/workflows/handlers/<your_id>.py` exposing `def run(ctx) -> str`
3. Wrap every side effect in `ctx.step("description", action=lambda: ...)` so all three modes work
4. If new credentials are needed, add the env-var mapping to `agentz/core/credentials.py`

## Architecture

```
agentz/
├── cli.py                          ← entry point
├── core/
│   ├── runner.py                   ← registry loader, dep resolver, dispatcher
│   ├── modes.py                    ← dry-run / confirm / auto wrappers
│   └── credentials.py              ← .env-backed cred resolver
├── workflows/
│   ├── registry.yaml               ← all workflow declarations
│   └── handlers/                   ← one .py per workflow id
└── logs/
    └── runs.jsonl                  ← append-only audit log
```

## Integration with Existing AgentZ

Browser-type handlers (`vercel_fix_preset`, `linkedin_outreach`, `gsc_setup`,
`reddit_post`, `polygon_grants`) instantiate `browser_use.Agent` with your
existing `langchain_ollama.ChatOllama(model="llama3.2")` setup. No changes
needed to your current `browser-use-qron` install — this layer sits on top.

For higher-quality agent reasoning on complex flows, swap the LLM in any
handler:

```python
from langchain_groq import ChatGroq
llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=get("groq_api_key"))
```

## Safety Defaults

- Default mode is `dry-run`. Auto-mode requires explicit `--mode auto`.
- Workflows with `confirm_before_run: true` (LinkedIn outreach, Pinecone migration) **always** prompt regardless of mode flag.
- Failures stop the chain unless `--continue-on-error`.
- Credentials never logged — only env-var name on missing.
- All runs appended to `logs/runs.jsonl` for audit / replay.
