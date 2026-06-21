# Stripe Dashboard Setup — Quick Reference Card

## 🎯 You Are Here
- ✅ Code deployed to main (commit b38b6ed)
- ✅ All tests passing (465/465)
- ✅ Production build ready
- ⏳ **4 Stripe Dashboard actions remaining**

---

## ⏰ TIME REQUIRED: ~25 minutes total

---

## STEP 1️⃣ : ROTATE STRIPE SECRET KEY (5 min) 🔴 CRITICAL

**Why**: Old key exposed in git history. MUST rotate before accepting real payments.

### Action
1. Go to: https://stripe.com/dashboard/apikeys
2. Under "Secret key", either:
   - Create new restricted key, OR
   - Copy existing key value
3. Copy the value (starts with `sk_live_`)
4. Open Vercel Dashboard
5. Go to: Settings → Environment Variables
6. Find `STRIPE_SECRET_KEY`
7. Paste new key
8. **Trigger Redeploy**: Click "Redeploy" button
9. Return to Stripe Dashboard
10. **Deactivate old key**: Click × next to exposed key (sk_live_51SXIyEGq...)

✅ **DONE when**: Vercel deployment succeeds with new key

---

## STEP 2️⃣ : CREATE STRIPE WEBHOOK (5 min) 🔴 CRITICAL

**Why**: Webhooks notify your system when customers pay. Without this, customers won't get credits.

### Action
1. Go to: https://stripe.com/dashboard/webhooks
2. Click "Add Endpoint"
3. **Endpoint URL**: `https://app.authichain.com/api/webhook`
4. Click "Select events" and check these 8 boxes:
   - ☑️ `checkout.session.completed`
   - ☑️ `customer.subscription.updated`
   - ☑️ `customer.subscription.deleted`
   - ☑️ `invoice.paid`
   - ☑️ `invoice.payment_failed`
   - ☑️ `customer.subscription.trial_will_end`
   - ☑️ `invoice.finalized`
   - ☑️ `charge.refunded`
5. Click "Add Endpoint"
6. Copy **Signing Secret** (starts with `whsec_`)
7. Open Vercel Dashboard
8. Go to: Settings → Environment Variables
9. Find `STRIPE_WEBHOOK_SECRET`
10. Paste signing secret
11. **Trigger Redeploy**: Click "Redeploy" button

✅ **DONE when**: Vercel deployment succeeds and webhook shows "Verified" in Stripe Dashboard

---

## STEP 3️⃣ : CREATE BILLING METERS (5 min) ⚪ OPTIONAL

**Why**: Enables usage-based billing (charge per API call, per mint, etc.). Not required for basic revenue.

### Action
1. Go to: https://stripe.com/dashboard/billing/meters
2. Click "Create meter"
3. Create these 4 meters (one at a time):

   **Meter 1**:
   - Name: `verify_product_calls`
   - Description: "Verify API calls"
   
   **Meter 2**:
   - Name: `register_product_calls`
   - Description: "Register API calls"
   
   **Meter 3**:
   - Name: `check_eu_dpp_calls`
   - Description: "EU DPP checks"
   
   **Meter 4**:
   - Name: `mint_certificate_calls`
   - Description: "Certificate mints"

✅ **DONE when**: All 4 meters created and visible in dashboard

---

## STEP 4️⃣ : CREATE WHITE-LABEL PRODUCTS (10 min) ⚪ OPTIONAL

**Why**: Enables B2B licensing revenue ($7.5k-90k/month). Not required for Starter/Pro/Enterprise subscriptions.

### Action
1. Go to: https://stripe.com/dashboard/products
2. Click "Create Product"

   **PRODUCT 1: Verify API License**
   - Name: `Verify API License`
   - Type: Service
   - Pricing Model: Setup fee + recurring
   - Setup fee: $2,500 (enter as 2500, dollar sign auto)
   - Recurring: $499/month
   - Billing period: Monthly
   - Tax code: Software as a Service (choose from list)
   - Click "Create"

   **PRODUCT 2: White-Label Portal**
   - Name: `White-Label Portal`
   - Type: Service
   - Pricing Model: Setup fee + recurring
   - Setup fee: $10,000
   - Recurring: $2,500/month
   - Billing period: Monthly
   - Tax code: Software as a Service
   - Click "Create"

   **PRODUCT 3: Enterprise Vertical**
   - Name: `Enterprise Vertical`
   - Type: Service
   - Pricing Model: Setup fee + recurring
   - Setup fee: $25,000
   - Recurring: $7,500/month
   - Billing period: Monthly
   - Tax code: Software as a Service
   - Click "Create"

✅ **DONE when**: All 3 products visible in Stripe Dashboard → Products

---

## 📋 VERIFICATION CHECKLIST

After completing all 4 steps:

- [ ] Stripe key rotated (old key deactivated)
- [ ] Webhook endpoint shows "Verified" status
- [ ] 4 billing meters created and visible
- [ ] 3 white-label products created with setup fees
- [ ] Vercel redeployed with new secrets
- [ ] Production build succeeds

---

## 🚀 FINAL DEPLOYMENT

Once all 4 Stripe steps complete:

```bash
# Generate Vercel token at: https://vercel.com/account/tokens
export VERCEL_TOKEN="your_token_here"

# Pull production environment into local .env
bash scripts/pull-env.sh

# Deploy to production (with new Stripe secrets already in Vercel)
npx vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

**Time**: 5-10 minutes

---

## ✅ REVENUE LIVE IN 30 MINUTES

| Step | Duration | Revenue Enabled |
|------|----------|-----------------|
| Rotate key | 5 min | ✓ Payments accepted |
| Add webhook | 5 min | ✓ Fulfillment works |
| Deploy | 10 min | ✓ **LIVE** |
| Test transaction | 5 min | ✓ Confirmed working |
| **TOTAL** | **~30 min** | **$30k+/month potential** |

---

## 🆘 TROUBLESHOOTING

**"Webhook shows not verified"**
→ Make sure endpoint is `https://app.authichain.com/api/webhook` (not http)
→ Verify Vercel deployment succeeded with new STRIPE_WEBHOOK_SECRET

**"Stripe key not accepted in Vercel"**
→ Make sure you copied the full key (starts with `sk_live_`)
→ Redeploy after changing

**"Test transaction fails"**
→ Check Stripe Dashboard → Webhooks → Events (should show deliveries)
→ Check Vercel logs: `vercel logs https://app.authichain.com`

---

## 📚 REFERENCE DOCS

- Full checklist: `EXECUTION_CHECKLIST.md`
- Complete status: `PRODUCTION_STATUS.md`
- Automation script: `PRODUCTION_ACTIVATION.sh`

---

**Ready?** Open Stripe Dashboard and start with Step 1. You'll be collecting revenue in 30 minutes.
