# AgentZ: AuthiChain Autonomous Launch

The `agentz/` directory contains the control-plane layer for autonomous operational workflows.

## Core Features

- **Workflow Registry**: Centralized declaration of operational tasks.
- **Operational Modes**: `dry-run`, `confirm`, `auto`.
- **Dependency Resolution**: Automated task ordering.
- **Audit Logging**: Comprehensive run history.

## Getting Started

1. Install AgentZ as a package, pinned to the host lock, from the repo root:
   `pip install -c requirements-agentz.txt -e '.[test]'`.
   This adds an `agentz` command that works from any folder. The editable
   install runs the checkout's code, the same as `python -m agentz.cli` did.
   `requirements-agentz.txt` stays the exact lock for the protected host image.
   The release unit is the wheel: `pip wheel --no-deps .` builds `agentz-<version>.whl`,
   with the version taken from `agentz/__init__.py`.
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

TinyFish MCP read-only search/fetch (on headless hosts, supply a protected
`TINYFISH_API_KEY`; Node.js/npx is only needed for local OAuth fallback):

```bash
python -m agentz.cli tinyfish search 'Agent2Agent protocol' --dry-run
python -m agentz.cli tinyfish search 'Agent2Agent protocol'
python -m agentz.cli tinyfish fetch_content https://github.com/a2aproject/a2a
```

The optional AgentZ discovery workflow is an **opt-in read-only A2A scout**.
It is disabled by default. Live dispatch still sends **0 outbound messages,
0 comments, and 0 posts**. Search snippets are untrusted; prompt-injection
and any instruction to send or disclose secrets are refused. No hardcoded
secrets, street address, or phone number are stored in this path.

```bash
python -m agentz.cli run tinyfish_a2a_scout --mode dry-run
python -m agentz.cli run tinyfish_a2a_scout --mode confirm
```

Its daemon schedule remains disabled until the host sets
`AGENTZ_TINYFISH_SCOUT_ENABLED=true`, `AGENTZ_TINYFISH_FREE_TIER_CONFIRMED=true`,
secures `TINYFISH_API_KEY`,
and configures `AGENTZ_TINYFISH_SCOUT_STATE_DIR` on a durable mounted volume.
The daemon permits one research _attempt_ per UTC date, without outreach.
If the state volume is missing, it refuses to run.

See [AgentZ + TinyFish MCP](../docs/operations/AGENTZ_TINYFISH_MCP.md) for
OAuth setup and the explicit boundary excluding browser automations and paid actions.

See `../docs/launch-governor.md` and `../docs/technical-reference/` for API and workflow details.

## Running the API

`uvicorn agentz.api.main:app` from the repo root.

- `AGENT_SECRET` must be set in that shell, to the same value claw holds as
  `AGENTZ_API_KEY`. Without it every token-protected route (including
  `/architect/cycle`) returns 503 on purpose: it fails closed. Optional
  `AGENT_SECRET_READ`, `AGENT_SECRET_RUN`, and `AGENT_SECRET_CREDENTIALS`
  split that bearer into scopes; when only `AGENT_SECRET` is set, behavior
  is unchanged. CORS origins default to the apex hosts in `agentz/api/cors.py`
  (`AGENTZ_CORS_ORIGINS` replaces the list; `*` is refused). SSE clients
  authenticate with `Authorization: Bearer` or an HttpOnly cookie from
  `POST /launch/sse/session` — not `?token=`. On-chain `anchor_identity`
  sign/send stays off unless `AGENTZ_CHAIN_SIGNING_ENABLED=true` and the
  chain, destination, value and gas allowlists pass.

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

## Voice + Vision console (local, opt-in, no hosted inference)

AgentZ can take a spoken question with a photo, camera snapshot or shared-screen
frame, analyze that still image with **your local vision-capable model**, and
speak its response in your browser. It is observation-only: no autonomous
browsing, payments, publishing, merges, or deployments are triggered.

1. Run a local OpenAI-compatible **vision** model through LM Studio or a
   compatible local server (an ordinary text-only model cannot see images).
2. Configure these on the machine running AgentZ (do not commit secrets):

   `AGENT_SECRET=<your existing private operator secret>`

   `AGENTZ_VOICE_VISION_ENABLED=true`

   `AGENTZ_VISION_MODEL=<the installed model's exact ID>`

   `AGENTZ_VISION_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions`

   If LM Studio runs on a private LAN host, use its private IP endpoint
   instead. Public hosts and HTTPS cloud inference endpoints are deliberately
   rejected. No new hosted model subscription is required.
3. From the repository root, run:
   `uvicorn agentz.api.main:app --host 127.0.0.1 --port 8000`
4. On the same computer open
   `http://127.0.0.1:8000/agentz/voice-vision`, enter `AGENT_SECRET`
   in the password field, tap **Start speaking**, then **Capture camera** or
   **Capture screen**, then **Observe and respond**. The answer is displayed
   and read aloud. An image file and typed question also work.

The API never echoes the operator secret or local-model token and never
persists uploaded frames. The UI sends one resized still image per request,
not a live video feed. Camera/screen permissions are explicitly user-granted.
Browser speech recognition availability varies; some browsers send audio to
their speech provider. Use typed input if fully local speech transcription is
required. Browser speech synthesis is used for spoken answers. This console
is intentionally localhost-only and disabled unless opted in. The vision
endpoint and tests are at `agentz/api/voice_vision.py` and
`agentz/tests/test_agentz_voice_vision.py`.

## CI scope

CircleCI reports `ci/circleci: agentz-quality-gate` for AgentZ and
`ci/circleci: authichain-quality-gate` for the web app; the required
`ci/circleci: main-quality-gate` passes when both do. A PR that only touches
`agentz/`, `docs/agentz/`, `pyproject.toml` or `requirements-agentz.txt`
skips the AuthiChain jobs, and a PR confined to AuthiChain app roots skips the
AgentZ job. The rules, and what counts as shared, live in
`scripts/ci/ci-scope.mjs`. Anything shared or unclear runs both.
