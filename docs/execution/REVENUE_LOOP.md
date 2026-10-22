# Revenue loop

Written 2026-10-22 (NEXT_ACTIONS N-9). Read from the code of `main` at `caf0f083`; nothing here was run against Stripe, Supabase or a live site. There are no revenue, conversion or volume figures in this document on purpose: none were available to the author, and none are inferred.

Where the code and a comment disagree, the code is quoted and the disagreement is listed in "Open questions". A statement marked **(code)** was read in the file named next to it; a statement marked **(not verified)** needs the sandbox test in N-4 or a look at the live Stripe and Supabase settings.

## 1. The loop in one picture

```
pricing page / llms.txt / sitemap
        |
        v
POST /api/checkout  (src/app/api/checkout/route.ts)      returns { url }, never a Stripe session
        |
        v
GET  https://authichain.com/checkout/<planId>            confirm page; GET never calls Stripe
POST https://authichain.com/checkout/<planId>            gate checks, then Stripe session, then 303
        |                                                (workers/authichain-com -> src/lib/checkout-gate.ts)
        v
Stripe Checkout (hosted)
        |
        +--> success_url: /generate?paid=1 | /dpp/thanks | /made-in-usa-claim-file/thanks
        |
        +--> webhook rail A: POST /api/stripe/webhook      (src/app/api/stripe/webhook/route.ts)
        +--> webhook rail B: workers/stripe-webhook        (grant-map.ts GRANT_BY_PRICE)
                |
                v
        public.profiles: plan, generations_limit, generations_used, last_grant_session_id, ...
                |
                v
POST /api/generate  (credit check, image, credit spend)
```

Agents do not use this loop. They pay per call over x402 (section 6).

## 2. What is for sale

`src/lib/plans.ts` is the source of truth for anything that charges a human (CLAUDE.md working notes). Amounts and credit counts below are from `PLANS` and `PLAN_CREDITS`. Price ids are not copied here; read them in `plans.ts`. "Public" means the id is in `PUBLIC_PLAN_IDS` and the plan is not `listed: false` (the test `listedPlans` applies); it says nothing about whether the checkout gate lets a buyer finish.

| Plan id                | Price (USD)          | Stripe mode  | Credits on grant    | Public | Worker rail (`GRANT_BY_PRICE`)          |
| ---------------------- | -------------------- | ------------ | ------------------- | ------ | --------------------------------------- |
| `free`                 | 0                    | none         | 5 free samples      | yes    | not a Stripe plan                       |
| `starter`              | 29 once              | payment      | 100                 | yes    | grants 100, `refillOnInvoicePaid` no    |
| `creator`              | 99 once              | payment      | 500                 | yes    | grants 500, no refill                   |
| `qron_launch`          | 19 per month         | subscription | 100 per month       | yes    | grants 100, refills on `invoice.paid`   |
| `qron_launch_annual`   | 190 per year         | subscription | 1,200               | yes    | grants 1,200, refills on `invoice.paid` |
| `dpp_readiness`        | 299 once             | payment      | 50 (Next rail)      | yes    | `humanHold`, 0 generations              |
| `strainchain_passport` | 49 once              | payment      | 0                   | yes    | `humanHold`                             |
| `strainchain_farm`     | 149 per month        | subscription | 0                   | no     | `humanHold`                             |
| `musa_claim_file`      | 299 per SKU          | payment      | 0                   | yes    | `humanHold`                             |
| `musa_audit_bundle`    | 2,500 per engagement | payment      | 0                   | yes    | `humanHold`                             |
| `theater_1`            | 499 per month        | subscription | 5,000               | no     | **no entry**                            |
| `theater_3`            | 1,499 per month      | subscription | 999,999 (unlimited) | no     | **no entry**                            |

**(code)** `PLAN_CREDITS` and `PLAN_TIER` also name `studio` (2,000), `business` (999,999) and `enterprise_compliance` (0), but `PLANS` has no entry for them, so the gate has nothing to sell. This document does not cover them.

**(code)** `qron_launch` has `listed: true` and a live checkout link, but the checkout gate refuses it (section 7). The decision of 2026-10-22 is that monthly Launch stays closed.

### What "humanHold" means

**(code, `workers/stripe-webhook/src/grant-map.ts`)** "humanHold: payment is recorded, no generations, no certificate. A hold is not delivery. Founder still has to produce the file."

