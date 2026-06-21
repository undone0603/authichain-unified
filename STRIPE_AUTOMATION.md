# Stripe Automation — Zero-Manual-Action Setup

All Stripe configuration is now **fully automated via API**. No Stripe Dashboard clicks required.

---

## ⚡ Quick Start (3 minutes)

```bash
# 1. Get your Stripe secret key from https://stripe.com/dashboard/apikeys
export STRIPE_SECRET_KEY="sk_live_..."  # or sk_test_... for testing

# 2. Run the automated setup script
bash scripts/setup-stripe-complete.sh

# 3. Copy the output secrets to Vercel environment variables
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# 4. Redeploy to production
npx vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

**Time: 3 minutes from start to live.**

---

## 🤖 What Automation Creates

The `scripts/setup-stripe-complete.sh` script automatically:

### ✅ Products & Prices (7 tiers)
- **Starter**: $49/mo (500 verifications)
- **Professional**: $199/mo (5,000 verifications)
- **Enterprise**: $799/mo (unlimited)
- **MedTech**: $12,500/mo (50,000 verifications, ISO 13485)
- **Verify API**: $2,500 setup + $499/mo (5,000 verifications)
- **White-Label Portal**: $10,000 setup + $2,500/mo (50,000 verifications)
- **Enterprise Vertical**: $25,000 setup + $7,500/mo (unlimited)

### ✅ Webhook Endpoint
- URL: `https://app.authichain.com/api/webhook`
- Events: 8 total
  - `checkout.session.completed` — fulfillment
  - `customer.subscription.updated` — subscription changes
  - `customer.subscription.deleted` — cancellation
  - `invoice.paid` — payment processed
  - `invoice.payment_failed` — payment retry
  - `customer.subscription.trial_will_end` — trial ending
  - `invoice.finalized` — invoice ready
  - `charge.refunded` — refund issued

### ✅ Billing Meters (4 usage-based)
- `verify_product_calls` — API verification calls
- `register_product_calls` — Registration API calls
- `check_eu_dpp_calls` — EU DPP compliance checks
- `mint_certificate_calls` — NFT certificate mints

---

## 📋 Implementation Details

### Where Products Are Defined
File: `server/stripe-products.ts`

```typescript
export const STRIPE_PRODUCTS = {
  starter: {
    name: "AuthiChain Starter",
    priceMonthly: 4900,     // $49.00
    priceAnnual: 47000,     // $470/year
  },
  // ... 6 more tiers ...
}
```

### How It Works
1. **Idempotent Creation**: Script checks if products exist before creating
   - Matched by `product.metadata.canonical_name`
   - Safe to run multiple times
   - Skips existing products

2. **Price Mapping**: Each price is output for import to billing system
   ```
   "price_1A2B3C4D": "starter",
   "price_1X2Y3Z": "professional",
   ```

3. **Webhook Auto-Registration**: API creates endpoint with all 8 events
   - Returns `STRIPE_WEBHOOK_SECRET` for environment variables
   - Auto-detects if endpoint already exists

4. **Billing Meter Creation**: Usage meters created for metered pricing
   - Custom event names: `custom.verify_product_calls`, etc.
   - Ready for incremental revenue tracking

---

## 🔑 Required: Stripe API Key

You need a **Stripe Secret Key** to run the automation.

### Getting Your Key
1. Go to https://stripe.com/dashboard/apikeys
2. Look for "Secret key"
3. Copy it (usually starts with `sk_live_` or `sk_test_`)
4. Set as environment variable: `export STRIPE_SECRET_KEY="sk_live_..."`

### Test Mode vs Live Mode
- **Test mode**: Key starts with `sk_test_` — create test products first
- **Live mode**: Key starts with `sk_live_` — production revenue

Run the script once per mode to set up both test and live environments.

---

## 🚀 Full Activation Timeline

