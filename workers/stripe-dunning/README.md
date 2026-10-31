# Stripe invoice dunning

This worker retries existing invoices. It creates no products, subscriptions,
checkout sessions, emails, notifications, or entitlement grants. The registered
fulfillment webhook at `https://authichain.com/api/stripe/webhook` stays in place.

## Collection policy

Five additional collection attempts follow a failed invoice event. Delays before
attempts 1–5 are **60, 300, 900, 3600, and 21600 seconds**, measured from intake
for attempt 1 and the previous definitive decline for each later attempt.
`attempt` starts at zero and advances only after a definitive payment response.
The last decline becomes `failed_final`; transport failures do not consume a
payment attempt or generate a new Stripe idempotency key.

Collection requires all of these conditions, checked against Stripe immediately
before payment:

- `status=open`, `collection_method=charge_automatically`;
- `auto_advance=false` and `next_payment_attempt=null`;
- invoice metadata `authichain_dunning_owner=worker-v1`;
- one identifiable PaymentIntent with a recoverable card decline;
- `DUNNING_ENABLED=true`, a matching Stripe key/mode, and, for live invoices,
  the separate `DUNNING_LIVE_ENABLED=true` switch.

The worker never disables Stripe Smart Retries or changes invoice metadata.
Invoices that Stripe still owns stop with `collection_owned_elsewhere`. An
operator must deliberately opt an invoice into this collection policy. Hard
declines, missing payment methods, and authentication needs stop for customer
action. Processing payments and ambiguous payment histories stop for review.
Only a returned or subsequently retrieved invoice with `status=paid` is recorded
as paid. A terminal webhook can stop outstanding work, including work that is
waiting on a Stripe read. Paid tombstones cannot be reopened by late failures.

## Reliability

`stripe_dunning_events` and `stripe_dunning_state` use dedicated names; they do
not claim IDs in the fulfillment handler's `stripe_events` table. D1 `batch()`
commits webhook receipt and invoice state together. A failed transaction returns
503 so Stripe can deliver again. Duplicate events do not reset the retry budget.

The state row is a durable outbox. Enqueue claims expire, and a one-minute cron
redispatches overdue rows if enqueue failed, the process died, or a message was
lost/dead-lettered. Conditional updates claim a consumer lease. Queue messages
carry their expected logical attempt; stale messages do nothing. Both queue
delivery and cron can therefore repeat without creating new payment attempts.

Each payment uses `dunning-v1:<mode>:<invoice_id>:<attempt>` as its Stripe
idempotency key. The attempt's start time is persisted before the POST. Network
errors, 5xx errors, and a failed D1 write reuse that key. Uncertain operations
stop for review after ten consecutive transport failures or 23 hours, before
Stripe's documented minimum 24-hour idempotency retention expires. They never
advance silently to a fresh charge. Every HTTP request has a 20-second timeout.

The worker uses native `fetch` and asynchronous Web Crypto HMAC verification,
with the raw request body, multiple `v1` signature support, a five-minute
timestamp tolerance, and a 256 KiB body limit. There are no runtime dependencies.
The REST API version is pinned to `2026-08-26.dahlia`, matching the repository's
existing Stripe webhook integration. Logs contain invoice IDs and result codes,
not emails, payment details, webhook bodies, or secret values.

## Validation

From the repository root:

```sh
pnpm --filter stripe-dunning test
pnpm --filter stripe-dunning check
pnpm exec wrangler deploy --dry-run --config workers/stripe-dunning/wrangler.toml
```

The package test script runs through the existing workspace test pipeline.
Tests execute production SQL against Node's SQLite and verify real HMACs using
independently generated Node crypto signatures. Stripe HTTP and queue delivery
are simulated. These are not evidence of a deployed D1/Queues integration or a
Stripe sandbox payment. The migration is additive and tested for repeat use.

## Deployment and first external proof

The checked-in configuration has both collection switches off and no public
route. This worker is intentionally absent from the production auto-deploy
matrix and allowlist. The migration has not been applied remotely. Build and
review the exact commit before adding an explicit deployment path under the
repository's existing production controls.

1. First configure a separate Stripe test-mode account/connection and isolated
   Cloudflare test database and queues. Use a sandbox worker name, test-mode
   secrets, `STRIPE_MODE=test`, `DUNNING_ENABLED=true`, and leave the live switch
   false. Bind secrets through the approved secret channel, never in source or
   logs. Apply `migrations/0001_dunning.sql` only to the sandbox database.
2. Add a sandbox-only endpoint for `/webhook`, selecting
   `invoice.payment_failed`, `invoice.paid`, `invoice.voided`,
   `invoice.marked_uncollectible`, and `invoice.payment_action_required`. Use its
   own signing secret. Do not replace the existing fulfillment endpoint or use
   its signing secret for a different endpoint.
3. Use a real test invoice with a recoverable test card decline, the explicit
   ownership metadata, automatic collection paused, and no competing retry
   schedule. Capture the Stripe failure event ID and invoice ID.
4. Verify its signed delivery returns 200, the event row and state commit
   together, `attempt=0`, and `next_retry_at` is one minute later. Confirm the
   matching `dunning_queued` record, then the queue consumer invocation and its
   persisted `dunning_result`. Queue configuration alone is not delivery proof.
5. Redeliver the same Stripe event and a stale queue message. Verify no second
   logical operation or reset. Test a successful recovery and the full decline
   sequence, and match request keys and paid status against Stripe's records.
6. Only after sandbox evidence and required checks pass, review production
   migration, secret bindings, endpoint addition, invoice ownership, and the
   separate live activation. Existing `humanHold` and outbound send controls
   are unaffected.

Existing production resource names in `wrangler.toml` were read from Cloudflare
on October 31, 2026. The queue and dead-letter queue already exist. No plan was
changed; normal Workers, D1, and Queues usage limits still apply. On the same
date, the Stripe connector exposed only a live account, and no endpoint for
the standalone dunning worker was registered. External sandbox verification is
therefore still pending.

## References

- [Stripe webhook verification](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors)
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe Smart Retries and hard declines](https://docs.stripe.com/billing/revenue-recovery/smart-retries)
- [Stripe invoice payments](https://docs.stripe.com/api/invoices/pay)
- [D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