The held products are the DPP workspace, the passport, the Farm subscription and both MUSA products. A paid session for one of them records the plan on the profile (Worker rail) or opens a workspace (Next rail, DPP only). It does not produce the passport, the claim file or the audit. A person produces those, and nothing in the code proves they were produced.

`dpp_readiness` is described in `plans.ts` and `dpp-fulfill-checkout.ts` as a workspace with 50 generations, "not an audit, not a certification".

## 3. Entry: `POST /api/checkout`

**(code, `src/app/api/checkout/route.ts`)**

- Body: `planId` (required), `email`, `affiliateCode`, `prospectId`, `source`. Invalid JSON, a missing `planId`, an unknown plan and the free plan (no price id) each return 400.
- It builds `https://authichain.com/checkout/<planId>` and appends `email`, `affiliate_code` (only if it matches `^[A-Za-z0-9_-]{1,64}$`; falls back to the `aff_ref` cookie), `prospect_id` and `source`. It returns `{ url }` with `Cache-Control: private, no-store`.
- It does **not** create a Stripe session and does not check whether a plan is listed or closed.

`src/lib/plan-checkout.ts` (`createPlanCheckoutSession`) is a second implementation that creates a Stripe session directly. **(code)** A search of `src`, `workers` and `server` finds no caller outside its own test file. Its header says it serves "POST /api/checkout on the edge worker"; in this tree nothing does. It has no QRON gate. See open question Q-6.

## 4. The checkout gate

**(code, `src/lib/checkout-gate.ts`, mounted by `workers/authichain-com/src/index.ts` through `tryHandleGatedCheckout`)**

| Step    | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | Renders the confirm page. Never calls Stripe, so link prefetchers and crawlers cannot create sessions.                                                                                                                                                                                                                                                                                                                                            |
| POST    | Validates bot signals, prefetch headers, origin, honeypot field and email. Rejections return an HTML page with an error status.                                                                                                                                                                                                                                                                                                                   |
| QRON    | For `qron_launch` only: without a `qron_attestation` field that starts with `QRON-`, returns 403 "QRON Interdiction: Valid physical attestation token required".                                                                                                                                                                                                                                                                                  |
| Claim   | `claimCheckoutAttempt` calls the Supabase function `claim_gated_checkout` with the checkout key, a SHA-256 of the email, a SHA-256 of the client IP (or of the email when no IP header exists) and the plan. A refusal whose reason contains "already" answers 409; every other refusal, and any fault or missing service key, answers 503 (it fails closed). The refusal rules live in that database function, which this document did not read. |
| Session | `POST https://api.stripe.com/v1/checkout/sessions` with an `Idempotency-Key` (the submitted `checkout_key` if it is 36 word characters, otherwise a fresh UUID) and a 15 s timeout.                                                                                                                                                                                                                                                               |
| Record  | `recordCheckoutSession` stores the session. The response is a 303 to the Stripe URL.                                                                                                                                                                                                                                                                                                                                                              |

Session metadata (also copied to `subscription_data[metadata]` for subscriptions): `plan`, `brand`, `stripe_price_id`, `prospect_id`, `visit_id`, `source`, `checkout_gate: "confirm_post"`, the DPP `offer` key for DPP, the UTM fields, `referrer`, `affiliate_code`, `ref_code`. The webhook reads `plan` and `stripe_price_id` from here.

Return pages: generation packs (`starter`, `creator`, both Launch plans) go to `/generate?paid=1`; the claim file to `/made-in-usa-claim-file/thanks`; everything else to `/dpp/thanks`. Cancel returns to `/dpp`, the claim-file page, `/generate` (Starter) or `/pricing`.

## 5. Fulfilment: two webhook rails

Two code paths receive Stripe events. **(not verified)** Which of them are registered as endpoints in the Stripe Dashboard, and in which mode, cannot be read from the repository. Every statement about "both rails" below is about what the code does if both receive the same event.

### Rail A: `POST /api/stripe/webhook` (Next app)

**(code, `src/app/api/stripe/webhook/route.ts`)**

