# Service-order lifecycle records

Service-order lifecycle stages use the existing `funnel_events` table with a
deterministic `prospect_id` (`service_order:<plan>:<Stripe Checkout Session
id>`) and a stage-specific `event_type`.

The current lookup-before-insert implementation suppresses serial retry
deliveries only. It is **not** database-concurrency-safe because
`funnel_events` has no unique constraint on `(prospect_id, event_type)`.
The database owner must approve and apply a migration adding that constraint;
only then can the handler use an atomic `INSERT ... ON CONFLICT DO NOTHING`
idempotency primitive.
