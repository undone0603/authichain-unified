# AgentZ durable memory and scheduled loop

Status: source-only until D1 binding, migration, Worker secret, deployment, and live tests succeed.

## Deployment prerequisites

Use a dedicated D1 database rather than any existing production database. Create `agentz-memory` within the existing Cloudflare account if the free allowance permits, then add the following binding to `wrangler.jsonc` with the **actual** returned UUID:

```json
"d1_databases": [{"binding":"AGENTZ_DB","database_name":"agentz-memory","database_id":"<actual database UUID>","migrations_dir":"migrations"}]
```

Apply `migrations/0001_memory.sql` through the normal Wrangler migration process. Set `AGENTZ_MCP_TOKEN` as a Worker secret, never a committed variable. Run syntax and unit checks and verify the Worker deployment in isolation.

## Execution

The Cron Trigger is `*/15 * * * *`. Each invocation claims up to three pending tasks, prioritized by priority then creation time. Only `public_probe` tasks for `https://github.com/undone0603/authichain-unified/...` are supported. Redirects are rejected. Each attempt produces an event, a status, and a learning record linked to the event ID. Transient failures are retried; terminal failures are retained.

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