- **Signature:** verified against two secrets.
- **Idempotency:** each event id is claimed in `stripe_events` before work starts. Outcomes: first delivery proceeds; `duplicate` is acknowledged without work; `in_progress` is not re-run; a claim older than 5 minutes is reclaimed.
- **`checkout.session.completed` and `checkout.session.async_payment_succeeded`:** an unpaid session is held and logged as `stripe_grant_held_unpaid` (no grant). A paid one resolves the plan by `metadata.plan`, then by price id, then, for Starter only, by amount (a USD $29 live-mode payment with no discount). Then `provisionPurchase`. DPP offers go through `fulfillDppPaidSession`.
- **Other events:** `invoice.paid` (marks the profile active, writes `payment_history`, credits recurring affiliate commission on `subscription_cycle` invoices, anchors renewals in the ledger; it does **not** change `generations_limit` or `generations_used`), `invoice.payment_failed` (marks `past_due`, sends the payment-failed email), `customer.subscription.deleted` (marks cancelled, plan `free`), `customer.subscription.updated` (stores the status), `customer.subscription.trial_will_end` (email), `charge.refunded` and `invoice.voided` (ledger reversal only).

**What a refund does:** it reverses the ledger entry. **(code)** Nothing in this route removes credits or access when a charge is refunded. Whether a refund should revoke credits is a policy decision that is not recorded anywhere I could find.

### `provisionPurchase` (`src/lib/provisioning.ts`)

- Finds or creates the profile (by user id, then by email). With neither, it returns `no_identity` and grants nothing.
- Grant size comes from `PLAN_CREDITS` (or an explicit amount).
- **One-time packs** (a plan in `payment` mode with no subscription id) **stack**: new limit is `max(0, limit - used) + pack`, used resets to 0. Unlimited profiles (limit 999,999 or more) are left alone. A pack bought by an active subscriber does not overwrite their plan or status.
- **Subscriptions** set the limit to the grant and reset usage to 0.
- **Idempotency:** the session id is stored in `last_grant_session_id`. A second call for the same session returns success without granting again.
- **Concurrency:** the update is conditional on the `generations_limit`, `generations_used` and `last_grant_session_id` values that were read. If another writer changed any of them, the update matches no row; it re-reads and retries up to `PROVISION_CAS_RETRIES = 3` times, then returns `upsert_failed` so Stripe redelivers.
- A failed profile read returns `upsert_failed` instead of treating the profile as ungranted.

### DPP fulfilment (`src/lib/dpp-fulfill-checkout.ts`)

For a DPP offer: record funnel stage `payment_succeeded`, begin provisioning continuity, `provisionPurchase`, finish continuity, record `provisioned`, then send the activation email. It refuses recurring checkouts. An `upsert_failed` is rethrown as a retryable error. A failed activation email does **not** throw (a retry would rerun the grant); it is logged without the address and written as a funnel row, so a paid buyer without an email is visible.

### Rail B: `workers/stripe-webhook`

**(code, `workers/stripe-webhook/src/index.ts`, `grant-map.ts`)**

- Signature check with `constructEventAsync` and one secret. Methods other than POST return 405.
- `checkout.session.completed` / `async_payment_succeeded`: looks the grant up by price id (from `metadata.stripe_price_id` or the first line item), falling back to a unique amount (only $29 maps). Upserts the profile by email. A `humanHold` plan stops there and logs `stripe_grant_human_hold`; the comment says the 50 DPP generations come from Rail A. Other plans **set** `generations_limit` to the grant and `generations_used` to 0, stamp `last_grant_session_id`, and skip if that session was already stamped. A failed read or write returns a retry response.
- `invoice.paid`: for plans with `refillOnInvoicePaid` (both Launch plans) it **sets** the grant and resets usage to 0 for the customer.
- `customer.subscription.updated|deleted` and `invoice.payment_failed` write `stripe_subscription_status`.
- It records a growth purchase event only for plans with a loop (`starter`, `dpp_readiness`, `strainchain_passport`), after the grant, so an analytics failure cannot cost credits.
- It has no event-id claim table.

## 6. Spending credits

Two implementations exist and they order the steps differently.

|                  | `src/app/api/generate/route.ts` (Next)       | `src/lib/generate-api.ts` `handleGeneratePost` (edge handler)               |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| Caller           | signed-in user only (401 otherwise)          | signed-in user, or an anonymous visitor with a free-sample claim            |
| Rate limit       | 5 requests per minute per user               | free-sample limiter for anonymous visitors                                  |
| Credit           | `deductCredit` **before** generating         | `checkCredit` before, `deductCredit` **after** a successful image           |
| Failed image     | credit already spent, no refund in this code | no credit spent                                                             |
| Failed deduction | returns 403                                  | the image is still returned; the response reports the pre-deduction balance |

