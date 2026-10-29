# Founder independence

Status after `main` commit `d1dac908`: **partially ready. Not founder-independent.**

A replacement agent can resume the isolated continuity drill without the founder in the room. It cannot yet run the live business alone. Production payment idempotency, entitlement storage, outbound send, deployments, and migrations stay on their existing gates.

## What already existed

- `public.stripe_events` claims each Stripe event id once before fulfillment. A missing claim fails closed so Stripe retries. That is the payment duplicate guard. This change does not replace it.
- `public.profiles` stores `generations_limit` and `last_grant_session_id`. `public.funnel_events` stores DPP loop stages. `automation_logs` stores automation failures that `buildRevenueProof` counts at read time.
- `workers/stripe-webhook` keeps `humanHold: true` for price `price_1TwmD8GqTruSqV8TpAF8dfyA`. Generations for that price stay on the apex `provisionPurchase` path.
- Cash classification stays in `scripts/revenue-operator.ts` (`classifyRevenue`). This module does not recognize revenue.
- Verifiable outbound is on `main` as of PR 1829 (`151365e38`, 2026-10-16). `defaultOutboundPolicy().production_send` is false. No mail is sent by that default.

## What this change adds

`src/lib/founder-exit/ledger.ts` is an operational continuity ledger. It records action identity, authorization, lease, side-effect idempotency, and append-only history. It is not a price catalogue and not a second economic ledger.

`MemoryActionLedger` and `FileContinuityLog` remain the CI stores. `PostgresContinuityLog` in `src/lib/founder-exit/postgres-log.ts` flushes those same transitions to `public.founder_exit_actions` and commits each side-effect key in its own transaction. Migration `20261013232408_founder_exit_action_ledger.sql` is applied on Supabase `nhdnkzhtadfkkluiulhs`. Both tables have RLS enabled, no policies, and no grants for `anon` or `authenticated`. `service_role` can select, insert, and update actions, and can select and insert side-effect keys. Deletes are rejected. The production tables were empty after apply, and a read-only count on 2026-10-14 was still 0 actions and 0 side effects. `fulfillDppPaidSession` writes one running action before `provisionPurchase` and one grant key before marking that action succeeded. That writer is in live worker `authichain-edge-router` version `e12ea615-8db2-4f82-b754-6a8594e85eb5` (2026-10-14T00:30:36Z). No production continuity row has been written. A public `DPP-SMOKE-E2E` request stays on the confirm page because `DPP_SMOKE_SECRET` is not bound.

## What a replacement agent can answer from the ledger

`continuitySnapshot` lists unfinished, ambiguous, safe-to-resume, blocked, denied, and succeeded action ids, plus `policy_version` `founder-exit-2026-10-13`.

- Authorized internal work (`inspect`, `reconcile`, `draft`, `retry_idempotent`, `collect_evidence`, `measure`) proceeds when the agent holds the capability and is not revoked.
- Deploy, migrate, send, charge, refund, transfer, binding commitment, credential rotation, and destroy stay blocked until standing approval and the matching capability are both present. Founder absence is not approval.
- A revoked agent is denied and recorded. A different agent may resume an action that is already `authorized` and `permitted` only when that agent holds the capability.
- An external timeout becomes `reconciliation_required`. It does not become success or failure.
- A retry that finds an existing side effect finalizes the same action id and does not apply the effect again.

## Still blocked

| Gap                                                  | State                               | Smallest next step                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-founder $299 DPP purchase, one grant, activation | BLOCKED                             | A real customer pays at the gated checkout. Do not insert a grant or charge a card.                                                                                                                                                                                     |
| Stripe livemode list                                 | BLOCKED                             | Worker `authichain-dashboard` has secret `STRIPE_READ_KEY` and calls charges, balance, subscriptions, and checkout sessions. Stripe rejects that key with HTTP 401. The CLI has no API key. Webhook signing is separate and still returns HTTP 400 for a bad signature. |
| D1 license query                                     | BLOCKED                             | Secondary to the $299 path. DPP grants use Supabase. GitHub Actions run 38425011850 still fails with Cloudflare 7403. Local Wrangler can read `authichain-license-db`. Do not rerun the migrate workflow with the Actions token.                                        |
| Production action table                              | DEPLOYED_NOT_EXERCISED              | Schema `20261013232408` is on production. Count on 2026-10-29: 0 actions, 0 side effects. The 2026-10-14 script `e12ea615` contained the writer. Version `28ff2813` on 2026-10-29 is a secret change; this check did not re-download the script. Do not insert a row. |
| Backup restoration                                   | IMPLEMENTED_AND_TESTED              | Local Postgres 16 replica only: dump, drop database, restore, then one recovered side effect. No production data was copied.                                                                                                                                            |
| Outbound send                                        | BLOCKED                             | PR 1829 is merged and still labeled `hold`. `production_send` stays false. No recipient was named. No mail was sent.                                                                                                                                                     |
| Merge autopilot                                      | BLOCKED                             | The GitHub workflow is `disabled_manually`. Do not enable it to land one PR.                                                                                                                                                                                            |
| Edge-router publish                                  | BLOCKED                             | `deploy-cloudflare.yml` is `disabled_manually`. Last successful push deploy was 2026-10-15 (`ca8ee529f`). Do not enable it to publish one commit. The 2026-10-29 worker version `28ff2813` is a secret change, not a script publish of current `main`.                      |
| Lead capture false success                           | TESTED_NOT_PRODUCTION_VERIFIED      | Worker capture, worker `/api/book`, and the Next capture route return HTTP 500 and skip CRM and mail when the durable write fails. A failed write was not injected in production.                                                                                        |

The isolated drill report is `docs/evidence/founder-exit-drill.json`. The replica dump and recovery report is `docs/evidence/founder-exit-replica-drill.json`. Passing either file is not production autonomy.
