# Autonomous DPP Revenue Loop

**Owner:** AuthiChain revenue path  
**Offer:** EU DPP Readiness Audit — $299 one-time  
**Primary objective:** attributed traffic → paid checkout → automatic provisioning → activated merchant → measurable retention.

## Operating rule

Do not add agents or new verticals until this loop produces a green end-to-end smoke result. Humans handle exceptions, not routine fulfillment.

## Event contract

| Event | Meaning | Required evidence |
|---|---|---|
| `attributed_visit` | Buyer reaches `/dpp` with campaign/referrer context | UTM/referrer + timestamp |
| `checkout_started` | Buyer enters Stripe checkout | stable client reference |
| `payment_succeeded` | Stripe confirms payment | Stripe event/session ID |
| `provisioned` | Buyer receives usable workspace/access | merchant/profile ID |
| `merchant_activated` | Buyer completes first meaningful setup action | activation event |
| `dpp_published` | First DPP is published | DPP/object ID |
| `verification` | Product/DPP is successfully verified | verification/scan event |
| `retained` | Buyer returns for meaningful usage at retention horizon | dated usage event |

## State machine

```text
attributed_visit
      ↓
checkout_started
      ↓
payment_succeeded
      ↓
provisioned
      ↓
merchant_activated
      ↓
dpp_published
      ↓
verification
      ↓
retained
```

A state must be derived from an observable event, never inferred from an email being sent or a page being viewed.

## Automation policy

1. Stripe payment events are authoritative for money.
2. Every webhook is idempotent by event/session identifier.
3. Provisioning is idempotent by buyer identity and offer.
4. Transient fulfillment failures retry automatically with a bounded retry budget.
5. Failed retries create an exception record and founder alert.
6. Email/CRM failure must not roll back a successful payment or provisioning result.
7. Daily reporting exposes both funnel counts and unresolved exceptions.

## Smoke path

Use the existing `DPP-SMOKE-E2E` promotion for a no-cost end-to-end test. The smoke run must prove:

- attribution survives into the Stripe session/reference;
- `checkout.session.completed` is accepted and deduplicated;
- provisioning creates/resolves the buyer exactly once;
- activation can be completed without operator intervention;
- first DPP publication and verification are recorded;
- the daily report contains the complete event chain;
- a forced transient failure retries and a forced terminal failure escalates.

## Current implementation anchors

- `workers/authichain-com`: DPP landing surface.
- `workers/dpp-fulfillment`: Stripe fulfillment, onboarding, CRM, recovery, and daily report.
- `src/lib/provisioning.ts`: shared paid-checkout provisioning for authenticated and guest buyers.
- `src/app/api/stripe/webhook/route.ts`: canonical application Stripe webhook/provisioning path.

## Success metric

The system is green when a single test buyer can move through the complete state machine without a human handoff. Production success is then measured by conversion from each state to the next, not by agent count or feature count.
