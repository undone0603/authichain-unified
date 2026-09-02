# Stripe Webhook Implementation Summary

> **2026-08-27 update:** This document previously described
> `src/app/api/webhooks/stripe/route.ts` as the live handler. That endpoint has
> since been **retired** (it now returns `410 Gone` unless
> `STRIPE_WEBHOOK_LEGACY_ENABLED=true`) and consolidated into the handler
> described below. If your Stripe Dashboard webhook is still pointed at
> `/api/webhooks/stripe` with `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`, **update it**
> — see "Setup Steps" below. This rewrite reflects the current, live
> implementation only.

## Overview

The canonical Stripe webhook handler tracks customer payments, reconciles
subscriptions, and drives revenue/dunning/lead-status side effects for every
AuthiChain-family brand (authichain.com, qron.space, strainchain.io,
govchain.us) through a single endpoint.

1. **Webhook Handler** (`server/webhooks/stripe.ts`, registered at
   `POST /api/stripe/webhook` in `server/_core/app.ts`)
   - Verifies the Stripe signature against every brand's configured secret
     (see "Per-brand signing secrets" below) — not just one
   - Handles: `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_succeeded`,
     `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed`,
     `checkout.session.expired`
   - Deduplicates Stripe retries via the `activity_log` table
   - Logs every event to `activity_log` (via `logAutomationAudit`) for
     compliance/debugging

2. **Database writes** (Drizzle ORM, `server/db.ts`)
   - `subscriptions` — subscription lifecycle (`active` / `trialing` /
     `past_due` / `cancelled` / `paused`), quota, billing cycle
   - `revenue_records` — one row per paid invoice (`recordRevenue`)
   - `activity_log` — idempotency guard + full audit trail
     (`logActivity`, `logAutomationAudit`)
   - `notifications` — in-app alerts on payment failure
     (`createSystemNotification`)

3. **Retired endpoint** (`src/app/api/webhooks/stripe/route.ts`)
   - Returns `410 Gone` by default. Its logic (payments/subscriptions/alerts
     tables via Supabase) is no longer wired to a live Stripe endpoint. Do
     not point new Stripe webhook configuration at this route.

## Route Registration

```
server/_core/app.ts
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), ...)
    → dynamically imports handleStripeWebhook from server/webhooks/stripe.ts
    → passes (req.body as Buffer, req.headers["stripe-signature"])
```

`express.raw()` is mounted **before** `express.json()` for this route
specifically, so `handleStripeWebhook` receives the untouched raw body
required for signature verification.

## Per-brand signing secrets

`shared/brands.ts` declares one env var name per brand under
`billing.webhookSecretEnv`:

| Brand       | `webhookSecretEnv`                 |
| ----------- | ---------------------------------- |
| authichain  | `STRIPE_WEBHOOK_AUTHICHAIN_SECRET` |
| qron        | `STRIPE_WEBHOOK_SECRET`            |
| strainchain | `STRIPE_WEBHOOK_SECRET`            |
| govchain    | `STRIPE_WEBHOOK_SECRET`            |

Because Stripe signs each webhook endpoint with its own secret, and
`authichain.com`'s endpoint is configured with a different secret than the
other three brands, `handleStripeWebhook` collects every distinct env var
named above (plus `STRIPE_WEBHOOK_SECRET` as a fallback) and tries
`stripe.webhooks.constructEvent()` against each configured value in turn,
using whichever one verifies. If none verify, the original signature error is
thrown and the route returns `400`.

**Practical effect:** as long as `STRIPE_WEBHOOK_SECRET` and
`STRIPE_WEBHOOK_AUTHICHAIN_SECRET` are both set in the deployment
environment, a single `/api/stripe/webhook` endpoint correctly verifies
events from Stripe Dashboard webhooks configured with either secret — you do
not need separate routes per brand.

## Event Flow