**(code, `src/lib/business-tier.ts`)** `deductCredit` reads the profile and writes `generations_used = read value + 1`. That is a read-then-write without a condition, unlike the grant path. Two simultaneous generations for the same user can both read the same value and record one spend. The Next route's 5-per-minute limit narrows this and does not remove it.

**(code, `src/lib/rate-limit.ts`)** The rate limiter counts `automation_logs` rows and **fails open**: if the query errors it returns `ok: true`. The credit check does not depend on it.

**(code)** The `generate-api.ts` header says the Next route "is not mounted on authichain-edge-router", so the edge handler is the live one. **(not verified)** against the live router.

Free samples: 5 per visitor per 30 days, subject to a daily cap, failing closed when the limiter is down. Free-sample images are not attested.

## 7. Monthly Launch is closed

Decision of 2026-10-22 (BLOCKERS B-1). The reasons are in that file; the facts that matter for the loop:

- The only thing that closes `qron_launch` is the gate described in section 4, added by commit `cb3f7d2f` on 2026-10-22. The confirm page renders no `qron_attestation` field and nothing issues `QRON-` tokens (BLOCKERS B-1), so no ordinary buyer can finish monthly Launch. PR #1996 would remove the gate and stays on hold. PR #1905 ("HOLD: Unlist QRON Launch $19/mo", unmerged) records that the owner took the plan off sale on 2026-10-17; it is the route to making the public pages match.
- The plan is still `listed: true` on `main`, and these surfaces still advertise it **(code)**: the `llms.txt` generator (`workers/authichain-com/src/llms-txt.ts`) prints "QRON Launch $19/mo" with its checkout link, the sitemap in `workers/authichain-com/src/index.ts` lists `/checkout/qron_launch` at priority 0.95, and BLOCKERS B-1 lists three pages that link "Start Launch $19/mo" (`workers/_shared/estate-pricing.ts`, `workers/qron-space/src/index.ts`, `worker-app/dynamic-pages.ts`). A visitor who follows any of them reaches a 403 page.
- `POST /api/checkout` still returns a link for the plan (section 3).
- `qron_launch_annual` is not gated and is the Launch plan a buyer can finish.
- Month-two credits for a Launch subscriber arrive only through Rail B's `invoice.paid` refill (section 5). If the plan reopens, check that Rail B is registered in Stripe before the second payment.

## 8. Agents: x402

**(code, `src/lib/x402.ts`, `src/app/api/v1/agent-verify/route.ts`)** Agents pay in Base USDC. The wallet map and the "do not mix" rules are in `docs/strategy/WEB3_IDENTITY.md`; they are not repeated here.

`POST /api/v1/agent-verify` order of operations:

1. `X402_PAY_TO` unset: 503 `payments_not_configured`.
2. No payment proof: an empty body returns the 402 challenge; a malformed seal id returns 400 first.
3. Rate limit per payer: 120 per minute.
4. Structural check of the proof against the requirement.
5. Everything that can refuse runs **before** settlement: seal id parse, missing service key (503), spend-ledger read (503 if unreadable), per-payer daily cap, seal lookup (503 if the registry errors). A refused call costs the agent nothing.
6. `settlePayment` through the facilitator. In production an untrusted settlement is refused.
7. One `automation_logs` row (`workflow_name: "x402_spend"`, payload = payer) is written as the spend record. The daily cap is the row count in the last 24 hours times the price.
8. `attestSeal` decides `verified`: a row in `auth_seals` alone is not verification. The result is returned with the settlement block.

Defaults: price $0.05 (`X402_PRICE_USD`), daily cap per payer $10 (`X402_DAILY_CAP_USD`), timeout 60 s.

**(code)** `X402_PAID_VERIFY_BOUND` is `false`. The edge copies of the paid route answer 503 `registry_not_bound` as soon as a proof arrives, before settlement, so no USDC moves there. Discovery says the same. The flag is to be flipped in the same change that proves a live paid call returns 200 through the service binding. Until then the only bound implementation is the Next route above, reached through the `VERIFY_APP` binding.

