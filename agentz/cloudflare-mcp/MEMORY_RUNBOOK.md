# AgentZ durable memory and scheduled loop

Status: source-only until D1 binding, migration, Worker secret, deployment, and live tests succeed.

## Deployment prerequisites

The checked-in `wrangler.jsonc` currently binds `AGENTZ_DB` to `authichain-staging-db`; do not treat that as a verified production database. Use an isolated, approved D1 database before any production integration. The current Worker config has no checked-in Cron Trigger, and deployment/dashboard schedule state must be verified before claiming that a trigger is active.

Apply migrations through the protected deployment process. Migration `0002_scheduler_recovery.sql` adds bounded task expiry, execution leases, claim fencing, per-attempt evidence, and recovery of legacy `running` tasks. Do not apply it to a production database without approval and a reviewed backup/rollback plan.

If a dedicated `agentz-memory` database is approved and created within the existing Cloudflare account, update the binding in `wrangler.jsonc` with the **actual** returned UUID:

```json
"d1_databases": [{"binding":"AGENTZ_DB","database_name":"agentz-memory","database_id":"<actual database UUID>","migrations_dir":"migrations"}]
```

Apply `migrations/0001_memory.sql` through the normal Wrangler migration process. Set `AGENTZ_MCP_TOKEN` as a Worker secret, never a committed variable. Run syntax and unit checks and verify the Worker deployment in isolation.

## Execution

Only `public_probe` tasks for `https://github.com/undone0603/authichain-unified/...` are supported. Redirects are rejected. Each task expires after 24 hours; stale queued work is recorded as skipped rather than replayed. Each invocation claims at most three due tasks using a 30-second D1 lease and a fencing token. Expired leases are recovered; transient failures use bounded exponential backoff and the task's maximum-attempt count. Each attempt produces a durable event and a learning record linked to the event ID. The authenticated recent-memory tool exposes completion timestamps and the latest event outcome/evidence. Task failures are returned explicitly and cause a non-success dispatch result.

The existing `authichain-automation` integration documents an hourly `14 * * * *` dispatcher, but the live trigger assignment and AgentZ database binding must be verified independently. Do not add a competing Cron Trigger or activate a production schedule as part of this source change.

## Rollback

The migration is additive to the existing task/event tables. If a protected release is rolled back, restore the compatible Worker versions as a pair (AgentZ edge and its `authichain-automation` dispatcher), leave the additive columns and index in place, and keep the Cron Trigger disabled unless a separate activation approval exists. Do not delete the migration ledger or task/event rows. Reconcile any `running` task by its lease and event evidence before resuming the queue; do not replay a task whose outcome is ambiguous.

MCP tools: `agentz_enqueue_probe` and `agentz_memory_recent`. The MCP bearer token authorizes both reads and writes. Do not expose the token in logs or chat. Protect the endpoint with additional identity/rate controls before broader access.

## Acceptance

1. Confirm D1 schema exists and is isolated.
2. Confirm requests without the bearer token return 401.
3. Initialize MCP and list tools.
4. Enqueue a known public GitHub URL; verify its task ID and pending status.
5. Trigger a scheduled event and verify status, event row, and linked learning record.
6. Repeat a failed probe and confirm retry bound.
7. Confirm disallowed URLs, redirects, deployments, and payments cannot be executed.

This loop is **not** a general-purpose autonomous planner, browser renderer, or remote host executor. It only executes the narrowly defined public GitHub observation task. Never mark browser_inspect proven from this task.
