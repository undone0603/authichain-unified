# Autonomous Revenue Forecast & Money-Path Predictions

**Date:** 2026-06-19
**Branch:** `claude/keen-cray-txdaso` (PR #344)
**Status:** Money path code-complete; revenue gated only on Stripe meter provisioning + outreach send.

> ⚠️ These are **model-based projections** grounded in the live pricing constants in
> the codebase (`src/lib/industrial/billing.ts`, `src/lib/plans.ts`,
> `src/lib/stripe-provisioning.ts`). They are planning estimates, not guarantees.
> Every input assumption is stated so the model is reproducible and tunable.

---

## 1. The Money Path (end-to-end, what's live)

```
Partner discovery (AI catalog / llms.txt / outreach email)
        │
        ▼
POST /api/checkout  ──────────────►  Stripe Checkout (verify metered plan)
        │                                   │
        │                            payment.succeeded
        ▼                                   ▼
POST /api/stripe/webhook  ────►  profiles.stripe_customer_id + tier set
        │
        ▼
Partner calls POST /api/v1/verify  (Bearer qron_ key)
        │
        ▼
reportAgentUsage(userId, 'verify_product')
        │
        ▼
stripe.billing.meterEvents.create({ event_name, customer, value })
        │
        ▼
Stripe aggregates meter events ──►  monthly invoice closes  ──►  💵 cash
```

**Live today:** checkout route, webhook, meter-event emission, API-key lifecycle
(`/api/keys`), outreach generator (`/api/v1/outreach`), edge gateway with caching +
rate limiting.

**One gate before first dollar can flow (≈5 min):**
1. Run `provisionStripeForVerifyAPI(STRIPE_SECRET_KEY)` → returns `priceId`.
2. Set `STRIPE_VERIFY_METERED_PRICE_ID=<priceId>` in env.
3. From that point the path is fully autonomous: onboard → usage → invoice → cash,
   with **no manual billing intervention** per transaction.

---

## 2. Unit Economics (from real pricing constants)

### Metered per-call pricing (`METERED_PRICING`, billing.ts)
| Action | Units | Price/call |
|--------|-------|-----------|
| `verify_product` | 1 | **$0.05** |
| `register_product` | 10 | **$0.50** |
| `check_eu_dpp` | 100 | **$5.00** |
| `mint_certificate` | 20 | **$1.00** |

### Blended monthly ARPU by partner segment
Modeling a realistic action mix per active partner:

| Segment | verify | register | eu_dpp | mint | **Blended MRR** |
|---------|--------|----------|--------|------|-----------------|
| **Pilot** | 5,000 ($250) | — | — | — | **~$250** |
| **Mid-market** | 10,000 ($500) | 400 ($200) | 40 ($200) | 100 ($100) | **~$1,000** |
| **Enterprise** | 50,000 ($2,500) | 2,000 ($1,000) | 200 ($1,000) | 500 ($500) | **~$5,000** |

### Subscription plans (`plans.ts`, live Stripe price IDs)
| Plan | Price | Type |
|------|-------|------|
| Starter / Creator / Studio | $29 / $99 / $249 | one-time credit packs |
| Business | **$299/mo** | recurring |
| Theater 1 (AgTech) | **$499/mo** | recurring |
| Theater 3 (Elite) | **$1,499/mo** | recurring |

---

## 3. Acquisition Funnel (outreach machinery)

The outreach generator produces vertical-specific emails for manufacturing,
supply-chain, compliance, and federal. Funnel assumptions per scenario:

| Stage | Conservative | Base | Aggressive |
|-------|-------------|------|------------|
| Emails sent (90d) | 200 | 500 | 1,500 |
| Reply/demo rate | 8% | 12% | 15% |
| Demo→close rate | 25% | 30% | 35% |
| **Paying partners (90d)** | **4** | **~18** | **~78** |

---

## 4. Revenue Scenarios

### 90-Day Exit MRR

**Conservative**
- 3 pilot ($250) + 1 mid ($1,000) = $1,750 metered
- 2 × Theater 1 ($499) = $998 subscription
- **Exit MRR ≈ $2,750  →  ~$33k ARR run-rate**

**Base**
- 10 pilot ($2,500) + 6 mid ($6,000) + 2 enterprise ($10,000) = $18,500 metered
- ~5 subscriptions (Theater/Business mix) ≈ $2,500
- **Exit MRR ≈ $21,000  →  ~$252k ARR run-rate**

**Aggressive**
- Heavier enterprise mix across ~78 partners
- **Exit MRR ≈ $60k–$80k  →  ~$720k–$960k ARR run-rate**

### 12-Month Trajectory (Base case)

Cohort model: ramping net-adds (2→12/mo), blended new-partner ARPU ~$1,200/mo,
5%/mo logo churn, ~110% net revenue retention from usage expansion.

| Month | Net new paying | Cumulative active | **MRR** |
|-------|---------------:|------------------:|--------:|
| M1 | 2 | 2 | ~$2.4k |
| M3 | 6 | 12 | ~$15k |
| M6 | 12 | 45 | ~$58k |
| M9 | 12 | 80 | ~$104k |
| M12 | 12 | 110 | **~$145k MRR → ~$1.7M ARR run-rate** |

> Expansion (110% NRR) is the dominant lever after M6: metered usage grows with each
> partner's own volume, so MRR compounds even at flat logo count.

---

## 5. Sensitivities (what moves the number most)

1. **Action mix > call volume.** A single `check_eu_dpp` ($5) = 100 `verify` calls.
   Pushing partners toward DPP/compliance checks multiplies ARPU ~10–20×.
2. **Enterprise concentration.** One enterprise partner ($5k) = 20 pilots. Closing 2–3
   enterprise/federal logos changes the curve more than 50 pilots.
3. **Time-to-first-invoice.** Stripe meters aggregate to a monthly close, so the first
   cash lands at the first invoice boundary after the first paying partner — provision
   the meter now to start that clock.
4. **Churn floor.** Metered (pay-per-use) churn is structurally low; partners only pay
   for value received, so the typical "did not renew" failure mode is muted.

---

## 6. Immediate Actions to Realize Revenue

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 1 | Merge PR #344 | — | now |
| 2 | `provisionStripeForVerifyAPI()` → set `STRIPE_VERIFY_METERED_PRICE_ID` | ops | ~5 min |
| 3 | Generate + send first 200 outreach emails via `/api/v1/outreach` | growth | day 1 |
| 4 | Confirm `/api/stripe/webhook` is registered in Stripe dashboard | ops | ~5 min |
| 5 | End-to-end smoke: sign up → key → verify → meter event → invoice | eng | ~30 min |

Once #2 and #4 are done, the money path is **autonomous**: every onboarded partner
generates metered revenue with zero per-transaction human involvement.
