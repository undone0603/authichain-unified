# Pricing Reconciliation — Design Spec

**Date:** 2026-04-28
**Status:** Drafted, pending user review
**Drives:** First-pass implementation plan to be written by `superpowers:writing-plans` after approval.

---

## Background

The codebase has **five disagreeing pricing definitions**, plus pre-existing assets (Service Agreement template at $2,500 setup + $499/mo, dated 2026-04-10) found in OneDrive/Drive that were never reconciled with code. No live customers are on subscription pricing today, so this is a clean cutover, not a migration of paying users.

| Source | Pricing | Notes |
|---|---|---|
| `server/stripe-products.ts` | $49 / $199 / $799 monthly, quotas 500 / 5K / unlimited | Code |
| `shared/subscriptionPlans.ts` | $49 / $199 / $799 monthly, quotas 100 / 2.5K / 25K | Code (different quotas) |
| `client/src/pages/Pricing.tsx` | $199 / $499 / $999 monthly, StrainChain-themed | Code |
| AuthiChain Service Agreement (signed-ready, 2026-04-10) | $2,500 setup + $499/mo + $0.01/call over 10K | Customer-facing contract |
| QRON 90-day plan (Dec 2025) | $39 pack / $49/mo / $99/mo | QRON brand only |

The user has cinematic landing pages live for **four brands** (AuthiChain, Qron, GovChain, StrainChain), so the schema needs to accept brand attribution without forcing per-brand product duplication.

---

## Goal

One source of truth in `shared/pricing.ts`. Two product clusters reflecting two distinct buyer profiles (B2B brand-protection vs QRON SMB self-serve). One canonical Stripe product set (7 products). One contract-pilot path that reuses existing service-order infrastructure. Webhook plan detection upgraded from fragile string-match to lookup table.

Out of scope: per-brand quota differentiation, new webhook event handlers, churn migration (no live customers).

---

## Pricing model — Approach 3: two-cluster, two-track

### B2B cluster (AuthiChain + StrainChain + GovChain)

Same SKUs across all three brands. Brand stored as Stripe checkout `metadata.brand`, propagated to `revenue_records.metadata.brand`.

| Tier | Monthly | Quota (auths/mo) | Stripe product name |
|---|---|---|---|
| Starter | $199 | 500 | `b2b_starter` |
| Professional | $499 | 10,000 | `b2b_professional` |
| Enterprise | $999 | 25,000 | `b2b_enterprise` |

The Professional tier quota is raised from 5K → 10K to match the existing Service Agreement's 10K-call allowance. This makes the contract track reuse `b2b_professional` cleanly with no quota override logic.

### QRON cluster (qron.space SMB)

Different buyer (small businesses, single dispensaries, artisans), different unit (QR portal generations, not authentications).

| Tier | Price | Quota | Stripe product name |
|---|---|---|---|
| Launch Pack | $39 one-time | 3 portals | `qron_launch_pack` |
| Studio | $49/mo | 20 generations/mo | `qron_studio` |
| Studio Pro | $99/mo | Unlimited generations + analytics | `qron_studio_pro` |

### Contract track

Sold via signed Service Agreement PDF, two transactions:

| Component | Price | Stripe product | Mechanism |
|---|---|---|---|
| Implementation/setup | $2,500 one-time | `contract_setup` (new service-order catalog entry) | Routes through existing `server/services/` order flow. Webhook already marks paid + triggers fulfillment. |
| Monthly recurring | $499/mo | Reuses `b2b_professional` | Subscription created with `metadata.contract = true` and `metadata.setupOrderId = <service_order_id>` to flag contract-origin. |

**Total Stripe products: 7** (3 B2B + 3 QRON + 1 contract setup).

---

## Single source of truth — `shared/pricing.ts`

```ts
export const B2B_PLANS = {
  starter:      { product: "b2b_starter",      monthlyCents: 19_900, quota:    500 },
  professional: { product: "b2b_professional", monthlyCents: 49_900, quota: 10_000 },
  enterprise:   { product: "b2b_enterprise",   monthlyCents: 99_900, quota: 25_000 },
} as const;

export const QRON_PLANS = {
  launch_pack: { product: "qron_launch_pack", oneTimeCents: 3_900, portals: 3 },
  studio:      { product: "qron_studio",      monthlyCents: 4_900, generationsPerMonth: 20 },
  studio_pro:  { product: "qron_studio_pro",  monthlyCents: 9_900, generationsPerMonth: -1 /* unlimited */ },
} as const;

export const CONTRACT = {
  setupProduct: "contract_setup",
  setupCents: 250_000,
  recurringPlan: "professional" as const,
} as const;

export const B2B_BRANDS = ["authichain", "strainchain", "govchain"] as const;
export type B2BBrand = (typeof B2B_BRANDS)[number];
export type B2BPlanKey = keyof typeof B2B_PLANS;
export type QronPlanKey = keyof typeof QRON_PLANS;

/** Populated AFTER Stripe products are created. Webhook reads this for plan detection. */
export const STRIPE_PRICE_TO_PLAN: Record<string, B2BPlanKey | QronPlanKey | "contract_setup"> = {
  // e.g. "price_1ABC...": "professional"
};
```

### Files affected

