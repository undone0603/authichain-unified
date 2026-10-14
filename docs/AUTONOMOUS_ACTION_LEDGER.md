# Autonomous action ledger

`src/lib/founder-exit/ledger.ts` is the continuity record for agent work. Economic records stay where they already are:

- Payment delivery: `public.stripe_events` (`claimStripeEvent`).
- Entitlement: `public.profiles.last_grant_session_id` and `generations_limit`.
- Loop stages: `public.funnel_events`.
- Cash: `classifyRevenue` in `scripts/revenue-operator.ts`.

Do not write a revenue total into this ledger.

## Identity and lifecycle

Each action has `action_id`, `idempotency_key`, `action_type`, `agent_id`, `agent_identity_version`, `parent_action_id`, `delegation_chain`, timestamps, `policy_version`, evidence refs, lease fields, retry fields, and an append-only `history`.

Creating the same `idempotency_key` returns the original row.

States:

`queued → authorized → running → awaiting_external_result → succeeded`

Other terminals and holds: `retryable_failure`, `permanent_failure`, `blocked`, `cancelled`, `denied`, `reconciliation_required`.

`running` holds `lease_owner` and `lease_expires_at`. A second worker cannot take a live lease. History entries are appended. A completion patch cannot erase earlier entries.

These flags stay separate: `request_submitted`, `request_accepted`, `external_completed`, `result_independently_verified`, `result_reconciled`. None of them alone means the action succeeded.

## Authorization

Policy version `founder-exit-2026-10-13`.

Autonomous when the agent is not revoked and holds the capability or `operate_internal`:

- `inspect`, `reconcile`, `draft`, `retry_idempotent`, `collect_evidence`, `measure`

Blocked pending standing approval plus capability:

- `deploy`, `migrate`, `send_outbound`, `charge`, `refund`, `transfer`, `bind_commitment`, `rotate_credential`, `destroy`

A missing secret blocks the action with `error_class` `secret_unavailable` and leaves it visible. The module does not invent a secret. Error text passed through `redactDetail` strips `sk_live`, `rk_live`, `pk_live`, `pk_test`, and `whsec` tokens.

## Storage

`MemoryActionLedger` and `FileContinuityLog` are covered by `src/lib/founder-exit/ledger.test.ts`. The file store writes a JSON snapshot with `rename`. A commit hook that throws rolls the in-memory row back to the previous state. A `database_timeout` before the row is stored leaves the previous row in place.

`PostgresContinuityLog` is the Node store used by the replica drill. The apex webhook has no `DATABASE_URL`, so `fulfillDppPaidSession` writes through `src/lib/founder-exit/supabase-log.ts` and the Supabase service client. It inserts the `running` row before `provisionPurchase`, inserts the grant idempotency key after a non-failed grant, then updates that same action to `succeeded`. A failed grant throws before the success row. This does not recognize revenue.

Migration `supabase/migrations/20261013232408_founder_exit_action_ledger.sql` creates `public.founder_exit_actions` and `public.founder_exit_side_effects`. It is applied on production Supabase `nhdnkzhtadfkkluiulhs` and recorded as version `20261013232408`. The tables were empty after that apply. This is not a D1 migration.

## Measurement

`verification_status` is one of `verified`, `observed_unverified`, `estimated`, `simulated`, `blocked`, `unknown`. A simulated result cannot be stored as `verified`. A `verified` completion requires at least one output evidence ref.

`classifyEconomicEvidence` keeps payment, entitlement, activation, and recognized revenue apart. Recognized revenue from this function is always `blocked`. A demo or zero amount is `simulated`. A founder charge is not qualifying revenue. An entitlement flag without a verified non-founder payment is `blocked`.