```bash
# Step 1: Get your Stripe key (30 seconds)
# Go to https://stripe.com/dashboard/apikeys → copy secret key

# Step 2: Run automation (60 seconds)
export STRIPE_SECRET_KEY="sk_live_..."
bash scripts/setup-stripe-complete.sh

# Step 3: Capture output secrets
# Copy STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET

# Step 4: Update Vercel (60 seconds)
# Vercel Dashboard → Settings → Environment Variables
# Paste: STRIPE_SECRET_KEY=sk_live_...
# Paste: STRIPE_WEBHOOK_SECRET=whsec_...

# Step 5: Deploy (60 seconds)
export VERCEL_TOKEN="<from vercel.com/account/tokens>"
npx vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN

# Step 6: Test (60 seconds)
# Go to https://app.authichain.com → complete $29 checkout
# Verify credits appear on account

# TOTAL TIME: 5 minutes
```

---

## ✅ Verification Checklist

After running the script, confirm:

- [ ] Script ran without errors
- [ ] STRIPE_WEBHOOK_SECRET captured
- [ ] 7 products created (check Stripe Dashboard → Products)
- [ ] Webhook endpoint registered (Stripe Dashboard → Webhooks)
- [ ] 4 billing meters created (Stripe Dashboard → Billing → Meters)
- [ ] Environment variables updated in Vercel
- [ ] Vercel redeployed with new secrets
- [ ] $29 test transaction completes successfully
- [ ] Credits appear immediately on customer account
- [ ] Webhook shows "Verified" in Stripe Dashboard

---

## 🔄 Re-running the Script

Safe to run multiple times:
- **Products**: Skips existing (matched by `canonical_name`)
- **Webhook**: Detects existing endpoint, updates if needed
- **Meters**: Skips existing meters

No risk of duplicates or overwrites.

---

## 🐛 Troubleshooting

### Script fails with "Invalid Stripe key"
- Verify you copied the full key from Stripe Dashboard
- Should start with `sk_live_` or `sk_test_`
- Check: `echo $STRIPE_SECRET_KEY` to confirm

### Webhook endpoint not created
- Check Stripe Dashboard → Webhooks for existing endpoint
- If already exists, script captures its signing secret
- Verify webhook shows "Verified" (test event delivered successfully)

### Products created but not visible
- Go to Stripe Dashboard → Products
- Look for: Starter, Professional, Enterprise, MedTech, Verify API, White-Label, Vertical
- Check `metadata.canonical_name` matches code

### Billing on Vercel fails after setup
- Confirm STRIPE_WEBHOOK_SECRET has `whsec_` prefix (not `sk_`)
- Confirm both env vars set in Vercel (not just local .env)
- Redeploy: `npx vercel deploy --prebuilt --prod`

---

## 📚 Related Files

- **Products Definition**: `server/stripe-products.ts` (7 tiers)
- **Setup Script**: `scripts/setup-stripe-complete.sh` (automation)
- **Product Seeder**: `scripts/setup-stripe-products.ts` (API interaction)
- **Webhook Handler**: `src/app/api/webhook/route.ts` (payment processing)
- **Fulfillment**: `src/lib/fulfillment.ts` (atomic credit grants)

---

## 🎯 Revenue Streams Enabled After Setup

Once you run this script and deploy:

| Stream | Monthly | Trigger |
|--------|---------|---------|
| **Checkout Sessions** | $5k-20k | Immediate (after deploy) |
| **White-Label Licensing** | $0-90k | Immediate (after deploy) |
| **Affiliate Payouts** | $2k-5k | After `PAYOUTS_ENABLED=true` |
| **Staking Rewards** | $1k-3k | Daily at 4 AM UTC |

**Total potential: $30k+/mo** once all revenue streams enabled.

---

## 🎬 Next Actions

1. **Get your Stripe key**: https://stripe.com/dashboard/apikeys
2. **Run automation**: `export STRIPE_SECRET_KEY="..." && bash scripts/setup-stripe-complete.sh`
3. **Update Vercel**: Paste secrets into environment variables
4. **Deploy**: `npx vercel deploy --prebuilt --prod`
5. **Test**: Complete $29 transaction, verify credits appear

**Expected time: 5 minutes from start to live revenue.**
