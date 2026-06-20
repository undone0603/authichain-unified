# Revenue Activation Checklist — 2026-06-20

**Goal:** the shortest path from "code is correct" to "a dollar lands in the
founder's Stripe balance." This is the operator's runbook for the fixes shipped
this session.

The money path is now **code-complete and hardened**. What remains is
configuration: database migrations, environment variables, and Stripe Dashboard
setup. Everything below is an ops action — no further code is required to collect
the first dollar.

---

## TL;DR — first dollar today (3 actions)

1. **Push the database migrations** so paid checkouts actually grant credits:
   ```bash
   cd authichain && supabase db push     # applies 00004 + 00005
   ```
2. **Register the Stripe webhook → `https://app.authichain.com/api/webhook`**
   (events: `checkout.session.completed`, `customer.subscription.*`,
   `invoice.paid`, `invoice.payment_failed`) and put the signing secret in
   `STRIPE_WEBHOOK_SECRET`.
3. **Confirm `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_APP_URL` are set in Vercel**,
   redeploy, then run a real $29 Starter purchase. Credits should appear on
   `/success` even before the webhook fires (the backstop covers it).

If those three are green, you are collecting money.

---

## 1. Database migrations (CRITICAL — fixes silent revenue loss)

Two new migrations under `supabase/migrations/`:

| File | What it does | Why it matters |
|------|--------------|----------------|
| `00004_create_add_generation_credits_rpc.sql` | Creates `add_generation_credits(user_uuid, amount)` | Pack purchases ($29/$99/$249) called this RPC, which never existed. Buyers were charged and got **zero credits**, silently. |
| `00005_create_stripe_events_table.sql` | Creates `stripe_events` (idempotency ledger) | Both webhooks and the new fulfillment backstop use it to guarantee credits are granted **exactly once**. |

```bash
cd authichain && supabase db push
# verify:
#   select proname from pg_proc where proname = 'add_generation_credits';
#   select to_regclass('public.stripe_events');
```

Until these run, **every pack sale loses its fulfillment.**

---

## 2. Stripe Dashboard setup

### 2a. Webhooks — register BOTH endpoints

Fulfillment is split across two handlers by design. Register **both** as Stripe
webhook endpoints (Developers → Webhooks), or fulfillment will be partial:

| Endpoint | Responsibility | Required events |
|----------|----------------|-----------------|
| `/api/webhook` | **Grants credits + tier**, tokenomics, QR delivery | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| `/api/stripe/webhook` | Subscription status + `payment_history` (powers MRR/fiat panel) | `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*` |

> Both verify signatures against `STRIPE_WEBHOOK_SECRET`. If you register only
> one URL, point it at `/api/webhook` (credits are the customer-facing
> obligation). The success-page backstop (`/api/checkout/verify`) now covers a
> missed/delayed webhook either way.

### 2b. Meters — for autonomous-agent (usage) revenue

`reportAgentUsage()` emits meter events. Create these **meters** with matching
`event_name`s (Billing → Meters), then attach metered prices to the agent plan:

| Meter `event_name` | Unit value | $ per call |
|--------------------|-----------|-----------|
| `verify_product_calls` | 1 | $0.05 |
| `register_product_calls` | 10 | $0.50 |
| `check_eu_dpp_calls` | 100 | $5.00 |
| `mint_certificate_calls` | 20 | $1.00 |

### 2c. Payouts — the actual founder income

Settings → Payouts: confirm a **verified business + bank account** and an
automatic payout schedule on the **platform** account. The primary checkout uses
no `transfer_data`/`application_fee`, so 100% of subscription + pack revenue
accrues here and pays out to the founder's bank. White-label vendor checkouts
add a 10% `application_fee` on top.

---

## 3. Environment variables

### Payments + fulfillment (required to collect)
| Var | Notes |
|-----|-------|
| `STRIPE_SECRET_KEY` | Live key. Checkout/webhook/backstop all 503 without it. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from §2a. |
| `NEXT_PUBLIC_APP_URL` | Real origin, e.g. `https://app.authichain.com`. Used for success/cancel URLs + email links. Must NOT be `""`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server writes (credits, status). |
| `INTERNAL_API_SECRET` | Internal `/api/email` auth from webhooks. |

### Email (required for lead engagement + receipts)
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (+ optional `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_FROM`, `SMTP_FROM_NAME`). Without SMTP, the instant welcome email and QR
delivery silently no-op.

### Acquisition (turns the funnel on)
| Var | Effect |
|-----|--------|
| `HUBSPOT_ACCESS_TOKEN` | Inbound leads upsert as HubSpot contacts. |
| `APOLLO_API_KEY` | Outbound pipeline discovers fresh prospects. |
| `AUTONOMOUS_PIPELINE_ENABLED=true` | Enables the autonomous outbound tick (cron forces it regardless; this gates non-cron runs). |
| `CRON_SECRET` | Auth for the Vercel cron at `/api/cron/pipeline`. |

### Payouts (leave OFF until intentional)
`PAYOUTS_ENABLED` defaults to **false**. Caps: `PAYOUT_MAX_PER_ITEM` ($500),
`PAYOUT_MAX_PER_RUN` ($5000). Only set `PAYOUTS_ENABLED=true` when affiliate/
staking payouts should actually disburse.

---

## 4. What shipped this session (code — already merged to the dev branch)

1. **Fulfillment hardening** (`fix(revenue)`): missing-RPC migration, idempotent
   `stripe_events` table, shared `grantCheckoutEntitlements()`, and a
   success-page **backstop** (`/api/checkout/verify`) so a paid checkout is
   fulfilled exactly once even if the webhook never arrives.
2. **Founder fiat visibility** (`feat(revenue)`): `/api/admin/revenue` now
   returns `fiat` — MRR/ARR, active subscribers, and the live Stripe cash
   balance (available + pending).
3. **Speed-to-lead** (`feat(acquisition)`): inbound capture now sends an instant
   welcome email + HubSpot upsert instead of a silent log row.

---

## 5. Verification after activation

```bash
# 1. Real purchase — Starter $29 — then on /success the credits panel shows 100.
# 2. Fulfillment landed exactly once:
#      select * from stripe_events where event_id like 'fulfill:%';
#      select tier, generations_limit from profiles where user_id = '<buyer>';
# 3. Founder income (admin, authenticated):
#      GET /api/admin/revenue  ->  .fiat.stripe_balance_available_usd, .fiat.mrr_usd
# 4. Lead engagement:
#      POST /api/leads/capture {"email":"you@example.com"}  -> welcome email arrives
```

---

## 6. Known follow-ups (not blocking first dollar)

- **Subscription credit refresh:** `/api/webhook` re-grants on
  `customer.subscription.updated` (active). For the finite `theater_1` plan
  (5,000/mo) this can inflate the limit on unrelated updates. Move recurring
  credit refresh to `invoice.paid` keyed by invoice id. (Tracked; low urgency —
  it over-grants, never under-charges.)
- **`payment_history` for one-time packs:** only subscription invoices write it,
  so DB-derived gross undercounts packs. The Stripe-balance figure in the fiat
  panel is authoritative regardless.
