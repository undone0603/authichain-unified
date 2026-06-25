# Stripe Webhook Integration Guide

## Overview

This guide covers the complete setup of Stripe webhook handlers for AuthiChain to track customer payments and reconcile subscriptions. The webhook receiver validates Stripe signatures, handles four key events, deduplicates retries, and logs everything to audit_log.

## Architecture

### Webhook Endpoint

**URL:** `https://app.authichain.com/api/webhooks/stripe`  
**Method:** POST  
**Secret:** `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` (environment variable)

### Event Handlers

| Event | Handler | Action |
|-------|---------|--------|
| `checkout.session.completed` | `handleCheckoutSessionCompleted` | Record payment in `payments` table; tag lead as `status='customer'` in `lead_captures` |
| `invoice.payment_succeeded` | `handleInvoicePaymentSucceeded` | Update `subscriptions` table with `status='active'` and next billing date |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Update `subscriptions` table with `status='payment_failed'`; create alert for sales team |
| `customer.subscription.deleted` | `handleCustomerSubscriptionDeleted` | Update `subscriptions` table with `status='canceled'` and timestamp |

### Idempotency

All events are deduplicated via the `stripe_events` table, which stores `event_id` and `processed_at`. Stripe retries failed webhooks with exponential backoff—this guard ensures side effects run **at most once per event**.

## Database Schema

### payments Table

Record of individual payments from Stripe checkout sessions.

