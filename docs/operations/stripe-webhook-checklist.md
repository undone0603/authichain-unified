# Stripe Webhook Implementation Checklist

## Files Created

- [x] `src/app/api/webhooks/stripe/route.ts` — Main webhook handler (400+ lines)
- [x] `supabase/migrations/00003_stripe_payment_tracking.sql` — Database schema
- [x] `stripe-webhook-setup.md` — Comprehensive setup guide
- [x] This checklist

## Quick Setup (5 Steps)

### 1. Apply Supabase Migration

```bash
cd supabase
supabase migration up          # Local test
supabase db push              # Push to production
```

**Verify:**

```bash
supabase db list-tables
```

Should show: `payments`, `subscriptions`, `alerts`, `audit_log`, `stripe_events`

### 2. Deploy Webhook Handler

```bash
# Build and test locally
pnpm build
pnpm preview

# Deploy to Vercel
git add src/app/api/webhooks/stripe/route.ts supabase/migrations/00003_stripe_payment_tracking.sql
git commit -m "Add Stripe webhook handlers for payment tracking"
git push origin main
```

**Verify in Vercel:**

- Deployment is green
- New endpoint appears in logs

### 3. Get Webhook Secret from Stripe

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint** (if new) or edit existing
3. URL: `https://authichain.com/api/stripe/webhook` (not the retired `/api/webhooks/stripe`)
4. Events:
   - `checkout.session.completed` (required for DPP fulfill)
   - `checkout.session.async_payment_succeeded` (Klarna / delayed wallets)
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Click **Create** or **Save**
6. **Reveal signing secret** → Copy (starts with `whsec_`)

### 4. Set Environment Variable in Vercel

