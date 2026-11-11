# Existing Cron reuse: authichain-automation

Inspection (2026-11-10): Cloudflare account has five active Cron Trigger assignments. The deployed `authichain-automation` Worker uses `14 * * * *` and its `scheduled` handler currently logs the event. Do not change its schedule or overwrite its existing deployed bundle from this document.

## Proposed minimal integration

Use the existing hourly scheduled handler as a dispatcher. Preserve the original handler first; add a bounded, independent `ctx.waitUntil` task to POST to the isolated AgentZ Worker at `/internal/cron`. Include `Authorization: Bearer <secret>` and `x-agentz-dispatch: authichain-automation`. Store the secret in Cloudflare secret bindings, never in source or logs. Do not share the MCP user token with other callers: before production, use a distinct dispatch token validated only on this route.

Do not deploy the integration until the exact source repository and its build workflow are verified. A production bundle upload would replace existing logic. Use an approved PR, exact-head tests, and compare the current deployed bundle to the intended release.

## Acceptance

1. Verify existing `authichain-automation` scheduled logging still occurs.
2. Verify an unauthorized call to AgentZ `/internal/cron` returns 401.
3. Enqueue one allowlisted public GitHub task.
4. Trigger the existing Cron in a test environment; verify only one bounded dispatch.
5. Query D1 `agentz_tasks`, `agentz_task_events`, `agentz_learnings` and confirm linked evidence.
6. Simulate AgentZ outage; original scheduler must complete normally.
7. Do not enable a new Cron Trigger or change any other Worker's schedule.

The isolated AgentZ Worker currently has a prototype authenticated `/internal/cron` route in this PR. It is **not** a production-approved cross-worker integration until the dedicated dispatch credential, host authorization and regression tests are implemented.
