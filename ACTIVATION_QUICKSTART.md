# Revenue Activation — Quick Start (3 Actions)

**Status:** Code complete, CI green, ready to collect. PR #351 ready for review/merge.

---

## Action 1: Push Migrations (5 min, CRITICAL)

```bash
cd authichain
supabase db push
```

This applies:
- `00004_create_add_generation_credits_rpc.sql` — fixes the silent revenue leak (pack buyers were getting $0 credits)
- `00005_create_stripe_events_table.sql` — idempotency guard so fulfillment happens exactly once

**Until this runs, pack sales produce zero revenue.**

Verify:
```sql
SELECT proname FROM pg_proc WHERE proname = 'add_generation_credits';
SELECT to_regclass('public.stripe_events');
```

---

## Action 2: Stripe Dashboard Setup (15 min)

### Webhooks
Go to **Developers → Webhooks** and create/update two endpoints:

| Endpoint | Events | Responsibility |
|----------|--------|-----------------|
| `https://app.authichain.com/api/webhook` | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` | Credits + tier + QR delivery |
| `https://app.authichain.com/api/stripe/webhook` | `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*` | Payment history + MRR tracking |

Copy the **Signing secret** from the first webhook details.

### Meters (for autonomous agent usage revenue)
Go to **Billing → Meters** and create these:

| Meter Name | Unit | $ Per | 
|-----------|------|-------|
| `verify_product_calls` | 1 | $0.05 |
| `register_product_calls` | 10 | $0.50 |
| `check_eu_dpp_calls` | 100 | $5.00 |
| `mint_certificate_calls` | 20 | $1.00 |

### Payouts
Go to **Settings → Payouts**:
- ✅ Verify business account is verified
- ✅ Bank account added
- ✅ Automatic payout schedule enabled

---

## Action 3: Vercel Environment Variables (5 min)

Set these in your Vercel project settings:

| Variable | Value | Example |
|----------|-------|---------|
| `STRIPE_SECRET_KEY` | Live secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | From §2 above | `whsec_...` |
| `NEXT_PUBLIC_APP_URL` | Production origin | `https://app.authichain.com` |
| `SENDGRID_FROM_EMAIL` | Sender email | `QRON <noreply@authichain.com>` |
| `HUBSPOT_ACCESS_TOKEN` | (optional) | `pat_...` |

Redeploy after setting variables.

---

## Action 4: Verify It Works (10 min)

1. **Buy a Starter pack ($29)** on the live site
2. **Land on `/success`** — credits should appear (backstop guarantees grant even if webhook is slow)
3. **Query the ledger:**
   ```sql
   SELECT event_id, event_type, processed_at FROM stripe_events WHERE event_id LIKE 'fulfill:%' ORDER BY processed_at DESC LIMIT 5;
   SELECT user_id, tier, generations_limit FROM profiles WHERE user_id = '<buyer_uuid>';
   ```
4. **Check founder income** (authenticated admin):
   ```bash
   curl -H "Authorization: Bearer $TOKEN" https://app.authichain.com/api/admin/revenue
   # Look for: .fiat.stripe_balance_available_usd, .fiat.mrr_usd
   ```

---

## Timeline

- **< 1 hour:** All three actions complete → **first dollar collected**
- **Ongoing:** Every new sale goes straight to founder's Stripe balance (no treasury, no fees)

---

## If Something Goes Wrong

- **Buyers see nothing on `/success`**: Check that webhooks are registered and signing secret matches `STRIPE_WEBHOOK_SECRET` env var.
- **Credits don't appear**: Confirm migration 00004 ran (`SELECT proname FROM pg_proc WHERE proname = 'add_generation_credits'`).
- **HubSpot contact not created**: Check `HUBSPOT_ACCESS_TOKEN` is set and valid (best-effort, non-blocking).
- **Admin revenue endpoint returns 500**: Verify `STRIPE_SECRET_KEY` is live (not test), and Supabase connection is valid.

See `docs/revenue/activation-checklist-2026-06-20.md` for full details and follow-ups.

---

**PR:** https://github.com/undone0603/authichain-unified/pull/351