1. [Vercel Dashboard → Settings → Environment Variables](https://vercel.com/dashboard/settings/environment-variables)
2. Add:
   - **Name:** `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`
   - **Value:** (paste the secret from Step 3)
   - **Environments:** Production, Preview, Development
3. Click **Save**

### 5. Redeploy to Pick Up Environment Variable

1. Go to Vercel → Deployments
2. Click the latest deployment
3. Click **Redeploy**
4. Wait for deployment to succeed

## Verification Tests

### Test 1: Webhook Signature Validation

Make a POST request to the endpoint with an invalid signature:

```bash
curl -X POST https://authichain.com/api/stripe/webhook \
  -H "stripe-signature: invalid" \
  -d '{"id":"evt_test"}'

# Should return 400 "Webhook Error: No matching signature found"
```

### Test 2: Stripe CLI Local Testing

```bash
# Terminal 1: Start webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook \
  --events checkout.session.completed,invoice.payment_succeeded,invoice.payment_failed,customer.subscription.deleted

# Copy the signing secret (whsec_test_...) to .env.local

# Terminal 2: Start dev server
pnpm dev

# Terminal 3: Trigger test events
stripe trigger checkout.session.completed

# Check logs in Terminal 2 for "[stripe-webhook] checkout.session.completed: cs_test_..."
```

### Test 3: Database Inserts

After a successful test, verify the data was written:

```sql
-- Check payment was recorded
SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;

-- Check lead was tagged
SELECT email, status FROM lead_captures WHERE status = 'customer' ORDER BY updated_at DESC LIMIT 1;

-- Check stripe event dedup
SELECT * FROM stripe_events ORDER BY processed_at DESC LIMIT 1;

-- Check audit log
SELECT * FROM audit_log WHERE event_type LIKE 'stripe_webhook.%' ORDER BY created_at DESC LIMIT 1;
```

### Test 4: Production Webhook Test (After Deployment)

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click your endpoint
3. Scroll to **Recent events**
4. Find the most recent event (should show green ✓ status)
5. Click it to see the request and response

**Expected Response:**

```json
{
  "received": true,
  "type": "checkout.session.completed"
}
```

### Test 5: Real Payment Flow

1. Complete a real or test payment on the site
2. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
3. Check the **Recent events** section
4. Should see `checkout.session.completed` event with green ✓
5. Verify in Supabase:
   ```sql
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;
   ```

## DPP fulfill on the apex Worker (2026-09-20)

Canonical path: Stripe Dashboard → `POST https://authichain.com/api/stripe/webhook` → `worker-app` → `handleStripeWebhook` → `fulfillDppPaidSession`.

- Access grant writes `funnel_events.metadata.loop_stage=payment_succeeded` then `provisioned` (Supabase). It does **not** need `DATABASE_URL` / Drizzle.
- `authichain-edge-router` hydrates Stripe + Supabase secret **names** only. A missing `DATABASE_URL` must not 400 a paid DPP session (that was the `smoke_check_1789786486` miss).
- Do **not** revive `workers/stripe-webhook` or `workers/dpp-fulfillment` for this path.
- `isDppOffer` matches `metadata.offer=dpp_readiness_2026`, `metadata.plan=dpp_readiness`, or catalog `price_1TwmD8GqTruSqV8TpAF8dfyA` (webhook payloads omit `line_items` unless expanded; checkout now also stamps `metadata.stripe_price_id`).

### Owner: Resend the missed smoke (`we_1UGTCS…`)

Live endpoint: `we_1UGTCS…` → `https://authichain.com/api/stripe/webhook` (enabled; events include `checkout.session.completed`).

`smoke_check_1789786486` (`cs_live_a1y4TuVXsdPVbXgPejLnXYpSWD5RvpmO273RUC3BxOHnAZ5JwlARbBMxQS`) is **not** skipped by `isDppOffer` — metadata has `offer` + `plan`. Funnel only has `checkout_started` because `checkout.session.completed` never successfully ran fulfill. Live `stripe_events` was empty even for prior successes (edge never wrote it). `$0` / `DPP-SMOKE-E2E` / `is_demo` are **not** fulfill filters — `payment_status=paid` is the only payment gate. `is_demo=true` only skips Resend email noise.

1. Stripe Dashboard → Developers → Webhooks → `we_1UGTCS…` (authichain-com DPP + billing).
2. Open the `checkout.session.completed` delivery for session `cs_live_a1y4Tu…`. Expect historical **non-2xx** (handler threw on missing `DATABASE_URL` before fulfill).
3. After this Worker deploys: **Resend** that event. Expect 2xx. Replay is safe — fulfill is idempotent on session id.
4. Confirm Supabase:
   ```sql
   -- delivery visible even if fulfill later throws
   SELECT event_id, event_type, session_id, status, http_status, error, processed_at
   FROM stripe_events
   WHERE session_id LIKE 'cs_live_a1y4Tu%'
   ORDER BY processed_at DESC;

   -- access grant
   SELECT event_type, prospect_id, metadata
   FROM funnel_events
   WHERE prospect_id = 'smoke_check_1789786486'
     AND event_type IN ('dpp_loop:payment_succeeded', 'dpp_loop:provisioned');
   ```
   If `session_id` / `status` columns are missing, the handler still wrote `event_id` + `event_type` + `processed_at` (migration `20260920000001` is optional).

Or start a new smoke: `GET https://authichain.com/api/checkout/dpp?visit_id=dpp_smoke_<unix>&promo=DPP-SMOKE-E2E`.

Optional: add `checkout.session.async_payment_succeeded` on `we_1UGTCS…` (Klarna / delayed wallets; not required for $0 card/promo).

### stripe_events is observability, not a fulfill lock

Every verified POST to the apex handler upserts `public.stripe_events` with event id, type, checkout session id (when present), HTTP outcome (`received` → `success` | `error` | `duplicate`), and the last error. A prior `received` / `error` / Drizzle `alreadyProcessed` row must **not** skip DPP `checkout.session.completed` — Resend has to be able to fulfill. `fulfillDppPaidSession` remains idempotent via `recordDppLoopEventOnce(session.id)` + profile upsert.

```sql
SELECT event_id, event_type, session_id, status, http_status, error, processed_at
FROM stripe_events
ORDER BY processed_at DESC
LIMIT 20;
```

## Troubleshooting Checklist

### Problem: Webhook returns 400 "Webhook Error"

- [ ] Check Stripe Dashboard → Webhooks → Event details for error message
- [ ] Verify `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` is set in Vercel
- [ ] Verify it matches the signing secret in Stripe Dashboard
- [ ] Redeploy after adding env var

### Problem: Webhook returns 500 "Internal Server Error"

- [ ] Check Vercel Logs for stack trace
- [ ] Verify `STRIPE_SECRET_KEY` is still set
- [ ] Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- [ ] Verify database tables exist: `supabase db list-tables`
- [ ] Check if leads table has `status` column: `supabase db execute "SELECT status FROM lead_captures LIMIT 1"`

### Problem: Payments table is empty but Stripe shows successful payment

- [ ] Check Stripe Dashboard → Webhooks → **Event deliveries**
- [ ] Look for red ✗ status (failed delivery)
- [ ] Click the event to see error response
- [ ] If 500 error, check Vercel Logs
- [ ] If 400 error, check that webhook secret is correct

### Problem: Duplicate payments in database

- [ ] This is expected! Stripe retries webhooks
- [ ] Check `stripe_events` table to confirm dedup is working
- [ ] If you see **duplicate rows**, run the cleanup query in the guide

### Problem: Leads not tagged as customers

- [ ] Check if lead exists with payment's customer_email
- [ ] Check `audit_log` for errors during the update
- [ ] Verify `lead_captures` table has `status` column
- [ ] Manually update if needed:
  ```sql
  UPDATE lead_captures SET status = 'customer' WHERE email = 'customer@example.com';
  ```

## Monitoring

### Daily Revenue Check

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as transactions,
  SUM(amount_cents) / 100.0 as revenue_usd
FROM payments
WHERE status = 'paid'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
```

### Active Subscriptions

```sql
SELECT COUNT(*) as active_subscriptions FROM subscriptions WHERE status = 'active';
```

### Failed Payments Alerting

```sql
SELECT * FROM critical_alerts ORDER BY created_at DESC LIMIT 10;
```

### Recent Webhook Activity

```sql
SELECT
  DATE(created_at),
  event_type,
  COUNT(*) as count,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
  SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) as duplicates
