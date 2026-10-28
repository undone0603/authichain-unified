# Paid catalog checkout: reconciliation and operator recovery (DRAFT / HOLD)

**Evidence snapshot:** 2026-10-28 UTC. **Status:** review-only runbook; no production repair is authorized.
**Scope:** paid Starter/catalog credits handled by `server/webhooks/stripe.ts` and
`src/lib/provisioning.ts`. This is **not** the DPP fulfillment path.

## Why this is a hold, not a completed purchase

A paid catalog checkout with neither a trustworthy `user_id` nor buyer email
cannot be mapped to a profile. `provisionPurchase` returns `no_identity`;
the main-branch handler currently converts that to `false` and can log webhook
`success` anyway. Draft PR #2124 proposes a durable
`public.stripe_events.status = 'reconciliation_required'` record with
`handled: false`. The proposed HTTP 200 means **receipt/hold persisted**,
not entitlement granted, customer activated, or revenue qualified.

The hold is valid only if the **rich** event log persists `event_id`,
`event_type`, `session_id`, `status`, `http_status` and a non-PII error
code. A base-column-only fallback is not a hold. The event ID is the unique
key, but it is **not** a grant lock; a duplicate Stripe event must not be
treated as a new order or silently overwrite the hold.

## Read-only triage (QRON-v2, Supabase project nhdnkzhtadfkkluiulhs)

Run the following as **SELECT only**; do not publish raw session IDs, emails,
payment identifiers, profile IDs, or full error payloads in public issues.

```sql
-- Current status distribution. "success" means a webhook log status, not
-- successful payment or a verified grant.
SELECT event_type, COALESCE(status, '<null>') AS status,
       COUNT(*)::int AS events, MAX(processed_at) AS latest
FROM public.stripe_events
GROUP BY event_type, status
ORDER BY events DESC;

-- Paid catalog recovery candidates, if PR #2124 is ever reviewed and deployed.
SELECT event_type, status, COUNT(*)::int AS events,
       COUNT(*) FILTER (WHERE session_id IS NOT NULL)::int AS with_session
FROM public.stripe_events
WHERE status = 'reconciliation_required'
GROUP BY event_type, status;

-- Grant indicators: these are NOT independent proof of a paid customer.
SELECT
  (SELECT COUNT(*) FROM public.revenue_events) AS revenue_event_rows,
  (SELECT COUNT(*) FROM public.entitlements) AS entitlement_rows,
  (SELECT COUNT(*) FROM public.profiles
    WHERE last_grant_session_id IS NOT NULL) AS profiles_with_session_grant,
  (SELECT COUNT(*) FROM public.subscriptions
    WHERE status = 'active') AS local_active_subscriptions;
```

## Reproducible paid-session linkage check (aggregate only)

This query was executed read-only on QRON-v2 on 2026-10-28. It scopes
to the live AuthiChain Stripe account, uses **positive-amount paid**
Checkout Sessions, joins synced charges by payment intent **and account**,
and checks for a session-keyed webhook log and profile grant marker.
It returns counts only: **no customer identifiers, emails, session IDs,
or payment IDs**. It does not prove that Stripe delivered a signed event,
that the Worker processed it, or that product access works.

```sql
WITH paid_sessions AS (
  SELECT s.id, s._account_id, s.payment_intent,
    COALESCE(BOOL_OR(c.paid IS TRUE AND c.status = 'succeeded'
      AND c.amount > 0 AND c.refunded IS NOT TRUE), false) AS succeeded_charge
  FROM stripe_sdp_data.checkout_sessions AS s
  LEFT JOIN stripe_sdp_data.charges AS c
    ON c.payment_intent = s.payment_intent
   AND c._account_id = s._account_id
  WHERE s._account_id = 'acct_1SXIyEGqTruSqV8T'
    AND s.livemode IS TRUE
    AND s.status = 'complete'
    AND s.payment_status = 'paid'
    AND s.amount_total > 0
  GROUP BY s.id, s._account_id, s.payment_intent
), evidence AS (
  SELECT p.id, p.succeeded_charge,
    EXISTS (SELECT 1 FROM public.stripe_events AS e
            WHERE e.session_id = p.id) AS has_session_webhook_log,
    EXISTS (SELECT 1 FROM public.profiles AS pr
            WHERE pr.last_grant_session_id = p.id) AS has_profile_grant_marker
  FROM paid_sessions AS p
)
SELECT COUNT(*)::int AS paid_positive_sessions,
       COUNT(*) FILTER (WHERE succeeded_charge)::int AS matched_successful_charges,
       COUNT(*) FILTER (WHERE has_session_webhook_log)::int AS session_keyed_webhook_logs,
       COUNT(*) FILTER (WHERE has_profile_grant_marker)::int AS matching_profile_grant_markers
FROM evidence;
```

