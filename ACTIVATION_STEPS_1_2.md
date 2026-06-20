# Revenue Activation — Steps 1 & 2 (No Vercel Wait Required)

Execute these now. Step 3 (Vercel) can happen later when rate limit resets.

---

## Step 1: Push Database Migrations (5 min)

**Run locally on your machine:**

```bash
cd authichain
supabase db push
```

This applies two critical migrations:
- `00004_create_add_generation_credits_rpc.sql` — Creates the RPC that grants credits to buyers
- `00005_create_stripe_events_table.sql` — Idempotency ledger so webhooks process exactly once

**Verify it worked:**

```bash
# Login to Supabase & run queries:
supabase db push --dry-run   # see what will run
# Then in Supabase dashboard SQL editor:
SELECT proname FROM pg_proc WHERE proname = 'add_generation_credits';
SELECT to_regclass('public.stripe_events');
```

Both should return results (not empty). If you see them, migrations are applied.

**Why this matters:**
Without this, pack purchases ($29/$99/$249) charge the customer but grant **zero credits**. This migration fixes the silent revenue loss.

---

## Step 2: Stripe Dashboard Setup (15 min)

Go to your Stripe Dashboard and execute these checklist items:

### 2a. Register Webhooks (Critical)

Navigate to: **Developers → Webhooks**

Create/update two webhook endpoints:

#### Endpoint 1: Fulfillment Webhook
- **URL:** `https://app.authichain.com/api/webhook`
- **Events to enable:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- **Responsibility:** Grants credits + tier + QR delivery

#### Endpoint 2: Payment History Webhook
- **URL:** `https://app.authichain.com/api/stripe/webhook`
- **Events to enable:**
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.*`
- **Responsibility:** Tracks payment history, MRR reporting

**Get the signing secret:**
Click on either webhook → scroll to "Signing secret" → copy it
You'll need this for Step 3 env vars: `STRIPE_WEBHOOK_SECRET=whsec_...`

### 2b. Create Meters (for agent usage billing)

Navigate to: **Billing → Meters**

Create these four meters with exact `event_name` matching:

| Meter Event Name | Unit | Price |
|------------------|------|-------|
| `verify_product_calls` | 1 | $0.05 |
| `register_product_calls` | 10 | $0.50 |
| `check_eu_dpp_calls` | 100 | $5.00 |
| `mint_certificate_calls` | 20 | $1.00 |

**Why:** `reportAgentUsage()` in the code emits these meter events. The names must match exactly so Stripe recognizes them.

### 2c. Verify Payouts Setup (the actual founder income)

Navigate to: **Settings → Payouts**

Checklist:
- ✅ Business account is **verified** (legal name, EIN, address)
- ✅ Bank account is **added** (routing, account number)
- ✅ Automatic payout schedule is **enabled** (weekly, monthly, etc.)

This is where founder money actually lands. Without this, Stripe holds the cash indefinitely.

---

## What You've Now Accomplished

✅ **Database:** Pack buyers will now receive credits when they pay  
✅ **Webhooks:** Fulfillment is wired up (credits + tier + QR)  
✅ **Meters:** Agent usage is tracked for billing  
✅ **Payouts:** Founder cash goes to bank automatically  

---

## Step 3: Later (When Vercel Rate Limit Resets)

Once Vercel can deploy again (24 hours or with Pro):

1. Set these env vars in Vercel:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_... (from Step 2a)
   NEXT_PUBLIC_APP_URL=https://app.authichain.com
   SENDGRID_FROM_EMAIL=QRON <noreply@authichain.com>
   HUBSPOT_ACCESS_TOKEN=pat_... (optional)
   ```

2. Trigger a redeploy (Vercel will auto-deploy after env vars are set)

3. Run a real $29 test transaction and verify credits appear on `/success`

---

## Timeline

- **Now:** Steps 1 & 2 (~20 min) → most of the activation is done
- **Later:** Step 3 (5 min when Vercel available) → live collection
- **Total to first dollar:** < 1 hour of actual work

---

## Troubleshooting

**If migrations don't apply:**
- Verify `supabase db push` completed without errors
- Check Supabase project has service role key available
- Run `supabase db status` to see applied migrations

**If webhooks don't fire:**
- Verify endpoint URL is exactly `https://app.authichain.com/api/webhook`
- Test webhook delivery in Stripe Dashboard (Developers → Webhooks → endpoint → "Send test")
- Check signing secret matches `STRIPE_WEBHOOK_SECRET` env var (set in Step 3)

**If meter events don't appear:**
- Verify `event_name` matches exactly (case-sensitive)
- Check `reportAgentUsage()` is being called in your agent code
- Meter must be attached to the agent pricing plan in Stripe

---

**Questions?** See `ACTIVATION_QUICKSTART.md` or `docs/revenue/activation-checklist-2026-06-20.md` for full details.
