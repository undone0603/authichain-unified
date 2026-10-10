# AgentZ: AuthiChain Autonomous Operations

The `agentz/` directory contains AuthiChain's operational control-plane and agent workflow layer. **AgentZ consumes the canonical trust result; it is not a second verification authority.**

## Current trust path

```text
physical identity
      ↓
canonical attestation worker
      ↓
VerificationDecision v1
      ↓
AgentZ / MCP
      ↓
authorized action + audit
```

Only a canonical response with:

- `decision == "verified"`
- `valid == true`

may be treated as positive protocol verification. `warning`, `blocked`, `revoked`, `expired`, `not_found`, `risk`, and `indeterminate` remain non-positive and must not be upgraded locally.

## Core features

- **Workflow Registry** — centralized declarations of operational tasks.
- **Operational Modes** — `dry-run`, `confirm`, `auto` with policy gates.
- **Dependency Resolution** — ordered task execution.
- **Audit Logging** — run history and action evidence.
- **Canonical verification client** — consumes the actual `/api/v1/attestation/verify` response instead of maintaining a parallel authenticity vocabulary.

## Getting started

1. Set up the Python environment:
   `pip install -r requirements-agentz.txt`
2. Configure environment variables.
3. List workflows:
   `python -m agentz.cli list`
4. Credential inventory (names/status/length, never values):
   `python -m agentz.cli creds --critical`
5. Run a workflow by registry id:
   `python -m agentz.cli run launch_governor --mode dry-run`

`run` defaults to `--mode confirm` and goes through the registry runner. `run --all --mode auto` is refused.

## Canonical verification integration

Set `AUTHICHAIN_CANONICAL_VERIFY_URL` to the canonical worker endpoint used by the environment. Missing or unavailable canonical verification is a failure condition; AgentZ must not substitute a local success result.

The shared response includes `decision`, `valid`, `reasons`, and `decision_contract` plus issuer/lifecycle evidence. Preserve that response in audit records when it is used to authorize an action.

## Repo integration audit

```bash
python -m agentz.cli run repo_audit_integrate --mode dry-run
```

Dry-run writes nothing. The controlled `auto` mode only updates the documented audit surfaces.

## Running the API

```bash
uvicorn agentz.api.main:app
```

- `AGENT_SECRET` must be set for token-protected routes. Without it those routes return 503 by design.
- `/scan` verifies a scan only when the request contains the required signed record and trusted issuer configuration.
- `$QRON` rewards and redemptions exposed by the current API are simulated; nothing should be described as minted/burned on-chain unless a real transaction is independently evidenced.

## Security posture

AgentZ operates inside AuthiChain's trust and policy envelope. It must not bypass canonical verification, issuer/lifecycle status, billing/security approval gates, or audit requirements. Production actions remain subject to repository and deployment controls.

See `../docs/OPERATING_CHARTER.md`, `../docs/ESTATE.md`, and `../docs/strategy/NORTH_STAR_VERIFICATION_INTEGRATION.md` for the current operating model.
