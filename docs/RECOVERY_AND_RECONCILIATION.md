# Recovery and reconciliation

`recover` in `src/lib/founder-exit/ledger.ts` is the startup and interval pass. It does not call Stripe, send mail, or deploy.

## Pass

1. Skip terminal rows and blocked rows. Blocked work stays listed.
2. Skip a `running` row whose lease has not expired.
3. If the side-effect log already contains the idempotency key, mark that same action `succeeded`, `result_reconciled`, and `verification_status` `verified`. Do not record the side effect again.
4. If the request was submitted, or the state is `awaiting_external_result`, and the side effect is absent, move to `reconciliation_required`. A timeout is not success and not failure. The recovery instruction says not to resubmit.
5. If no request was submitted and the retry budget remains, move to `retryable_failure` with `next_retry_at` from exponential backoff plus jitter. A second pass before that time does not resume the action. That is the scheduler-down case: the row stays visible.
6. When the retry time is due, move the row back to `authorized`. Execution still has to check the side-effect log.
7. When the next retry would exceed the budget, move to `permanent_failure`. Do not retry that row.

## Replacement

`resumeWithAgent` starts an already `authorized` and `permitted` action under a new lease. The new agent must not be revoked and must hold the action capability. Revocation of the original agent does not delete the action. It does stop that agent from acquiring the lease.

## Residual risk

The file snapshot is for the drill. Production payment duplicates are still prevented by `stripe_events`, not by this file. An external provider that has no idempotency key can still be double-submitted if a worker records `request_submitted` after the provider accepted the call and then crashes before that flag is stored. Those rows must stay `reconciliation_required` until a provider read confirms the outcome. This change does not add that live provider read. Stripe livemode reads are blocked on HTTP 401.

Database backups were not restored here. Do not treat this document as a passed disaster-recovery test.