`$QRON` and any governance token stay off this rail (header of `x402.ts`).

## 9. Open questions

None of these is a finding that money was lost. Each is something the code makes possible and that the sandbox test (N-4) should settle.

| ID  | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Where                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Q-1 | Which of the two webhook endpoints are registered in Stripe, in live and test mode? Everything in section 5 depends on it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Stripe Dashboard                                                                       |
| Q-2 | If both rails see a paid Starter or Creator session, whichever stamps `last_grant_session_id` first wins and the other skips. Rail B **replaces** (limit = 100, used = 0); Rail A **stacks** onto unused credits. A buyer with unused credits gets a different balance depending on the order.                                                                                                                                                                                                                                                                                                                    | `grant-map.ts` vs `provisioning.ts`                                                    |
| Q-3 | Rail B writes the profile columns `plan` and `stripe_subscription_status`. Rail A and the app read `subscription_plan` and `subscription_status`. No migration in `supabase/migrations` adds `profiles.plan` or `stripe_subscription_status` (only `subscription_plan`, in `00002`), and no migration in the tree creates the `profiles` table itself, so the live schema cannot be read from here. Do those two columns exist live, and does anything read them? If they do not, PostgREST rejects the whole update (see the comment in `provisioning.ts` about `subscribed_at`) and Rail B's grant never lands. | `workers/stripe-webhook/src/index.ts`, `src/lib/provisioning.ts`                       |
| Q-4 | Month-two Launch credits exist only in Rail B (`invoice.paid`). Rail A's `invoice.paid` does not touch credits. Rail B also has no event-id claim, so a redelivered `invoice.paid` sets usage back to 0 again.                                                                                                                                                                                                                                                                                                                                                                                                    | `workers/stripe-webhook/src/index.ts`, `src/app/api/stripe/webhook/route.ts`           |
| Q-5 | `theater_1` and `theater_3` have credits and an `enterprise` tier in `plans.ts` (Rail A can provision them) but no row in `GRANT_BY_PRICE` (Rail B ignores them). They are unlisted. Is anyone expected to buy them, and which rail should serve them?                                                                                                                                                                                                                                                                                                                                                            | `plans.ts`, `grant-map.ts`                                                             |
| Q-6 | `createPlanCheckoutSession` has no caller and no QRON gate. If something is later wired to it, `qron_launch` becomes purchasable again without the gate. Delete it or give it the same gate.                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/lib/plan-checkout.ts`                                                             |
| Q-7 | Should a refund revoke credits or access? The code only reverses the ledger entry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `src/app/api/stripe/webhook/route.ts`                                                  |
| Q-8 | The two `/generate` implementations spend credits in opposite order, and `deductCredit` is an unconditional read-then-write. Which one is live, and should it use the conditional-write pattern from `provisionPurchase`?                                                                                                                                                                                                                                                                                                                                                                                         | `src/app/api/generate/route.ts`, `src/lib/generate-api.ts`, `src/lib/business-tier.ts` |
| Q-9 | Who produces the held deliverables (passport, claim file, audit, Farm service), how is a held purchase surfaced to that person, and where is "delivered" recorded? The code records payment only.                                                                                                                                                                                                                                                                                                                                                                                                                 | `grant-map.ts` `humanHold`                                                             |

## 10. How to check this in the sandbox (N-4)

Use Stripe test mode and a throwaway Supabase project or branch. No live money.

1. Create a Starter session through `/checkout/starter`; confirm one session, one `Idempotency-Key`, one `claimCheckoutAttempt` row.
2. Replay the same POST with the same `checkout_key`; expect 409.
3. Complete the payment with a test card; deliver `checkout.session.completed` to each registered endpoint, then deliver it again; compare `generations_limit`, `generations_used` and `last_grant_session_id` after each step (Q-2).
4. Send a request with a bad signature and one with no signature to each endpoint; expect 400.
5. For a Launch subscription in test mode, deliver `invoice.paid` for month two and compare balances (Q-4).
6. Check `public.profiles` for a `plan` column (Q-3).
7. Run `POST /api/v1/agent-verify` with no proof (402), with a bad proof (402) and over the daily cap (402); none should write an `x402_spend` row.

Record the result in `VERIFICATION_EVIDENCE.md` with the date, mode and event ids.
