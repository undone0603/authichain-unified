# Autonomous DPP Revenue Loop

**Owner:** AuthiChain revenue path  
**Offer:** EU DPP Readiness Audit — $299 one-time  
**Primary objective:** attributed traffic → paid checkout → automatic provisioning → activated merchant → measurable retention.

## Operating rule

Do not add agents or new verticals until this loop produces a green end-to-end smoke result. Humans handle exceptions, not routine fulfillment.

## Event contract

| Event                | Meaning                                                 | Required evidence        |
| -------------------- | ------------------------------------------------------- | ------------------------ |
| `attributed_visit`   | Buyer reaches `/dpp` with campaign/referrer context     | UTM/referrer + timestamp |
| `checkout_started`   | Buyer enters Stripe checkout                            | stable client reference  |
| `payment_succeeded`  | Stripe confirms payment                                 | Stripe event/session ID  |
| `provisioned`        | Buyer receives usable workspace/access                  | merchant/profile ID      |
| `merchant_activated` | Buyer completes first meaningful setup action           | activation event         |
| `dpp_published`      | First DPP is published                                  | DPP/object ID            |
| `verification`       | Product/DPP is successfully verified                    | verification/scan event  |
| `retained`           | Buyer returns for meaningful usage at retention horizon | dated usage event        |

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
   Founder exceptions start at `payment_succeeded`. `attributed_visit` and
   `checkout_started` are bounce/abandon funnel counts. Demo rows
   (`metadata.is_demo`) are excluded from customer counts.
   Endpoint: `GET /api/cron/dpp-exceptions` (Bearer `CRON_SECRET`), dispatched
   as `dpp-exceptions` on `autonomous-business-cycle.yml`. The workflow's
   schedule is retired; dispatch it (or a Worker cron) for a daily report —
   an unscheduled route is a page, not a loop.

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

- `workers/authichain-com`: DPP landing surface (`/dpp`) with attributed CTA → `/api/checkout/dpp`. Thanks/activate HTML is served here. Checkout, funnel, webhook, and activate POST fall through to `APP_PREFIXES` → `APP_WORKER`.
- `src/app/api/checkout/dpp/route.ts`: creates attributed Stripe Checkout Session (`client_reference_id` + offer metadata); allows `DPP-SMOKE-E2E`.
- `src/app/api/stripe/webhook/route.ts`: canonical payment → `provisionPurchase` → DPP activate email.
- `src/app/dpp/thanks` + `src/app/dpp/activate` + `src/app/api/dpp/activate`: self-serve merchant activation (no human handoff).
- `src/lib/dpp-loop.ts`: records observable loop stages onto `funnel_events` (`metadata.loop_stage`); `stallOf` / `summarizeDppLoop` reconstruct stalls without inferring missing stages.
- `src/app/api/cron/dpp-exceptions`: paginated exception report (no `limit(5000)` cap). The same exceptions print in `scripts/revenue-cycle.ts --phase=report` (inline — do not HTTP the marketing worker).
- `workers/dpp-fulfillment`: CRM / recovery / daily report only — not the access-grant path.

## Success metric

The system is green when a single test buyer can move through the complete state machine without a human handoff. Production success is then measured by conversion from each state to the next, not by agent count or feature count.
