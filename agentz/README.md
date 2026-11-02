# AgentZ: AuthiChain Autonomous Launch

The `agentz/` directory contains the control-plane layer for autonomous operational workflows.

## Core Features

- **Workflow Registry**: Centralized declaration of operational tasks.
- **Operational Modes**: `dry-run`, `confirm`, `auto`.
- **Dependency Resolution**: Automated task ordering.
- **Audit Logging**: Comprehensive run history.

## Getting Started

1. Set up Python environment: `pip install -r requirements-agentz.txt`
2. Configure environment variables.
3. List workflows: `python -m agentz.cli list`
4. Credential inventory (names, status, length — never values): `python -m agentz.cli creds --critical`
5. Run a workflow by **registry id**: `python -m agentz.cli run launch_governor --mode dry-run`

`run` defaults to `--mode confirm` and goes through the registry runner (credential preflight + audit log). `run --all --mode auto` is refused.

Repo integration audit (writes nothing in dry-run; `auto` refreshes only `docs/NETWORK.md` and `docs/operations/REPO-INTEGRATION-AUDIT.md`):

```bash
python -m agentz.cli run repo_audit_integrate --mode dry-run
```

Taskmarket (read-only pick; the CLI signs later, this workflow never does):

```bash
python -m agentz.cli run taskmarket_cycle --mode dry-run
```

The picker is `agentz/core/taskmarket.py`. It chooses one open Base USDC worker task and prints the CLI command. It does not claim, submit, stake, or treat the task as Stripe revenue. Procedure: `agentz/knowledge/TASKMARKET.md`.
Power-user product automations (public rails, wait_buyer, X draft pack, OpenClaw handoff; dry-run sends no HTTP):

```bash
python -m agentz.cli run power_user_ops --mode dry-run
```

OpenClaw drop-in: `agentz/openclaw/POWER_USER.md`. Live X publish stays on AgentZ `xurl`, not this CLI.

TinyFish MCP read-only search/fetch (Node.js/npx and an authenticated TinyFish
session on the AgentZ host are required):

```bash
python -m agentz.cli tinyfish search 'Agent2Agent protocol' --dry-run
python -m agentz.cli tinyfish search 'Agent2Agent protocol'
python -m agentz.cli tinyfish fetch_content https://github.com/a2aproject/a2a
```

The optional AgentZ discovery workflow is registered separately:
```bash
python -m agentz.cli run tinyfish_a2a_scout --mode dry-run
python -m agentz.cli run tinyfish_a2a_scout --mode confirm
```
Its daemon schedule remains disabled until the host sets
`AGENTZ_TINYFISH_SCOUT_ENABLED=true` and secures `TINYFISH_API_KEY`.
It performs at most one read-only A2A search per day, without outreach.

See [AgentZ + TinyFish MCP](../docs/operations/AGENTZ_TINYFISH_MCP.md) for
OAuth setup and the explicit boundary excluding browser automations and paid actions.

See `../docs/launch-governor.md` and `../docs/technical-reference/` for API and workflow details.

## Running the API

`uvicorn agentz.api.main:app` from the repo root.

- `AGENT_SECRET` must be set in that shell, to the same value claw holds as
  `AGENTZ_API_KEY`. Without it every token-protected route (including
  `/architect/cycle`) returns 503 on purpose: it fails closed.
- `/scan` verifies a scan only when the request carries a signed `record`
  (optional `anchor`) per `protocol/SPEC.md`. `agentz/core/signature.py` runs it
  through `protocol/verifier.mjs`, so `node` must be on `PATH` (or set
  `AGENTZ_NODE_BIN`). The signing key must be listed in
  `AGENTZ_TRUSTED_ISSUERS` (comma-separated `did:key`s), and the record's
  `credentialSubject.id` must equal the product's `metadata.subject_id`.
  Anything missing leaves the signature `not_checked` and the scan unverified.
- `$QRON` rewards on `/scan` and redemptions on `/redeem` are simulated and say
  so (`simulated: true`); nothing is minted or burned on-chain.

## Control plane

The read-only deployment control plane is available at `GET /control-plane/state` and returns normalized GitHub, GitLab, Vercel, and optionally Cloudflare Workers/Pages state. It correlates provider commits to the authoritative GitHub `main` commit and emits a conservative release gate: `deploy_eligible`, `blocked`, or `observe_only`.

Cloudflare Worker deployment APIs expose the active deployment and version IDs; Cloudflare Pages deployments expose the trigger branch and commit hash. These APIs are observation-only here. Provider mutations remain in the existing governed workflows.
