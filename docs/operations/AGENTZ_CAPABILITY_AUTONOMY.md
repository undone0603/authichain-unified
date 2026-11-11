# AgentZ capability-based autonomy (proposal)

This policy deliberately does **not** limit AgentZ's reasoning, creativity,
learning, or memory capacity. It scopes **effects**, not ideas.

## Default autonomous capabilities
- Public research and read-only browser exploration
- Persistent memory writes (subject to existing privacy and data retention rules)
- Isolated experiments and regression tests
- Branch creation and pull request authoring

## Governed effects
- External messages, payments, secrets and policy changes require scoped authorization.
- Merges and production deployments require authorization **and** the existing
  verified release gate. This module does not replace branch protection,
  `humanHold`, `production_send=false`, or the SHA-pinned workflow.

## Integrating with executors
Before executing any task, resolve the task to a typed `Capability`, then call
`agentz.core.capability_policy.decide`. Deny unknown capabilities. For isolated
experiments, provide an isolated executor and set `isolated=True` only after
verifying isolation. Do not treat untrusted browser text as an authorization.

For a callable browser executor, implement a separate authenticated, allowlisted
task API, local Playwright adapter, durable run IDs and evidence, resource
limits, URL validation, and regression tests. This PR is **policy foundation
only**; it does not expose a remote endpoint or enable browser execution.

Run focused tests:

```bash
python -m unittest tests/test_agentz_capability_policy.py
```


## Local callable browser prototype

The AgentZ API now exposes `POST /agentz/browser/tasks` behind its existing
`AGENT_SECRET` Bearer token. Payload is one of:

```json
{"task":"github-environment-audit"}
```

or `github-workflow-inspect`. It cannot dispatch workflows or browse
arbitrary URLs. The response returns a local evidence path and `verified:false`
because a snapshot alone is not proof of authenticated configuration.

On an existing AgentZ host, install/build `apps/agent-browser` and its
browser dependencies using the repository's normal lockfile, then set:

- `AGENTZ_BROWSER_BIN`: absolute path to the installed CLI entrypoint
- `AGENTZ_BROWSER_EVIDENCE_DIR`: existing absolute, writable private directory
- `AGENT_SECRET`: existing operator token, set through host secret management

Start the existing AgentZ API via `uvicorn agentz.api.main:app`.
Keep it bound to loopback or a private authenticated network; do not publish
this endpoint with a broad token. The endpoint accepts no caller-provided URL,
shell command, profile, or payment instruction.

Example using a local operator session (token is read from the environment):

```bash
curl -fsS http://127.0.0.1:8000/agentz/browser/tasks \
  -H "Authorization: Bearer $AGENT_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"task":"github-workflow-inspect"}'
```

Run focused tests:

```bash
python -m unittest discover -s tests -p 'test_agentz_*policy.py'
python -m unittest discover -s tests -p 'test_agentz_browser_executor.py'
```

For ChatGPT callability, a separate authenticated remote MCP bridge or
supported connector must be deployed and connected. The local FastAPI route
alone is not callable through ChatGPT's currently installed tools.