```sql
CREATE TABLE public.payments (
  session_id         TEXT        PRIMARY KEY,
  customer_email     TEXT        NOT NULL,
  amount_cents       INTEGER     NOT NULL,
  currency           TEXT        NOT NULL DEFAULT 'usd',
  status             TEXT        NOT NULL DEFAULT 'paid',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `session_id` (primary key)
- `customer_email` (fast lead matching)
- `created_at DESC` (reporting)

**Indexed Columns:**
- `session_id`: Stripe checkout session ID
- `customer_email`: Email from `checkout.session.customer_email`
- `amount_cents`: Amount in cents (e.g., $19.99 = 1999)
- `currency`: ISO 4217 code (default `usd`)
- `status`: `pending`, `paid`, `failed`, `refunded`

### subscriptions Table

Subscription lifecycle tracking for recurring charges.

```sql
CREATE TABLE public.subscriptions (
  subscription_id    TEXT        PRIMARY KEY,
  customer_email     TEXT        NOT NULL,
  product_id         TEXT,
  status             TEXT        NOT NULL DEFAULT 'active',
  next_billing_date  TIMESTAMPTZ,
  canceled_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `subscription_id` (primary key)
- `customer_email` (fast customer lookups)
- `status` (filtering by state)

**Indexed Columns:**
- `subscription_id`: Stripe subscription ID
- `customer_email`: Billing email
- `product_id`: Optional; links to your products table (nullable)
- `status`: `active`, `payment_failed`, `canceled`
- `next_billing_date`: Calculated from Stripe invoice `period_end`
- `canceled_at`: Timestamp when subscription was canceled (NULL if active)

### alerts Table

Alert the sales team to payment failures and other critical events.

```sql
CREATE TABLE public.alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT        NOT NULL,
  message           TEXT        NOT NULL,
  customer_email    TEXT,
  metadata          JSONB,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `id` (primary key)
- `type` (filter by alert category)
- `customer_email` (find alerts for a customer)
- `created_at DESC` (recent alerts first)
- `resolved_at` (show unresolved alerts)

**Alert Types:**
- `payment_failed`: Invoice payment failed
- `subscription_issue`: Subscription lifecycle issue
- `refund`: Refund processed
- `chargeback`: Chargeback initiated

**Metadata (JSONB):**
```json
{
  "invoice_id": "in_1234567890",
  "subscription_id": "sub_1234567890",
  "customer_id": "cus_1234567890"
}
```

### audit_log Table

Log all Stripe webhook events for compliance, debugging, and idempotency checks.

```sql
CREATE TABLE public.audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        TEXT        NOT NULL,
  event_id          TEXT,
  status            TEXT        NOT NULL,
  payload           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `id` (primary key)
- `event_type` (filter by event category)
- `event_id` (Stripe event ID reference)
- `created_at DESC` (recent events first)

**Status Values:**
- `success`: Event processed successfully
- `error`: Event processing failed
- `duplicate`: Event was a retry (already seen)

### stripe_events Table

Idempotency guard—prevent duplicate processing of Stripe webhook retries.

```sql
CREATE TABLE public.stripe_events (
  event_id          TEXT        PRIMARY KEY,
  event_type        TEXT        NOT NULL,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Purpose:** When a webhook is received, we check if `event_id` exists in this table. If it does, we skip processing and return `{duplicate: true}`. If not, we process and insert the event.

### lead_captures (Modification)

The migration adds a `status` column to track lead progression:

```sql
ALTER TABLE public.lead_captures
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'prospect'
                            CHECK (status IN ('prospect', 'engaged', 'customer', 'inactive'));
```

**Status Values:**
- `prospect`: New lead, not yet engaged
- `engaged`: Lead opened email, clicked link, etc.
- `customer`: Lead made a payment (set by `checkout.session.completed`)
- `inactive`: Lead unsubscribed or marked inactive

## Environment Variables

### Required in Production

Add these to your Vercel environment variables:

```bash
# Stripe API Key (existing)
STRIPE_SECRET_KEY=sk_live_... # or sk_test_... for dev

# NEW: Webhook signing secret
STRIPE_WEBHOOK_AUTHICHAIN_SECRET=whsec_live_... # or whsec_test_... for dev
```

### How to Find These Values

1. **STRIPE_SECRET_KEY**: Already configured. Verify in Vercel dashboard.

2. **STRIPE_WEBHOOK_AUTHICHAIN_SECRET**:
   - Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
   - Find the endpoint for `https://app.authichain.com/api/webhooks/stripe`
   - Click **Reveal signing secret**
   - Copy the secret starting with `whsec_`

## Deployment Steps

### Step 1: Apply Supabase Migration

Run the migration to create all required tables:

```bash
# From repo root
cd supabase

# Apply migration locally first
supabase migration up

# Then push to production
supabase db push
```

**Verify tables were created:**
```bash
supabase db list-tables
```

You should see:
- `payments`
- `subscriptions`
- `alerts`
- `audit_log`
- `stripe_events`

### Step 2: Deploy Webhook Handler

The webhook handler is at `src/app/api/webhooks/stripe/route.ts`.

```bash
# From repo root
pnpm build

# Verify the build includes the new route
pnpm preview  # or deploy to Vercel

# Then push to Vercel
git add src/app/api/webhooks/stripe/route.ts
git commit -m "Add Stripe webhook handler for payment tracking"
git push origin main
```

Vercel will automatically deploy the new endpoint.

### Step 3: Register Webhook in Stripe Dashboard

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter endpoint URL: `https://app.authichain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Click **Create endpoint**
6. A signing secret will be generated. Copy it.

### Step 4: Add Signing Secret to Vercel

1. Go to [Vercel Dashboard → Settings → Environment Variables](https://vercel.com/dashboard/settings/environment-variables)
2. Add new variable:
   - Name: `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`
   - Value: (paste the signing secret from Step 3)
   - Environments: Production, Preview, Development
3. Click **Save**
4. **Redeploy** the site for the variable to take effect:
   - Go to Deployments
   - Click the latest deployment
   - Click **Redeploy**

## Testing Locally with Stripe CLI

Use the Stripe CLI to test webhooks without deploying:

```bash
# Install Stripe CLI (if not already installed)
# macOS: brew install stripe/stripe-cli/stripe
# Linux: wget -O stripe_linux_x86_64.zip https://github.com/stripe/stripe-cli/releases/download/v1.18.0/stripe_linux_x86_64.zip
# Then unzip and move to PATH

# Authenticate with your Stripe account
stripe login

# Start local webhook forwarding (runs in background)
stripe listen --forward-to localhost:3000/api/webhooks/stripe --events checkout.session.completed,invoice.payment_succeeded,invoice.payment_failed,customer.subscription.deleted

# Copy the signing secret from the output (e.g., whsec_test_...)
# Add it to your .env.local:
echo "STRIPE_WEBHOOK_AUTHICHAIN_SECRET=whsec_test_..." >> .env.local

# In another terminal, start your dev server
pnpm dev

# Trigger a test event from Stripe CLI:
stripe trigger checkout.session.completed

# Watch the local logs to see the webhook being processed
```

## Troubleshooting

### Webhook Events Not Processing

**Symptom:** Payments are made in Stripe, but `payments` table is empty.

**Diagnosis:**
1. Check Stripe Dashboard → Webhooks → click endpoint → view **Event deliveries**
2. Look for failed deliveries (red ✗)
3. Click an event to see the error response

**Common Causes:**
- `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` is not set in Vercel environment
- Webhook URL is incorrect (should be `https://app.authichain.com/api/webhooks/stripe`)
- Your app is down or returning 5xx errors

**Fix:**
```bash
# 1. Verify env var is set
vercel env ls

# 2. Check logs
vercel logs

# 3. Redeploy
vercel deploy --prod
```

### Duplicate Events

**Symptom:** The same payment appears multiple times in `payments` table.

**Diagnosis:**
- Check `stripe_events` table for the event ID
- Check `audit_log` for status = `duplicate`

**Fix:**
This is **expected behavior**—Stripe retries webhooks. The idempotency guard prevents duplicate side effects.

If you see duplicate **rows** in `payments` (not just retries), it means the event dedup failed. Delete duplicates:

```sql
-- Find duplicates
SELECT session_id, COUNT(*) FROM payments GROUP BY session_id HAVING COUNT(*) > 1;

-- Delete duplicates, keeping the first
DELETE FROM payments p1
WHERE id NOT IN (
  SELECT MIN(id) FROM payments p2
  WHERE p1.session_id = p2.session_id
  GROUP BY session_id
);
```

### Leads Not Tagged as Customers

**Symptom:** Payment is recorded, but `lead_captures.status` is still `prospect`.

**Diagnosis:**
1. Check if a lead exists with the payment's `customer_email`
2. Check `audit_log` for errors during the update

**Fix:**
```sql
-- Check if lead exists
SELECT * FROM lead_captures WHERE email = 'customer@example.com';

-- If lead doesn't exist, create it
INSERT INTO lead_captures (email, status) VALUES ('customer@example.com', 'customer');

-- If lead exists but status wasn't updated, manually update it
UPDATE lead_captures SET status = 'customer' WHERE email = 'customer@example.com';
```

### Payment Failure Alerts Not Appearing

**Symptom:** An invoice fails to pay, but no alert is created in `alerts` table.

**Diagnosis:**
1. Check `audit_log` for the `invoice.payment_failed` event
2. Verify the customer exists in Stripe

**Fix:**
```sql
-- Manually create an alert
INSERT INTO alerts (type, message, customer_email, metadata) VALUES (
  'payment_failed',
  'Manual alert: Payment failed for subscription sub_1234567890',
  'customer@example.com',
  '{"invoice_id": "in_1234567890", "subscription_id": "sub_1234567890"}'::jsonb
);
```

## Monitoring & Reporting

### View Today's Revenue

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as transactions,
  SUM(amount_cents) / 100.0 as total_usd,
  AVG(amount_cents) / 100.0 as avg_transaction
FROM payments
WHERE status = 'paid' AND DATE(created_at) = CURRENT_DATE
GROUP BY DATE(created_at);
```

### List Active Subscriptions

```sql
SELECT
  subscription_id,
  customer_email,
  status,
  next_billing_date,
  created_at
FROM subscriptions
WHERE status = 'active'
ORDER BY created_at DESC;
```

### Unresolved Alerts for Sales Team

```sql
SELECT
  id,
  type,
  message,
  customer_email,
  created_at,
  AGE(NOW(), created_at) as age
FROM alerts
WHERE resolved_at IS NULL
ORDER BY created_at DESC;
```

### Customer Revenue History

```sql
SELECT
  customer_email,
  COUNT(*) as transaction_count,
  SUM(amount_cents) / 100.0 as total_revenue,
  MAX(created_at) as last_payment
FROM payments
WHERE status = 'paid'
GROUP BY customer_email
ORDER BY total_revenue DESC;
```

### Resolve an Alert

```sql
UPDATE alerts SET resolved_at = NOW() WHERE id = 'uuid-here';
```

## Security Considerations

### Webhook Signature Validation

The handler validates the `stripe-signature` header using `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`. This prevents spoofed webhooks from a third party.

```typescript
// From route.ts
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
// If signature is invalid, throws; we catch and return 400
```

### Row-Level Security (RLS)

All tables have RLS enabled and allow **only the service role** (used by the webhook handler) to write. No authenticated users can directly insert/update payments:

```sql
CREATE POLICY "Service role manages payments" ON public.payments
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### Audit Logging

Every webhook event is logged to `audit_log`, including failures. This provides a complete audit trail for compliance:

```sql
SELECT * FROM audit_log WHERE event_type LIKE 'stripe_webhook.%' ORDER BY created_at DESC;
```

## Webhook Event Payload Reference

### checkout.session.completed

```json
{
  "id": "evt_1234567890",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_live_123...",
      "customer_email": "customer@example.com",
      "amount_total": 1999,
      "currency": "usd",
      "subscription": "sub_1234567890",
      "metadata": {
        "plan": "pro",
        "user_id": "uuid-here",
        "affiliate_code": "aff_123"
      }
    }
  }
}
```

### invoice.payment_succeeded

```json
{
  "id": "evt_1234567890",
  "type": "invoice.payment_succeeded",
  "data": {
    "object": {
      "id": "in_1234567890",
      "customer": "cus_1234567890",
      "subscription": "sub_1234567890",
      "amount_paid": 1999,
      "currency": "usd",
      "period_end": 1687891200,
      "billing_reason": "subscription_cycle"
    }
  }
}
```

### invoice.payment_failed

```json
{
  "id": "evt_1234567890",
  "type": "invoice.payment_failed",
  "data": {
    "object": {
      "id": "in_1234567890",
      "customer": "cus_1234567890",
      "subscription": "sub_1234567890",
      "attempt_count": 1
    }
  }
}
```

### customer.subscription.deleted

```json
{
  "id": "evt_1234567890",
  "type": "customer.subscription.deleted",
  "data": {
    "object": {
      "id": "sub_1234567890",
      "customer": "cus_1234567890",
      "canceled_at": 1687891200,
      "cancellation_details": {
        "reason": "cancellation_requested"
      }
    }
  }
}
```

## Integration with Existing Flows

### Lead Nurturing Pipeline

When `checkout.session.completed` is received:
1. Payment is recorded in `payments` table
2. Lead is tagged `status = 'customer'` in `lead_captures`
3. Your automation (HubSpot, Make.com, email) can now filter for `status = 'customer'` to trigger nurture campaigns

### Dunning / Revenue Retention

When `invoice.payment_failed` is received:
1. Subscription is marked `status = 'payment_failed'`
2. An alert is created in `alerts` table for the sales team
3. Your dunning flow (see `src/lib/dunning.ts`) can query `subscriptions.status = 'payment_failed'` to retry or reach out

### Billing Dashboard

The views provided in the migration can power your billing dashboard:

```sql
-- Query payment_summary_daily view
SELECT * FROM public.payment_summary_daily ORDER BY payment_date DESC LIMIT 7;

-- Query subscription_status_summary view
SELECT * FROM public.subscription_status_summary;

-- Query critical_alerts view
SELECT * FROM public.critical_alerts;
```

## FAQ

**Q: What happens if the webhook endpoint is down?**  
A: Stripe retries with exponential backoff (up to 5 days). Your idempotency guard will deduplicate when the endpoint is back up.

**Q: Can I test this in development?**  
A: Yes! Use `stripe listen` + `stripe trigger` (see Testing Locally section).

**Q: Does the webhook need to be on the internet?**  
A: Yes, Stripe must be able to reach it. Use `stripe listen --forward-to` to test locally.

**Q: What if a customer pays with multiple cards?**  
A: Each checkout session has its own `session_id`, so multiple payments appear as separate rows in `payments`.

**Q: Do you support refunds?**  
A: Partially. The schema includes a `status = 'refunded'` option, but the webhook handler doesn't process `charge.refunded` events yet. Add this if needed.

**Q: How do I handle failed payments?**  
A: Alerts are created. Integrate with your dunning flow to retry after 3-7 days.

**Q: Can I see which affiliate referred a payment?**  
A: Yes, check the `checkout.session.completed` metadata for `affiliate_code`, then match to your affiliates table. (This is already implemented in the existing webhook.)
