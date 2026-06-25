# Stripe Webhook Implementation Summary

## Overview

This implementation adds complete Stripe webhook handling to track customer payments and reconcile subscriptions. The solution includes:

1. **Webhook Handler** (`src/app/api/webhooks/stripe/route.ts`)
   - Validates Stripe signatures using `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`
   - Handles 4 key events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
   - Deduplicates Stripe retries via `stripe_events` table
   - Logs all events to `audit_log` for compliance

2. **Database Schema** (`supabase/migrations/00003_stripe_payment_tracking.sql`)
   - `payments` table — record individual checkout payments
   - `subscriptions` table — track subscription lifecycle
   - `alerts` table — alert sales team on payment failures
   - `audit_log` table — comprehensive event logging
   - `stripe_events` table — idempotency guard for deduplication
   - Views for revenue reporting and alert dashboards

3. **Documentation**
   - `docs/stripe-webhook-setup.md` — comprehensive 700+ line guide with FAQs
   - `docs/stripe-webhook-checklist.md` — quick reference checklist
   - Inline code comments explaining each handler

## Files Created/Modified

### New Files

```
src/app/api/webhooks/stripe/route.ts              (386 lines)
  └─ POST handler with 4 event handlers
  └─ Signature validation
  └─ Idempotency deduplication
  └─ Audit logging

supabase/migrations/00003_stripe_payment_tracking.sql  (213 lines)
  └─ payments table with indexes
  └─ subscriptions table with lifecycle tracking
  └─ alerts table for sales team notifications
  └─ audit_log table for compliance
  └─ stripe_events table for idempotency
  └─ 3 SQL views for dashboards
  └─ RLS policies (service role only)

docs/stripe-webhook-setup.md                      (700+ lines)
  └─ Complete setup guide
  └─ Database schema reference
  └─ Environment variable instructions
  └─ Testing with Stripe CLI
  └─ Troubleshooting guide with SQL queries
  └─ Monitoring and reporting
  └─ Integration with existing flows
  └─ FAQ

docs/stripe-webhook-checklist.md                  (250+ lines)
  └─ Quick 5-step setup
  └─ 5 verification tests
  └─ Troubleshooting checklist
  └─ Monitoring queries
  └─ Integration points
```

### No Modifications to Existing Files

