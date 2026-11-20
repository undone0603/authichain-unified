# AgentZ durable memory and scheduled loop — guarded recovery

Status: **production held**. This is a source-level recovery improvement, not a deployment or proof of successful production-memory persistence.

## Observed inventory (2026-11-14 UTC)

- `authichain-agentz-mcp-edge` has an existing live deployment (last listed 2026-11-10).
- Its committed Wrangler configuration bound `AGENTZ_DB` to `authichain-staging-db` (`7cc833bb-32ed-47a3-aba8-df44657ca510`). A read-only D1 query confirmed that AgentZ task, event, and learning tables exist there, but no tasks were returned.
- No dedicated `agentz-memory` D1 database appeared in the available account inventory of 10 D1 databases.
- This patch **intentionally removes the shared staging D1 binding from source**, with no production Worker mutation. A future deployment without an independently provisioned dedicated D1 will return degraded / unavailable for memory-dependent operations rather than silently using staging. Do not copy task rows to a new DB or delete staging tables without a separately reviewed migration and rollback.

## Protected handoff (NOT completed)

1. Determine that a separate D1 database can be provisioned under the existing zero-additional-spend limit. Do not assume account allowance or create paid resources without verification.
2. Provision `agentz-memory` with its *actual* UUID and update `wrangler.jsonc` to bind only it as `AGENTZ_DB` in a **separate** reviewed PR.
3. Apply `migrations/0001_memory.sql` and `migrations/0002_lease_recovery.sql` to the dedicated database in that order. Reconcile existing schema before applying; do not apply this patch's migration to staging or a production verification database.
4. Configure the existing `AGENTZ_MCP_TOKEN` and separate `AGENTZ_DISPATCH_TOKEN` as protected secrets; verify authorization and isolation. Maintain a protected release hold until D1 binding, migrations, exact-head CI, deployment identity, rollback and positive/negative smoke tests all pass.
5. Run authenticated local acceptance: enqueue one allowlisted GitHub URL, check pending state, trigger a scheduled read, check task/event/learning link and idempotent replay. Verify overlapping invocations, an expired lease and stale completion do not duplicate a grant or mislabel an unknown outcome. Never interpret a public HTTP 200 as a paid or production release proof.

## Recovery and memory semantics

`agentz_enqueue_probe` accepts optional `idempotency_key` (`[A-Za-z0-9:_-]`, 8-128 chars), unique for each semantic operation. Same key and same request returns the prior task ID; conflicting payload fails. A single SQL `UPDATE ... RETURNING` atomically claims pending work, fencing it with a unique claim ID and a 30-second lease. The Cron loop works on at most three read-only public probes per invocation.

Expired leases are marked **unknown**, recorded in the event ledger, and retried after at least five minutes (up to three attempts). An expired run cannot overwrite a fresh claim. Completion, event and linked learning are written in a single D1 transaction and fenced by an audit marker. The memory API returns bounded task, event and learning records; no arbitrary remote code or payment action is enabled.

No extra Cron triggers, new paid services, outbound calls, production deployments or financial mutations are part of this source-only change. Preserve the existing automation Worker's schedule and its current live behavior until a dedicated protected release is authorized.
