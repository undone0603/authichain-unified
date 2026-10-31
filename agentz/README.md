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

Power-user product automations (public rails, wait_buyer, X draft pack, OpenClaw handoff; dry-run sends no HTTP):

```bash
python -m agentz.cli run power_user_ops --mode dry-run
```

OpenClaw drop-in: `agentz/openclaw/POWER_USER.md`. Live X publish stays on AgentZ `xurl`, not this CLI.

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