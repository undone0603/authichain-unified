# Step 3: Vercel Deployment (Direct CLI Workaround)

**Problem**: Vercel free tier hit 100 deployments/day limit.  
**Solution**: Deploy directly via Vercel CLI, bypassing GitHub CI entirely.  
**Time**: 5-10 minutes  
**Rate-limited?**: No

---

## Prerequisites

- Node.js 22+ and pnpm installed locally
- Access to Vercel account
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and other env vars from Step 2

---

## Step-by-Step Instructions

### 1. Generate Vercel API Token

1. Go to: https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name: `authichain-revenue-deploy`
4. Expiration: 7 days (temporary for this deployment)
5. **Copy the token** (you'll use it once, shown only once)

### 2. Pull Production Environment

Run this in your local authichain-unified repo:

```bash
export VERCEL_TOKEN="paste-your-token-here"
bash scripts/pull-env.sh
```

This fetches all production environment variables into your local `.env` file.

**What you'll see**:
```
Downloading .env from Vercel...
✓ Successfully pulled environment from Vercel
```

### 3. Update `.env` with STRIPE Variables

Edit `.env` (created in step 2) and update these values:

```bash
# STRIPE — from your Stripe Dashboard
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX

# APP URL — critical for checkout success/cancel URLs
NEXT_PUBLIC_APP_URL=https://app.authichain.com

# EMAIL — for lead welcome emails
SENDGRID_FROM_EMAIL=QRON <noreply@authichain.com>

# HUBSPOT — optional, for lead upsert
# HUBSPOT_ACCESS_TOKEN=pat_XXXXXXXXXXXXX
```

**Where to find these**:
- `STRIPE_SECRET_KEY`: Stripe Dashboard → Developers → API Keys → Secret key
- `STRIPE_WEBHOOK_SECRET`: From Step 2 (Stripe webhook details)
- `NEXT_PUBLIC_APP_URL`: Your production domain (https://app.authichain.com)
- `SENDGRID_FROM_EMAIL`: Your email service sender
- `HUBSPOT_ACCESS_TOKEN`: HubSpot → Settings → Integrations → Private Apps (optional)

### 4. Build Locally

```bash
pnpm install --no-frozen-lockfile
pnpm build
```

**Expected output**:
```
vite v... building...
✓ 2847 modules transformed.
dist/public/index.html         12.45 kB │ gzip: 3.42 kB
dist/public/assets/index-....js 245.67 kB │ gzip: 78.33 kB
...
✓ build complete in 45.23s
```

### 5. Deploy to Vercel

```bash
export VERCEL_TOKEN="paste-your-token-here"
npx vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

**What happens**:
1. Vercel uploads your prebuilt `dist/` directory
2. Uploads your local `.env` variables to Vercel project
3. Deploys to production (no rebuild needed)
4. Returns your production URL

**Expected output**:
```
Vercel CLI 34.1.1
🔍 Inspecting project...
✓ Prebuilt deployment uploaded to Vercel
✓ Environment variables synchronized
✓ Production deployment successful
✓ Ready at https://app.authichain.com (5s)
```

### 6. Verify Deployment

#### 6a. Check code deployed
Visit: https://app.authichain.com (or your production URL)
- Site should be live
- No 503 errors

#### 6b. Run a real $29 test transaction

1. Go to https://app.authichain.com/pricing
2. Click "Get Started" on Starter plan ($29)
3. Complete checkout with test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/26)
   - CVC: Any 3 digits (e.g., 123)
4. Land on `/success` page
5. **Credits should appear immediately** (backstop fulfillment)

#### 6c. Verify fulfillment in database

```sql
-- Check stripe_events table for fulfillment guard
SELECT event_id, event_type, processed_at 
  FROM stripe_events 
  WHERE event_id LIKE 'fulfill:%' 
  ORDER BY processed_at DESC 
  LIMIT 5;

-- Check that buyer's tier and credits were updated
SELECT user_id, tier, generations_limit 
  FROM profiles 
  WHERE email = 'your-test-email@example.com';
```

Expected results:
- One row in `stripe_events` with `event_id` like `fulfill:cs_live_...`
- Profile row with `tier` = 'starter' and `generations_limit` = 100 (or adjusted by purchases)

#### 6d. Check founder income

Authenticated request to admin endpoint (requires session):
```bash
curl -H "Authorization: Bearer $SESSION_TOKEN" \
  https://app.authichain.com/api/admin/revenue
```

Expected response:
```json
{
  "fiat": {
    "configured": true,
    "currency": "usd",
    "mrr_usd": "29.00",
    "arr_usd": "348.00",
    "active_subscribers": 1,
    "stripe_balance_available_usd": "29.00",
    "stripe_balance_pending_usd": "0.00"
  },
  ...
}
```

---

## Troubleshooting

### Build fails with "Command not found: pnpm"
```bash
npm install -g pnpm
pnpm build
```

### Vercel token is invalid
- Regenerate at https://vercel.com/account/tokens
- Ensure token has "Deployments" permission
- Ensure token has not expired (24h for one-time tokens)

### Deployment fails with "No Vercel project found"
First time deploying with CLI? Link the project:
```bash
npx vercel link
# Follow prompts to select your Vercel project
# Then retry: npx vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

### Credits don't appear on /success
1. Check `STRIPE_WEBHOOK_SECRET` is exactly as registered in Stripe Dashboard
2. Verify `/api/webhook` and `/api/checkout/verify` are deployed (check `dist/` folder)
3. Check browser console for 500 errors on success page
4. Review `stripe_events` table — if no `fulfill:*` row, webhook didn't fire
5. Check Vercel logs: `vercel logs https://app.authichain.com`

### Environment variables didn't sync to Vercel
Variables were set locally only (in your `.env`). Vercel CLI should have uploaded them during deploy.

To manually push variables to Vercel dashboard:
```bash
bash scripts/push-env-to-vercel.sh
# Or individual project: vercel env ls (to list), then set via Dashboard UI
```

---

## Summary

You've now:
✅ Bypassed Vercel free-tier rate limit entirely  
✅ Deployed latest code to production  
✅ Set environment variables for live payment processing  
✅ Verified fulfillment works end-to-end  
✅ Tested founder income visibility  

**Money is now collecting.** The three-step activation is complete.

Next: Monitor webhook events, verify payment history, and watch MRR grow.

---

## Related Files

- `scripts/pull-env.sh` — pulls environment from Vercel
- `scripts/push-env-to-vercel.sh` — pushes environment to all 12 Vercel projects
- `ACTIVATION_STEPS_1_2.md` — database migrations + Stripe setup
- `ACTIVATION_QUICKSTART.md` — quick reference for all 3 steps
- `docs/revenue/activation-checklist-2026-06-20.md` — full operator runbook