Observed result: **1 paid-positive session**, **1 matched succeeded charge**,
**0 session-keyed webhook logs**, **0 matching profile grant markers**.
The only positive paid session is the previously classified $10 **founder
smoke payment**, not a qualifying independent customer. Absence of a
session-keyed log is an evidence gap, **not proof of webhook non-delivery**:
historical/base-only logs can lack `session_id`. This query is not a
reconciliation writer or an entitlement grant, and must never be used
to trigger an automatic replay or backfill.

Snapshot on 2026-10-28: 227 `stripe_events` (148 `success`,
75 `error`, four NULL status). The 75 error rows were **all**
`checkout.session.expired` with `DATABASE_URL environment variable is not
set`, last seen 2026-09-23; they are **not** evidence of 75 failed paid
fulfillments. The five `checkout.session.completed` rows consist of four
older NULL-status records without `session_id` and one `success` record.
There were **zero** `reconciliation_required` rows. Also zero
`public.revenue_events`, zero `public.entitlements`, one profile with a
session grant marker, and three locally active subscriptions. These are
diagnostic counts only; the last two do not prove paid renewals.

## Stripe destination ownership: sync is not fulfillment (2026-10-28 read-only)

The live Stripe account has **10 webhook endpoints**, **six enabled**. Four
enabled destinations subscribe to `checkout.session.completed`:

| Destination | Intended/observed role | What is *not* established |
| --- | --- | --- |
| `https://authichain.com/api/stripe/webhook` (`we_1UGTCSGqTruSqV8ThM9bXVWp`) | Canonical AuthiChain edge-router webhook per repo routing and Stripe configuration | Exact deployed Cloudflare Worker revision, per-event delivery outcome, persisted paid grant |
| `https://nhdnkzhtadfkkluiulhs.supabase.co/functions/v1/stripe-webhook` | Stripe Sync Engine ingestion into `stripe_sdp_data` | Customer entitlement or `public.revenue_events` writer |
| `https://first-dollar-desk.undone-k.workers.dev/api/stripe/webhook` | Separate first-dollar-desk receiver | Effect on this specific catalog/DPP order |
| `https://authichain-license-issuer.undone-k.workers.dev/api/license/stripe-webhook` | Separate license-issuer receiver | Effect on this specific catalog/DPP order |

The **deployed** Supabase Edge Function `stripe-webhook` (version **36**,
SHA-256 `171afd1b8c0f578e1046bfbab8ac753ea588b3f9fddcef0cedfc42e434e86555`)
contains `@stripe/sync-engine` version `1.0.32`, verifies Stripe signatures
and synchronizes Stripe objects. The inspected function has no
`provisionPurchase`, `profiles`, or `revenue_events` writer. Its five
synced charges and 779 synced sessions are **source-of-truth payment
observations**, not evidence of business-ledger or entitlement completion.
An empty `public.revenue_events` table cannot be repaired by assuming
the Stripe Sync Engine performs AuthiChain fulfillment.

Stripe live read-only on this date: **five charges** (one successful $10
founder smoke payment, four failed), **zero subscriptions**; QRON-v2:
**zero `public.revenue_events`**, **zero `public.entitlements`**, and
**zero `reconciliation_required` holds**. The Stripe Events list API only
returns events from roughly the past 30 days; a missing older event in that
listing is **not** proof of webhook non-delivery. A current Vercel READY
deployment also does not identify the Cloudflare Worker version.

