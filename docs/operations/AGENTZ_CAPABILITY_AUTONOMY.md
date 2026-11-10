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
