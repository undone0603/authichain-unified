# Service-order amount mismatch holds (read-only)

**Scope:** paid one-time service Checkout (`metadata.type=one_time_service`) whose
`amount_total` or `currency` did not match the stored service-order catalog
price. The webhook leaves the order `pending` and records
`paid_service_order_amount_mismatch`. This is **not** a grant, refund, or
replay instruction.

Service Checkout sessions are created with `allow_promotion_codes: false`.
A hold after this change is an unexpected cash/currency mismatch, not a
coupon applied at Checkout.

## Read-only triage

Run as **SELECT only**. Do not publish session IDs, emails, payment
identifiers, or customer names.

```sql
-- Holds from paid service Checkout whose cash did not match list price.
SELECT event_type, status, error, COUNT(*)::int AS events,
       MAX(processed_at) AS latest
FROM public.stripe_events
WHERE status = 'reconciliation_required'
  AND error = 'paid_service_order_amount_mismatch'
GROUP BY event_type, status, error;

-- Pending service orders (counts only; not proof of a mismatch hold).
SELECT status, COUNT(*)::int AS orders
FROM public.service_orders
WHERE status = 'pending'
GROUP BY status;
```

Zero rows in the first query means no mismatch hold is recorded. A pending
order count is not by itself a coupon or underpayment.