```
Stripe Dashboard (any brand's webhook endpoint)
    ↓
POST /api/stripe/webhook
    ↓
handleStripeWebhook(rawBody, sig)
    ↓
Try stripe.webhooks.constructEvent() against each candidate secret
  (STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_AUTHICHAIN_SECRET, ...)
    ↓
hasWebhookEventProcessed(event.id) — dedup against activity_log
    ↓
logActivity({ action: "webhook_received", ... }) — mark in-flight
    ↓
Switch on event.type:
    ├─ customer.subscription.created / .updated
    │   ├─ upsertStripeSubscription(...) → subscriptions table
    │   └─ (on created + active/trialing) send welcome email
    │
    ├─ customer.subscription.deleted
    │   └─ setSubscriptionStatusByStripeId(id, "cancelled")
    │
    ├─ invoice.payment_succeeded / invoice.paid
    │   ├─ recordRevenue(...) → revenue_records table
    │   └─ setSubscriptionStatusByStripeId(id, "active")
    │
    ├─ invoice.payment_failed
    │   ├─ setSubscriptionStatusByStripeId(id, "past_due")
    │   └─ createSystemNotification(userId, "Payment Failed", ...)
    │
    ├─ checkout.session.completed
    │   └─ (one-time service orders) handleServiceOrderPayment(...)
    │
    └─ checkout.session.expired
        └─ send checkout-recovery email
    ↓
logAutomationAudit(...) — writes to activity_log for every branch
    ↓
Return 200 { received: true, type: event.type, handled: true }
```

## Environment Variables Required

```bash
STRIPE_SECRET_KEY=sk_live_...                    # Stripe API key
STRIPE_WEBHOOK_SECRET=whsec_...                   # qron / strainchain / govchain endpoints
STRIPE_WEBHOOK_AUTHICHAIN_SECRET=whsec_...        # authichain.com endpoint (separate secret)
DATABASE_URL=postgres://...                       # required for all DB writes
```

`STRIPE_WEBHOOK_LEGACY_ENABLED=true` re-enables the retired
`src/app/api/webhooks/stripe/route.ts` handler for cutover/rollback only —
leave unset in normal operation.

## Setup Steps

1. In the Stripe Dashboard, for **each** brand domain that takes payments,
   go to Developers → Webhooks → Add endpoint:
   - Endpoint URL: `https://<brand-domain>/api/stripe/webhook`
     (all brands point at the **same** path — brand routing happens by
     signing secret, not URL)
   - Events to send: `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_succeeded`, `invoice.paid`, `invoice.payment_failed`,
     `checkout.session.completed`, `checkout.session.expired`
   - Reveal the signing secret (`whsec_...`)
2. Set the secret in your deployment env:
   - authichain.com's endpoint secret → `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`
   - every other brand's endpoint secret → `STRIPE_WEBHOOK_SECRET`
     (if a brand ever needs its own secret, add a `webhookSecretEnv` entry
     for it in `shared/brands.ts` and set that env var — no other code
     changes needed, `handleStripeWebhook` picks it up automatically)
3. Deploy. Redeploy after adding/changing env vars so the new value is read.
4. Confirm in Stripe Dashboard → Webhooks → your endpoint → "Recent events"
   shows successful (`200`) deliveries.

## Verification Tests

```bash
# Local, with Stripe CLI:
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_failed

# Idempotency: fire the same event twice, second should be marked duplicate
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_succeeded
```

Check `server/webhooks/stripe.test.ts` for the full behavioral test suite
(signature failure, idempotency, each event type) that exercises this
handler with a mocked Stripe SDK.

## Troubleshooting

**Problem:** Webhook returns 400 ("Webhook Error")
**Solution:** Signature didn't verify against _any_ configured secret. Check
that the secret set in your deployment env matches the one shown for that
specific endpoint in Stripe Dashboard → Webhooks → (endpoint) → Signing
secret. Remember authichain.com uses a different env var
(`STRIPE_WEBHOOK_AUTHICHAIN_SECRET`) than the others.

**Problem:** Webhook returns 404 / connection refused at `/api/webhooks/stripe`
**Solution:** That path is intentionally retired (410). Point Stripe at
`/api/stripe/webhook` instead.

**Problem:** Events accepted (200) but nothing shows up in the app
**Solution:** Check `activity_log` for the `webhook_received` /
`billing_*` rows for that `event.id` — if present, the handler ran; check
`DATABASE_URL` and the specific table (`subscriptions`, `revenue_records`)
for the expected row. If absent, check server logs for
`[stripe-webhook]`-prefixed errors.