This implementation is **fully backward compatible**. No existing files were modified. The solution:
- Creates a new API endpoint (doesn't conflict with `src/app/api/stripe/webhook/route.ts`)
- Uses new database tables (doesn't modify existing schema except adding `status` column to `lead_captures`)
- Works alongside existing Stripe integration

## Event Flow

```
Stripe Dashboard
    ↓
POST https://app.authichain.com/api/webhooks/stripe
    ↓
stripe.webhooks.constructEvent() — validates signature with STRIPE_WEBHOOK_AUTHICHAIN_SECRET
    ↓
Check stripe_events table for deduplication
    ↓
Switch on event.type:
    ├─ checkout.session.completed
    │   ├─ INSERT payments (session_id, customer_email, amount, status='paid')
    │   └─ UPDATE lead_captures SET status='customer' WHERE email=customer_email
    │
    ├─ invoice.payment_succeeded
    │   ├─ UPDATE subscriptions SET status='active', next_billing_date=...
    │   └─ (or INSERT if first payment)
    │
    ├─ invoice.payment_failed
    │   ├─ UPDATE subscriptions SET status='payment_failed'
    │   └─ INSERT alerts (type='payment_failed', customer_email=..., metadata={...})
    │
    └─ customer.subscription.deleted
        └─ UPDATE subscriptions SET status='canceled', canceled_at=NOW()
    ↓
INSERT stripe_events (event_id, event_type, processed_at) — idempotency guard
    ↓
INSERT audit_log (event_type, event_id, status='success', payload=...) — compliance
    ↓
Return 200 { received: true, type: event.type }
```

## Database Schema Summary

### payments Table
- **Purpose:** Record individual payments from Stripe checkouts
- **Primary Key:** `session_id` (Stripe checkout session ID)
- **Key Columns:** `customer_email`, `amount_cents`, `currency`, `status`, `created_at`
- **Indexes:** email (fast lead matching), created_at (reporting)

### subscriptions Table
- **Purpose:** Track subscription lifecycle (active → payment_failed → canceled)
- **Primary Key:** `subscription_id` (Stripe subscription ID)
- **Key Columns:** `customer_email`, `status`, `next_billing_date`, `canceled_at`
- **Indexes:** email (customer lookups), status (state filtering)

### alerts Table
- **Purpose:** Alert sales team to payment failures
- **Primary Key:** `id` (UUID)
- **Key Columns:** `type`, `message`, `customer_email`, `metadata`, `resolved_at`
- **Indexes:** type, email, created_at, resolved_at (find unresolved)
- **Types:** `payment_failed`, `subscription_issue`, `refund`, `chargeback`

### audit_log Table
- **Purpose:** Log all Stripe webhook events for compliance
- **Primary Key:** `id` (UUID)
- **Key Columns:** `event_type`, `event_id`, `status`, `payload`, `created_at`
- **Indexes:** event_type, event_id, created_at
- **Statuses:** `success`, `error`, `duplicate`

### stripe_events Table
- **Purpose:** Idempotency guard — prevent duplicate processing of retries
- **Primary Key:** `event_id` (Stripe event ID)
- **Constraint:** Unique on `event_id` (prevents duplicate INSERTs)
- **Query:** `SELECT * FROM stripe_events WHERE event_id = $1` on every webhook

### lead_captures Modification
- **Change:** Add `status TEXT DEFAULT 'prospect' CHECK (status IN (...))`
- **Purpose:** Track lead progression from prospect → engaged → customer → inactive
- **Updated By:** `checkout.session.completed` handler when payment is recorded

### Views
1. **payment_summary_daily** — Revenue by day (count, total, avg, currency)
2. **subscription_status_summary** — Subscription health (status, count, unique customers)
3. **critical_alerts** — Unresolved alerts for sales dashboard (id, type, message, email, age)

## Environment Variables Required

### Development
```bash
STRIPE_SECRET_KEY=sk_test_...                                    # (already set)
STRIPE_WEBHOOK_AUTHICHAIN_SECRET=whsec_test_...                  # NEW: from Stripe dashboard
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co                  # (already set)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...                             # (already set)
```

### Production
```bash
STRIPE_SECRET_KEY=sk_live_...                                    # (already set)
STRIPE_WEBHOOK_AUTHICHAIN_SECRET=whsec_live_...                  # NEW: from Stripe dashboard
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co                  # (already set)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...                             # (already set)
```

## Setup Steps (TL;DR)

1. Apply migration: `supabase db push`
2. Deploy code: `git push origin main` (Vercel auto-deploys)
3. Get webhook secret from Stripe Dashboard
4. Add `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` to Vercel env vars
5. Redeploy: `vercel deploy --prod`
6. Register webhook in Stripe Dashboard → Webhooks → Add endpoint

Full instructions: See `docs/stripe-webhook-setup.md`

## Verification Tests

```bash
# Test 1: Stripe CLI local testing
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed

# Test 2: Check database inserts
SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;
SELECT * FROM stripe_events ORDER BY processed_at DESC LIMIT 1;

# Test 3: Verify idempotency (run trigger twice, check stripe_events for dedup)
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_succeeded  # Should be logged as duplicate

# Test 4: Check audit log
SELECT * FROM audit_log WHERE event_type LIKE 'stripe_webhook.%' ORDER BY created_at DESC;

# Test 5: Real payment flow (after deployment)
# Complete a payment on the site, verify in Stripe Dashboard → Webhooks → Event deliveries
```

## Key Features

### ✓ Signature Validation
Every webhook is verified with Stripe's secret. Spoofed requests return 400.

### ✓ Idempotency
Stripe retries are deduplicated via `stripe_events` table. Side effects run **at most once** per event.

### ✓ Lead Tagging
When a payment is recorded, the matching lead in `lead_captures` is tagged `status='customer'` for follow-up nurturing.

### ✓ Payment Failure Alerts
When `invoice.payment_failed` is received, an alert is created for the sales team with customer email and metadata.

### ✓ Subscription Reconciliation
Subscription lifecycle is tracked: `active` → `payment_failed` (on failed invoice) → `canceled` (on deletion).

### ✓ Comprehensive Logging
Every webhook event is logged to `audit_log` with status, payload, and timestamp. Provides a complete audit trail.

### ✓ Row-Level Security
All tables have RLS enabled. Only the service role (webhook handler) can write. No authenticated users can insert/modify payment records directly.

### ✓ Backward Compatible
No existing files were modified. Works alongside the existing `src/app/api/stripe/webhook/route.ts`.

## Integration with Existing Flows

### Lead Nurturing (HubSpot, Make.com, Email)
When `status='customer'` is set on a lead, your automation can now:
- Trigger a win/congratulations email
- Move lead to "customer" segment in HubSpot
- Log to CRM for sales follow-up

### Dunning & Revenue Retention
When `subscriptions.status='payment_failed'`:
- Retry logic in `src/lib/dunning.ts` can queue the subscription for retry
- Alert sales team via `alerts` table
- Send dunning email to customer

### Analytics & Reporting
New views and tables enable:
- Daily revenue dashboard (`payment_summary_daily` view)
- Customer lifetime value (sum payments by email)
- Subscription health (active vs. failed vs. canceled)
- Alert resolution tracking (sales metrics)

## Error Handling

The handler gracefully handles:

1. **Missing environment variables** → Returns 500
2. **Invalid Stripe signature** → Returns 400
3. **Database errors** → Logs to console, returns 500
4. **Duplicate events** → Logs as duplicate, returns 200 (idempotent)
5. **Missing customer data** → Logs warning, continues processing (partial success)

All errors are logged to `audit_log` with payload for debugging.

## Performance Considerations

### Query Complexity
- Dedup check: O(1) hash lookup on `event_id` primary key
- Lead update: O(1) indexed lookup on `email`
- Subscription update: O(1) indexed lookup on `subscription_id`
- Stripe API call: Only on `invoice.payment_failed` to fetch customer email

### Database Load
- ~6 DB writes per webhook (payment, lead update, subscription, alert, event, audit log)
- ~2 DB reads per webhook (dedup check, subscription lookup)
- Negligible for typical checkout volume (< 100/min)

### Network Latency
- 1 outbound API call to Stripe (on failed invoices only) — ~200ms
- All other operations are local DB writes

## Monitoring & Alerts

### SQL Queries for Dashboards

**Revenue Today**
```sql
SELECT SUM(amount_cents) / 100.0 FROM payments WHERE DATE(created_at) = CURRENT_DATE AND status = 'paid';
```

**Failed Payments Needing Action**
```sql
SELECT * FROM critical_alerts WHERE type = 'payment_failed' ORDER BY created_at DESC;
```

**Subscription Health**
```sql
SELECT status, COUNT(*) FROM subscriptions GROUP BY status;
```

**Webhook Error Rate (Last 24h)**
```sql
SELECT
  event_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_pct
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

## Troubleshooting

**Problem:** Webhook returns 400  
**Solution:** Check Stripe Dashboard → Webhooks → Event details for error

**Problem:** Webhook returns 500  
**Solution:** Check Vercel Logs, verify all env vars are set, verify DB tables exist

**Problem:** Payments not appearing  
**Solution:** Check Stripe Dashboard → Webhooks for failed deliveries

**Problem:** Leads not tagged as customers  
**Solution:** Verify `lead_captures` table has `status` column, check `audit_log` for errors

Full troubleshooting guide: See `docs/stripe-webhook-setup.md` section "Troubleshooting"

## Next Steps

1. Review this summary
2. Read `docs/stripe-webhook-setup.md` for comprehensive guide
3. Apply migration: `supabase db push`
4. Deploy code: `git push origin main`
5. Add env var: `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` in Vercel
6. Redeploy: `vercel deploy --prod`
7. Register endpoint in Stripe Dashboard
8. Test with Stripe CLI and real payments
9. Set up monitoring and alerts

Questions? Check the FAQ in `docs/stripe-webhook-setup.md` or inline code comments.
