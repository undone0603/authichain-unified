# Founder independence

Status on `main` commit `a017ed5e`: **partially ready. Not founder-independent.**

A replacement agent can resume the isolated continuity drill without the founder in the room. It cannot yet run the live business alone. Production payment idempotency, entitlement storage, outbound send, deployments, and migrations stay on their existing gates.

## What already existed

- `public.stripe_events` claims each Stripe event id once before fulfillment. A missing claim fails closed so Stripe retries. That is the payment duplicate guard. This change does not replace it.
- `public.profiles` stores `generations_limit` and `last_grant_session_id`. `public.funnel_events` stores DPP loop stages. `automation_logs` stores automation failures that `buildRevenueProof` counts at read time.
- `workers/stripe-webhook` keeps `humanHold: true` for price `price_1TwmD8GqTruSqV8TpAF8dfyA`. Generations for that price stay on the apex `provisionPurchase` path.
- Cash classification stays in `scripts/revenue-operator.ts` (`classifyRevenue`). This module does not recognize revenue.
- Verifiable outbound is not on `main`. `production_send` is not enabled here. No mail is sent.

## What this change adds

`src/lib/founder-exit/ledger.ts` is an operational continuity ledger. It records action identity, authorization, lease, side-effect idempotency, and append-only history. It is not a price catalogue and not a second economic ledger.

`MemoryActionLedger` and `FileContinuityLog` remain the CI stores. `PostgresContinuityLog` in `src/lib/founder-exit/postgres-log.ts` flushes those same transitions to `public.founder_exit_actions` and commits each side-effect key in its own transaction. Migration `20261013232408_founder_exit_action_ledger.sql` is applied on Supabase `nhdnkzhtadfkkluiulhs`. Both tables have RLS enabled, no policies, and no grants for `anon` or `authenticated`. `service_role` can select, insert, and update actions, and can select and insert side-effect keys. Deletes are rejected. The production tables were empty after apply. The payment webhook does not write this ledger.

## What a replacement agent can answer from the ledger

`continuitySnapshot` lists unfinished, ambiguous, safe-to-resume, blocked, denied, and succeeded action ids, plus `policy_version` `founder-exit-2026-10-13`.

- Authorized internal work (`inspect`, `reconcile`, `draft`, `retry_idempotent`, `collect_evidence`, `measure`) proceeds when the agent holds the capability and is not revoked.
- Deploy, migrate, send, charge, refund, transfer, binding commitment, credential rotation, and destroy stay blocked until standing approval and the matching capability are both present. Founder absence is not approval.
- A revoked agent is denied and recorded. A different agent may resume an action that is already `authorized` and `permitted` only when that agent holds the capability.
- An external timeout becomes `reconciliation_required`. It does not become success or failure.
- A retry that finds an existing side effect finalizes the same action id and does not apply the effect again.

## Still blocked

| Gap                                                  | State                               | Smallest next step                                                                                                           |
| ---------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Non-founder $299 DPP purchase, one grant, activation | BLOCKED                             | A real customer pays at the gated checkout. Do not insert a grant or charge a card.                                          |
| Stripe livemode list                                 | BLOCKED                             | `stripe login` or replace the revoked restricted key. The stored key returns HTTP 401.                                       |
| D1 license query                                     | BLOCKED                             | The Actions token cannot query D1 (Cloudflare 7403). Do not rerun the migrate workflow.                                      |
| Production action table                              | IMPLEMENTED_NOT_PRODUCTION_VERIFIED | Schema `20261013232408` is on production and empty. No live worker writes it yet. Payments stay on `stripe_events`.          |
| Backup restoration                                   | IMPLEMENTED_AND_TESTED              | Local Postgres 16 replica only: dump, drop database, restore, then one recovered side effect. No production data was copied. |
| Outbound send                                        | BLOCKED                             | PR 1829 is held. `production_send` stays false. No recipient was named.                                                      |
| Merge autopilot                                      | BLOCKED                             | The GitHub workflow is `disabled_manually`. Do not enable it to land one PR.                                                 |
| Lead capture false success                           | IMPLEMENTED_NOT_PRODUCTION_VERIFIED | PR 1835 is green and unmerged. Live `/api/leads/capture` can still report success when the insert throws.                    |

The isolated drill report is `docs/evidence/founder-exit-drill.json`. The replica dump and recovery report is `docs/evidence/founder-exit-replica-drill.json`. Passing either file is not production autonomy.