**Next evidence, no side effects:** For the exact paid session, inspect
Stripe Dashboard delivery attempts for the canonical endpoint separately
from other destinations; obtain the deployed Cloudflare Worker revision and
redacted request/runtime evidence; then match the signed delivery to a
persisted session-specific grant and usable product access. Do not disable,
reroute, replay, resend, or consolidate any endpoint on this evidence alone.
Multiple subscribed destinations do not by themselves prove duplicate grants.
Any change to destination ownership or economic handling requires owner review.

## Per-session operator decision (not an automated replay)

1. **Identify and authenticate the payment from Stripe live read-only data.**
   Retrieve the Checkout Session by its exact `session_id` from the durable
   hold, then inspect payment status, mode, amount, currency, livemode,
   actual line-item price, payment intent/charge, refund/dispute state and
   customer identity. Never use a claimed email from a CRM lead as proof
   that it belongs to the payer. If Stripe lacks a defensible identity
   mapping, keep the hold and request an owner-approved resolution; do not
   invent or assign an account.
2. **Verify the intended entitlement separately.** Read
   `public.profiles.last_grant_session_id`, `generations_limit`,
   `generations_used` and plan/status for the *verified* profile in a
   restricted operator session. Confirm the actual product feature is usable
   and the grant matches the paid price. `public.subscriptions` is a
   legacy/admin model, not the live credit authority. A matching marker
   alone, a webhook HTTP 200, a green CI check, and Vercel READY are each
   insufficient to prove working fulfillment.
3. **Classify without side effects.** Record one of:
   `paid_identity_missing`, `paid_grant_missing`,
   `paid_grant_verified`, `payment_not_paid`, or
   `payment_ambiguous`. Keep the source event/session references in
   restricted evidence storage, with only aggregate counts in public notes.
   Do not count zero-total checkouts, founder smoke payments, failed charges,
   or expired sessions as independent customers.
4. **If a paid grant is missing, STOP for owner review.** An approved
   recovery implementation must re-verify payment and identity, acquire a
   session-level idempotency guard, use the existing compare-and-swap
   provisioning semantics, verify the persisted grant, and log one auditable
   outcome. This document does **not** authorize SQL UPDATE/INSERT,
   manual credit adjustment, Stripe resend, webhook replay, backfill,
   customer messaging, refund, or production deployment.
5. **If already granted, do not grant again.** Preserve the event/hold
   history, attach proof of the original grant, and have an owner-approved
   reconciliation procedure resolve the hold without another side effect.

## Release proof required before removing HOLD

- Owner reviews #2124 and the separate Cloudflare edge-router publish
  proposal #2115; both remain draft/hold. Confirm the actual deployed
  `authichain-edge-router` commit and runtime bindings. A Vercel production
  commit does not identify the Cloudflare webhook Worker revision.
- Non-production tests cover missing identity, profile write failure,
  duplicate event, pre-existing session grant, recoverable retry and
  concurrent deliveries. Mocked signed-handler tests alone are **not**
  cryptographic proof of a genuine signed webhook.
- Verify the *actual* signed test delivery, persistent hold, idempotent
  grant, and product access in an authorized non-production environment.
  An HTTP 200 for a hold must remain `handled:false`; do not represent it
  as a completed customer order.
- Independently reconcile live Stripe paid charges and subscriptions with
  customer identity, non-founder status, grants, and renewal invoices.
  First milestone requires **three independent paying customers actually
  fulfilled plus one genuine recurring renewal**. No fabricated revenue
  attribution or manual row insertion can satisfy it.

**Guardrails:** Preserve `humanHold`, `production_send=false`,
webhook signature verification, `fulfillDppPaidSession`, CODEOWNERS,
existing Cloudflare deployment restrictions and all economic/held PRs.
No direct main push, merge, deployment, live payment, production DDL,
secret change, outbound send or automatic retry is authorized here.

**Related:** #1986, #2108, #2114, #2115, #2122, #2124;
`docs/CREDIT_MODEL_ARCHITECTURE.md`,
`docs/RECOVERY_AND_RECONCILIATION.md`.