FROM audit_log
WHERE event_type LIKE 'stripe_webhook.%'
GROUP BY DATE(created_at), event_type
ORDER BY DATE(created_at) DESC;
```

## Integration Points

### Lead Nurturing

When a lead becomes a customer:

```sql
-- Find all customers who need follow-up
SELECT email, created_at FROM lead_captures WHERE status = 'customer' AND updated_at > NOW() - INTERVAL '24 hours';
```

Use this in your HubSpot/Make.com automation to trigger win/upsell sequences.

### Dunning & Revenue Retention

When a payment fails:

```sql
-- Find subscriptions with failed payments
SELECT customer_email, subscription_id FROM subscriptions WHERE status = 'payment_failed';
```

Your dunning flow (`src/lib/dunning.ts`) can retry these automatically.

### Analytics & Reporting

```sql
-- Customer Acquisition Cost (CAC) proxy
SELECT COUNT(DISTINCT customer_email) as acquired_customers, SUM(amount_cents) / 100.0 / COUNT(DISTINCT customer_email) as cost_per_customer
FROM payments
WHERE DATE(created_at) >= DATE_TRUNC('month', NOW());
```

## Next Steps

1. ✅ Complete the 5-step setup above
2. ✅ Run all 5 verification tests
3. ✅ Troubleshoot any issues (use the checklist)
4. ✅ Set up monitoring (daily revenue, alerts)
5. ✅ Document in your team wiki/Notion
6. ✅ Test end-to-end with a real payment (or sandbox mode)
7. ✅ Add automated alerts (e.g., Slack notification for critical alerts)

## Documentation

- **Setup Guide:** `stripe-webhook-setup.md` (comprehensive, with FAQs)
- **Code:** `src/app/api/webhooks/stripe/route.ts` (well-commented)
- **Schema:** `supabase/migrations/00003_stripe_payment_tracking.sql` (with inline docs)

## Support

For questions, check:

1. `stripe-webhook-setup.md` → Troubleshooting section
2. `src/app/api/webhooks/stripe/route.ts` → Inline comments
3. Stripe API docs: https://docs.stripe.com/webhooks
4. Supabase docs: https://supabase.com/docs