| File | Action |
|---|---|
| `shared/pricing.ts` | **CREATE** — content above |
| `server/stripe-products.ts` | **DELETE** — logic absorbed into `shared/pricing.ts`; update all imports |
| `shared/subscriptionPlans.ts` | **DELETE** — drift-y duplicate; update all imports |
| `client/src/pages/Pricing.tsx` | **REWRITE** — read from `shared/pricing.ts`; switch B2B vs QRON view based on Host header (`authichain.com` / `strainchain.io` / `govchain.us` → B2B view; `qron.space` → QRON view) |
| `server/webhooks/stripe.ts` | **EDIT** — replace `priceId.toLowerCase().includes("starter")` with `STRIPE_PRICE_TO_PLAN[priceId] ?? "starter"` |
| `server/subscriptions/router.ts` | **EDIT** — `checkout` mutation gains optional `brand?: B2BBrand` input, threads to Stripe `metadata.brand` |
| `server/stripe-service.ts` | **EDIT** — `CreateCheckoutParams` gains `brand?` and `contractSetupOrderId?`; sets `metadata.brand` and `metadata.contract`/`metadata.setupOrderId` on session |
| `server/services/` (catalog) | **EDIT** — add `contract_setup` ($2,500) entry. Productized services already exist for $99/$250/$299/$499/$2,500; add the contract setup as a sibling. |

---

## Checkout paths (no new infrastructure)

1. **Self-serve recurring** — `subscriptions.checkout` tRPC mutation, already deployed.
   - Input now includes optional `brand?: "authichain" | "strainchain" | "govchain"` for B2B (omitted for QRON).
   - Stripe Checkout Session sets `metadata.brand` so revenue dashboards can split by brand.

2. **Self-serve one-time** (QRON Launch Pack $39) — existing `services.checkout` path; add `qron_launch_pack` to service catalog as a $39 service-order item.

3. **Contract pilot** — two-step:
   - Step A: User signs Service Agreement PDF → operator creates a `service_orders` row for `contract_setup` ($2,500) → buyer pays via `services.checkout` → webhook marks paid (existing flow).
   - Step B: After setup payment confirmed, operator creates a `b2b_professional` subscription via `subscriptions.checkout` with `metadata: { contract: "true", setupOrderId: "<uuid>" }`.

   Step B is operator-triggered today; can be auto-triggered after `service_orders.status = paid` in a follow-up plan.

---

## Webhook changes

`server/webhooks/stripe.ts` already handles all required events (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.{created,updated,deleted}`). Two changes only:

1. **Plan detection.** Replace string-match in `detectPlanFromPriceId()`:
   ```ts
   // before
   if (priceId.toLowerCase().includes("starter")) return "starter";
   // after
   const known = STRIPE_PRICE_TO_PLAN[priceId];
   if (known) return known;
   // fall through to amount-based detection as fallback
   ```

2. **Metadata propagation.** Read `metadata.brand` and `metadata.contract` from the Stripe session/subscription and stamp them on `revenue_records.metadata` so dashboards can split revenue by brand and by contract-vs-self-serve origin.

---

## Migration

| Concern | Plan |
|---|---|
| Live paying customers | None today (per Phase-0 audit). Clean cutover. |
| Stale Stripe products | Recreate via adapted `stripe-setup.js` (asset in Drive). New products use names from this spec. Old products archive in Stripe (don't delete — past test charges still reference them). |
| Existing `subscriptions` table rows | Audit — any test rows get archived or marked `legacy: true` in metadata. |
| Webhook backwards compatibility | `STRIPE_PRICE_TO_PLAN` lookup includes legacy IDs of any test subscriptions that need correct resolution during the brief cutover window. |
| Service catalog (`$99/$250/$299/$499/$2,500`) | Untouched. ADD `contract_setup` ($2,500) as a sibling entry. |
| HubSpot CRM | No schema changes — contacts/deals are price-agnostic. |

---

## Risks

| Risk | Mitigation |
|---|---|
| New Stripe price IDs don't contain "starter"/"pro"/"enterprise" substrings → webhook plan detection fails on legacy code path | Lookup table ships *before* new products go live. Falls back to amount-based detection (already exists) if ID unknown. |
| Brand attribution missing on legacy checkouts | `metadata.brand` is optional; revenue records without it default to `"unknown"` and are visible in dashboards as such. |
| Quota-per-brand divergence in future (e.g. GovChain wants higher base quotas) | Schema is brand-aware; quota lookup can become brand-specific in a future spec. YAGNI today. |
| Operator forgets Step B of contract path | Add a follow-up plan for auto-trigger when `service_orders.status = paid` AND `service_orders.product = contract_setup`. Out of scope here. |

---

## Success criteria

- One file (`shared/pricing.ts`) is the only place where prices, quotas, and Stripe product names live.
- `pnpm check` passes after migration.
- A test checkout for each of: B2B Starter, B2B Professional with brand=`strainchain`, QRON Studio, contract setup ($2,500 service order) results in a correctly classified row in `revenue_records` with `metadata.brand` and `metadata.contract` populated where applicable.
- Webhook plan detection works on a price ID with no plan-name substring (proves the lookup table is what's actually consulted).
- `client/src/pages/Pricing.tsx` renders different SKUs based on host header.

---

## Out of scope

- Auto-trigger contract Step B on Step A payment.
- Per-brand quota differentiation in B2B cluster.
- Pricing page A/B testing.
- Currency/region pricing.
- Trial-period plumbing.
- Bulk-discount or annual billing toggle (annual already partially exists; not in this spec).
