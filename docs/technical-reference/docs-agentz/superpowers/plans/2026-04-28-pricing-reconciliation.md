# Pricing Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3 disagreeing pricing files with one source of truth in `shared/pricing.ts`, implement two-cluster two-track pricing (B2B + QRON, self-serve + contract), and upgrade the Stripe webhook plan detection from string-match to lookup table.

**Architecture:** Single typed pricing module under `shared/`, consumed by both client (`client/src/pages/Pricing.tsx`, `client/src/pages/Subscriptions.tsx`) and server (`server/stripe-service.ts`, `server/webhooks/stripe.ts`, `server/subscriptions/router.ts`). Brand attribution flows via Stripe checkout `metadata.brand`; contract origin via `metadata.contract` + `metadata.setupOrderId`. Reuses existing `service_orders` infrastructure for the $2,500 contract setup fee.

**Tech Stack:** TypeScript strict mode, Vitest 3.2.4, tRPC, Stripe SDK, Drizzle ORM. Path alias `@shared/*` resolves to `./shared/*`.

**Spec:** `docs/superpowers/specs/2026-04-28-pricing-reconciliation-design.md`

**Existing consumers to migrate (audited):**
- `server/stripe-service.ts:6` — imports `STRIPE_PRODUCTS, PlanKey, getPlanQuota` from `./stripe-products`
- `server/webhooks/stripe.ts:28` — imports `getPlanQuota` from `../stripe-products`
- `server/subscriptions/router.ts:6` — imports `SUBSCRIPTION_PLANS` from `@shared/subscriptionPlans`
- `client/src/pages/Subscriptions.tsx:7` — imports `SUBSCRIPTION_PLANS, PlanKey` from `@shared/subscriptionPlans`
- `.github-staging/webhooks/stripe.ts:27` — staging copy; resolved in Task 9

---

## Task 1: Create `shared/pricing.ts` with schema, helpers, and tests

**Files:**
- Create: `shared/pricing.ts`
- Create: `shared/pricing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `shared/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  B2B_PLANS,
  QRON_PLANS,
  CONTRACT,
  B2B_BRANDS,
  STRIPE_PRICE_TO_PLAN,
  getPlanQuota,
  lookupPlanByPriceId,
  getMonthlyAmountCents,
  getAnnualAmountCents,
  type B2BPlanKey,
} from "./pricing";

describe("B2B_PLANS", () => {
  it("has three tiers at the agreed prices", () => {
    expect(B2B_PLANS.starter.monthlyCents).toBe(19_900);
    expect(B2B_PLANS.professional.monthlyCents).toBe(49_900);
    expect(B2B_PLANS.enterprise.monthlyCents).toBe(99_900);
  });

  it("has the agreed quotas (Professional bumped to 10K to match contract track)", () => {
    expect(B2B_PLANS.starter.quota).toBe(500);
    expect(B2B_PLANS.professional.quota).toBe(10_000);
    expect(B2B_PLANS.enterprise.quota).toBe(25_000);
  });

  it("uses unique Stripe product names", () => {
    const products = [
      B2B_PLANS.starter.product,
      B2B_PLANS.professional.product,
      B2B_PLANS.enterprise.product,
    ];
    expect(new Set(products).size).toBe(3);
  });
});

describe("QRON_PLANS", () => {
  it("Launch Pack is one-time, Studio tiers are recurring", () => {
    expect(QRON_PLANS.launch_pack.oneTimeCents).toBe(3_900);
    expect(QRON_PLANS.studio.monthlyCents).toBe(4_900);
    expect(QRON_PLANS.studio_pro.monthlyCents).toBe(9_900);
  });

  it("Studio Pro is unlimited (sentinel -1)", () => {
    expect(QRON_PLANS.studio_pro.generationsPerMonth).toBe(-1);
  });
});

describe("CONTRACT", () => {
  it("uses the $2,500 setup + reuses Professional for recurring", () => {
    expect(CONTRACT.setupCents).toBe(250_000);
    expect(CONTRACT.recurringPlan).toBe("professional");
    expect(CONTRACT.setupProduct).toBe("contract_setup");
  });
});

describe("B2B_BRANDS", () => {
  it("contains exactly authichain, strainchain, govchain", () => {
    expect([...B2B_BRANDS].sort()).toEqual(["authichain", "govchain", "strainchain"]);
  });
});

describe("getPlanQuota", () => {
  it("returns the B2B quota by plan key", () => {
    expect(getPlanQuota("starter")).toBe(500);
    expect(getPlanQuota("professional")).toBe(10_000);
    expect(getPlanQuota("enterprise")).toBe(25_000);
  });
});

describe("lookupPlanByPriceId", () => {
  it("returns undefined for unknown price IDs", () => {
    expect(lookupPlanByPriceId("price_doesNotExist")).toBeUndefined();
  });

  it("returns the configured plan for known IDs (after Stripe setup populates table)", () => {
    // STRIPE_PRICE_TO_PLAN starts empty; this test documents the contract.
    // After scripts/setup-stripe-products.ts runs, real IDs land in the table.
    Object.entries(STRIPE_PRICE_TO_PLAN).forEach(([id, plan]) => {
      expect(lookupPlanByPriceId(id)).toBe(plan);
    });
  });
});

describe("getMonthlyAmountCents / getAnnualAmountCents", () => {
  it("returns the monthly cents for a B2B plan", () => {
    expect(getMonthlyAmountCents("professional")).toBe(49_900);
  });

  it("annual is monthly * 12 with 20% discount", () => {
    const monthly = getMonthlyAmountCents("starter");
    expect(getAnnualAmountCents("starter")).toBe(Math.round(monthly * 12 * 0.8));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run shared/pricing.test.ts`
Expected: FAIL with "Cannot find module './pricing'" or similar.

- [ ] **Step 3: Implement `shared/pricing.ts`**

Create `shared/pricing.ts`:

```ts
/**
 * AuthiChain pricing — single source of truth.
 *
 * Two product clusters reflecting two distinct buyers:
 *   - B2B brand-protection (AuthiChain + StrainChain + GovChain): same SKUs,
 *     brand attribution via Stripe `metadata.brand`.
 *   - QRON SMB (qron.space): separate SKUs, separate quotas (generations/mo
 *     vs authentications/mo).
 *
 * Plus a contract pilot track:
 *   - $2,500 one-time setup fee via service-order flow (`contract_setup`).
 *   - Recurring leg reuses `b2b_professional` ($499/mo, 10K calls/mo).
 *
 * Spec: docs/superpowers/specs/2026-04-28-pricing-reconciliation-design.md
 */

export const B2B_PLANS = {
  starter: {
    product: "b2b_starter",
    name: "AuthiChain Starter",
    monthlyCents: 19_900,
    quota: 500,
  },
  professional: {
    product: "b2b_professional",
    name: "AuthiChain Professional",
    monthlyCents: 49_900,
    quota: 10_000,
  },
  enterprise: {
    product: "b2b_enterprise",
    name: "AuthiChain Enterprise",
    monthlyCents: 99_900,
    quota: 25_000,
  },
} as const;

export const QRON_PLANS = {
  launch_pack: {
    product: "qron_launch_pack",
    name: "QRON Launch Pack",
    oneTimeCents: 3_900,
    portals: 3,
  },
  studio: {
    product: "qron_studio",
    name: "QRON Studio",
    monthlyCents: 4_900,
    generationsPerMonth: 20,
  },
  studio_pro: {
    product: "qron_studio_pro",
    name: "QRON Studio Pro",
    monthlyCents: 9_900,
    generationsPerMonth: -1, // -1 = unlimited
  },
} as const;

export const CONTRACT = {
  setupProduct: "contract_setup",
  setupCents: 250_000,
  /** Recurring leg reuses the B2B Professional SKU. */
  recurringPlan: "professional",
} as const;

export const B2B_BRANDS = ["authichain", "strainchain", "govchain"] as const;

export type B2BBrand = (typeof B2B_BRANDS)[number];
export type B2BPlanKey = keyof typeof B2B_PLANS;
export type QronPlanKey = keyof typeof QRON_PLANS;
export type AnyPlanKey = B2BPlanKey | QronPlanKey;

/**
 * Maps Stripe price IDs to plan keys. Populated AFTER
 * `scripts/setup-stripe-products.ts` runs and emits real IDs.
 *
 * Webhook plan detection consults this lookup before falling back to
 * amount-based heuristics.
 */
export const STRIPE_PRICE_TO_PLAN: Record<string, AnyPlanKey | "contract_setup"> = {
  // Filled in by scripts/setup-stripe-products.ts output. Example:
  // "price_1ABC...": "starter",
};

/** Returns the monthly cents for a B2B plan. */
export function getMonthlyAmountCents(plan: B2BPlanKey): number {
  return B2B_PLANS[plan].monthlyCents;
}

/** Returns annual cents = monthly * 12 with a 20% discount, rounded. */
export function getAnnualAmountCents(plan: B2BPlanKey): number {
  return Math.round(B2B_PLANS[plan].monthlyCents * 12 * 0.8);
}

/** Returns the per-month quota for a B2B plan (used by the webhook to set monthlyQuota). */
export function getPlanQuota(plan: B2BPlanKey): number {
  return B2B_PLANS[plan].quota;
}

/** Looks up a Stripe price ID; undefined if unrecognized. */
export function lookupPlanByPriceId(
  priceId: string,
): AnyPlanKey | "contract_setup" | undefined {
  return STRIPE_PRICE_TO_PLAN[priceId];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run shared/pricing.test.ts`
Expected: All tests pass (the `lookupPlanByPriceId` "known IDs" test passes vacuously while `STRIPE_PRICE_TO_PLAN` is empty).

- [ ] **Step 5: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add shared/pricing.ts shared/pricing.test.ts
git commit -m "feat(pricing): add shared/pricing.ts as single source of truth"
```

---

## Task 2: Migrate `server/stripe-service.ts` to use `shared/pricing.ts` + thread brand metadata

**Files:**
- Modify: `server/stripe-service.ts`

- [ ] **Step 1: Replace the import on line 6**

Replace this line:

```ts
import { STRIPE_PRODUCTS, type PlanKey, getPlanQuota } from "./stripe-products";
```

With:

```ts
import {
  B2B_PLANS,
  getMonthlyAmountCents,
  getAnnualAmountCents,
  type B2BPlanKey,
  type B2BBrand,
} from "../shared/pricing";

type PlanKey = B2BPlanKey;
```

(The local `PlanKey` alias keeps the rest of the file mechanically compatible.)

- [ ] **Step 2: Extend `CreateCheckoutParams` to accept brand and contract metadata**

Find the existing interface (around line 21):

```ts
export interface CreateCheckoutParams {
  userId: number;
  userEmail: string;
  userName: string;
  plan: PlanKey;
  billing: "monthly" | "annual";
  origin: string;
  stripeCustomerId?: string;
}
```

Replace with:

```ts
export interface CreateCheckoutParams {
  userId: number;
  userEmail: string;
  userName: string;
  plan: PlanKey;
  billing: "monthly" | "annual";
  origin: string;
  stripeCustomerId?: string;
  /** B2B brand attribution. Omit for non-branded checkouts (e.g. QRON). */
  brand?: B2BBrand;
  /** When set, the recurring subscription was preceded by a contract setup service order. */
  contractSetupOrderId?: string;
}
```

- [ ] **Step 3: Update `createSubscriptionCheckout` to use shared pricing and write metadata**

Find the function body (starts around line 31). Replace the `product` lookup and `priceAmount`:

```ts
const product = STRIPE_PRODUCTS[params.plan];
const priceAmount = params.billing === "annual"
  ? product.priceAnnual
  : product.priceMonthly;
```

With:

```ts
const product = B2B_PLANS[params.plan];
const priceAmount = params.billing === "annual"
  ? getAnnualAmountCents(params.plan)
  : getMonthlyAmountCents(params.plan);
```

Then replace the existing `metadata: { ... }` block in `sessionConfig` with:

```ts
metadata: {
  user_id: params.userId.toString(),
  customer_email: params.userEmail,
  customer_name: params.userName,
  plan: params.plan,
  billing: params.billing,
  ...(params.brand ? { brand: params.brand } : {}),
  ...(params.contractSetupOrderId
    ? { contract: "true", setup_order_id: params.contractSetupOrderId }
    : {}),
},
```

And replace the `product_data` block:

```ts
product_data: {
  name: product.name,
  description: product.description,
},
```

With:

```ts
product_data: {
  name: product.name,
},
```

(The `description` field came from the deleted `stripe-products.ts`. The product name alone is sufficient on Checkout; description can be re-added per-tier if marketing wants.)

- [ ] **Step 4: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/stripe-service.ts
git commit -m "refactor(stripe-service): use shared/pricing + thread brand & contract metadata"
```

---

## Task 3: Upgrade webhook plan detection to lookup table + propagate brand/contract metadata

**Files:**
- Modify: `server/webhooks/stripe.ts`
- Create: `server/webhooks/stripe-plan-detection.test.ts`

- [ ] **Step 1: Write failing tests for the lookup-first detection**

Create `server/webhooks/stripe-plan-detection.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { STRIPE_PRICE_TO_PLAN } from "../../shared/pricing";
import { detectPlan } from "./stripe-plan-detection";

afterEach(() => {
  // Tests mutate the lookup table; reset between tests.
  for (const k of Object.keys(STRIPE_PRICE_TO_PLAN)) delete STRIPE_PRICE_TO_PLAN[k];
});

describe("detectPlan", () => {
  it("returns the B2B plan when the price ID is in the lookup table", () => {
    STRIPE_PRICE_TO_PLAN["price_known_pro"] = "professional";
    expect(detectPlan("price_known_pro", 49_900)).toBe("professional");
  });

  it("falls back to amount-based detection when price ID is unknown", () => {
    expect(detectPlan("price_unknown", 99_900)).toBe("enterprise");
    expect(detectPlan("price_unknown", 49_900)).toBe("professional");
    expect(detectPlan("price_unknown", 19_900)).toBe("starter");
    expect(detectPlan("price_unknown", 0)).toBe("starter");
  });

  it("falls back to amount-based detection when price ID is missing", () => {
    expect(detectPlan(null, 99_900)).toBe("enterprise");
    expect(detectPlan(undefined, 19_900)).toBe("starter");
  });

  it("does NOT match QRON or contract_setup as B2B plans (they are non-B2B keys)", () => {
    STRIPE_PRICE_TO_PLAN["price_qron_studio"] = "studio";
    STRIPE_PRICE_TO_PLAN["price_contract_setup"] = "contract_setup";
    // For a Stripe subscription event we expect a B2B plan; non-B2B IDs
    // should fall through to amount-based detection so we don't mis-tag
    // a QRON checkout as a B2B plan.
    expect(detectPlan("price_qron_studio", 4_900)).toBe("starter"); // amount fallback
    expect(detectPlan("price_contract_setup", 250_000)).toBe("enterprise");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run server/webhooks/stripe-plan-detection.test.ts`
Expected: FAIL with "Cannot find module './stripe-plan-detection'".

- [ ] **Step 3: Extract `detectPlan` to its own module**

Create `server/webhooks/stripe-plan-detection.ts`:

```ts
import {
  B2B_PLANS,
  lookupPlanByPriceId,
  type B2BPlanKey,
} from "../../shared/pricing";

/** B2B plans only; webhook-side helper. */
function isB2BPlan(key: string): key is B2BPlanKey {
  return key in B2B_PLANS;
}

/** Amount-based fallback when price ID is unknown. */
function detectPlanFromAmount(amountCents: number): B2BPlanKey {
  if (amountCents >= 70_000) return "enterprise";
  if (amountCents >= 15_000) return "professional";
  return "starter";
}

/**
 * Resolves a Stripe price ID + invoiced amount to a B2B plan key.
 * Tries the configured lookup table first, then falls back to amount.
 * Non-B2B keys (e.g. QRON or `contract_setup`) cause a fall-through to
 * amount-based detection — webhook subscription events should always
 * resolve to a B2B plan because that's what `subscriptions.plan` stores.
 */
export function detectPlan(
  priceId: string | null | undefined,
  amountCents: number,
): B2BPlanKey {
  if (priceId) {
    const known = lookupPlanByPriceId(priceId);
    if (known && isB2BPlan(known)) return known;
  }
  return detectPlanFromAmount(amountCents);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run server/webhooks/stripe-plan-detection.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Wire `detectPlan` into `server/webhooks/stripe.ts` and propagate brand metadata**

In `server/webhooks/stripe.ts`:

(a) Replace the import on line 28:

```ts
import { getPlanQuota } from "../stripe-products";
```

With:

```ts
import { getPlanQuota } from "../../shared/pricing";
import { detectPlan } from "./stripe-plan-detection";
```

(b) Delete the existing `detectPlanFromPriceId`, `detectPlanFromAmount`, and `detectPlan` definitions (around lines 47-71) — they are now in `stripe-plan-detection.ts`.

(c) In the `customer.subscription.created` / `customer.subscription.updated` handler (around lines 177-226), find the existing `await logAutomationAudit(...)` call. Add brand and contract fields by reading them from the subscription metadata. Replace this section:

```ts
await logAutomationAudit(
  event.type === "customer.subscription.created"
    ? "billing_subscription_created"
    : "billing_subscription_updated",
  {
    eventId: event.id,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId ?? null,
    plan,
    status,
    billingCycle,
    userId: userId ?? null,
  },
  userId,
);
```

With:

```ts
const brand = (sub.metadata?.brand as string | undefined) ?? null;
const isContract = sub.metadata?.contract === "true";

await logAutomationAudit(
  event.type === "customer.subscription.created"
    ? "billing_subscription_created"
    : "billing_subscription_updated",
  {
    eventId: event.id,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId ?? null,
    plan,
    status,
    billingCycle,
    brand,
    contract: isContract,
    userId: userId ?? null,
  },
  userId,
);
```

(d) In the `invoice.paid` / `invoice.payment_succeeded` handler (around lines 252-318), the `recordRevenue` call writes `metadata`. Add `brand` and `contract` to that metadata. Find:

```ts
await recordRevenue({
  source: "stripe",
  amount: amountUsd.toFixed(2),
  currency,
  type: "subscription",
  userId: userId ?? null,
  metadata: {
    eventId: event.id,
    invoiceId: inv.id,
    stripeSubscriptionId: subscriptionId ?? null,
    stripeCustomerId: customerId ?? null,
    plan,
  },
});
```

Replace the `metadata` block with:

```ts
metadata: {
  eventId: event.id,
  invoiceId: inv.id,
  stripeSubscriptionId: subscriptionId ?? null,
  stripeCustomerId: customerId ?? null,
  plan,
  brand: (inv as any).subscription_details?.metadata?.brand ?? null,
  contract: (inv as any).subscription_details?.metadata?.contract === "true",
},
```

(e) In the `checkout.session.completed` handler (around lines 364-441), the `recordRevenue` call also writes metadata. Find:

```ts
await recordRevenue({
  source: "stripe",
  amount: amountUsd.toFixed(2),
  currency: (session.currency ?? "usd").toUpperCase(),
  type: segment ? "pilot_program" : "subscription",
  userId: userId ?? null,
  metadata: {
    eventId: event.id,
    sessionId: session.id,
    segment,
    leadEmail,
    stripeSubscriptionId: subscriptionId ?? null,
    stripeCustomerId: customerId ?? null,
  },
});
```

Replace the `metadata` block with:

```ts
metadata: {
  eventId: event.id,
  sessionId: session.id,
  segment,
  leadEmail,
  stripeSubscriptionId: subscriptionId ?? null,
  stripeCustomerId: customerId ?? null,
  brand: session.metadata?.brand ?? null,
  contract: session.metadata?.contract === "true",
  setupOrderId: session.metadata?.setup_order_id ?? null,
},
```

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test`
Expected: All tests pass (existing webhook tests + the new plan-detection tests).

- [ ] **Step 7: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add server/webhooks/stripe.ts server/webhooks/stripe-plan-detection.ts server/webhooks/stripe-plan-detection.test.ts
git commit -m "refactor(webhook): lookup-table plan detection + brand/contract metadata propagation"
```

---

## Task 4: Update `server/subscriptions/router.ts` to accept brand input + use shared

**Files:**
- Modify: `server/subscriptions/router.ts`

- [ ] **Step 1: Replace the import on line 6**

Replace:

```ts
import { SUBSCRIPTION_PLANS } from "@shared/subscriptionPlans";
```

With:

```ts
import { B2B_PLANS, B2B_BRANDS, type B2BBrand } from "@shared/pricing";
```

- [ ] **Step 2: Update the `create` mutation's quota lookup**

Find the `create` mutation (around line 13). Replace the `quotas` object:

```ts
const quotas = {
  starter: SUBSCRIPTION_PLANS.starter.monthlyQuota,
  professional: SUBSCRIPTION_PLANS.professional.monthlyQuota,
  enterprise: SUBSCRIPTION_PLANS.enterprise.monthlyQuota,
};
```

With:

```ts
const quotas = {
  starter: B2B_PLANS.starter.quota,
  professional: B2B_PLANS.professional.quota,
  enterprise: B2B_PLANS.enterprise.quota,
};
```

- [ ] **Step 3: Add `brand` input + thread to checkout call**

Find the `checkout` mutation (around line 39). Replace its full definition with:

```ts
checkout: protectedProcedure.input(z.object({
  plan: z.enum(["starter", "professional", "enterprise"]),
  billing: z.enum(["monthly", "annual"]).optional().default("monthly"),
  origin: z.string(),
  brand: z.enum(B2B_BRANDS as unknown as [B2BBrand, ...B2BBrand[]]).optional(),
  contractSetupOrderId: z.string().optional(),
})).mutation(async ({ ctx, input }) => {
  const url = await stripeService.createSubscriptionCheckout({
    userId: ctx.user.id,
    userEmail: ctx.user.email || "",
    userName: ctx.user.name || "",
    plan: input.plan,
    billing: input.billing,
    origin: input.origin,
    stripeCustomerId: (ctx.user as any).stripeCustomerId || undefined,
    brand: input.brand,
    contractSetupOrderId: input.contractSetupOrderId,
  });
  return { checkoutUrl: url };
}),
```

- [ ] **Step 4: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/subscriptions/router.ts
git commit -m "feat(subscriptions): accept brand + contractSetupOrderId on checkout, use shared pricing"
```

---

## Task 5: Update `client/src/pages/Subscriptions.tsx` to use shared pricing

**Files:**
- Modify: `client/src/pages/Subscriptions.tsx`

- [ ] **Step 1: Read the file's import line and any uses of `SUBSCRIPTION_PLANS`**

Run: `pnpm exec rg "SUBSCRIPTION_PLANS|PlanKey" client/src/pages/Subscriptions.tsx -n`
Expected: One import line + 1-N references.

- [ ] **Step 2: Replace the import on line 7**

Replace:

```ts
import { SUBSCRIPTION_PLANS, type PlanKey } from "@shared/subscriptionPlans";
```

With:

```ts
import { B2B_PLANS, type B2BPlanKey as PlanKey } from "@shared/pricing";

// Adapter for the legacy field names this component reads from SUBSCRIPTION_PLANS.
// Only the fields the file actually consumes are mapped.
const SUBSCRIPTION_PLANS = {
  starter: {
    name: "Starter",
    monthlyPrice: B2B_PLANS.starter.monthlyCents / 100,
    monthlyQuota: B2B_PLANS.starter.quota,
  },
  professional: {
    name: "Professional",
    monthlyPrice: B2B_PLANS.professional.monthlyCents / 100,
    monthlyQuota: B2B_PLANS.professional.quota,
  },
  enterprise: {
    name: "Enterprise",
    monthlyPrice: B2B_PLANS.enterprise.monthlyCents / 100,
    monthlyQuota: B2B_PLANS.enterprise.quota,
  },
} as const;
```

(This adapter preserves the existing call sites in the page until the next pass refactors them. If the file uses fields not in this adapter — `annualPrice`, `features`, etc. — read those from `SUBSCRIPTION_PLANS` in the deleted `shared/subscriptionPlans.ts` first and copy the literal values into the adapter.)

- [ ] **Step 3: Run type check**

Run: `pnpm check`
Expected: No errors. If there are errors about missing fields on `SUBSCRIPTION_PLANS`, copy those literal values from the old `shared/subscriptionPlans.ts` into the adapter object.

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Subscriptions.tsx
git commit -m "refactor(subscriptions-page): import from shared/pricing via local adapter"
```

---

## Task 6: Add `contract_setup` to the service catalog

**Files:**
- Modify: `server/service-catalog.ts`

- [ ] **Step 1: Extend the `ServiceType` union (around line 22)**

Replace:

```ts
export type ServiceType =
  | "authenticity_audit"
  | "cinematic_page"
  | "automation_setup"
  | "landing_page"
  | "brand_story_pack"
  | "government_dossier"
  | "sba_disaster_loan";
```

With:

```ts
export type ServiceType =
  | "authenticity_audit"
  | "cinematic_page"
  | "automation_setup"
  | "landing_page"
  | "brand_story_pack"
  | "government_dossier"
  | "sba_disaster_loan"
  | "contract_setup";
```

- [ ] **Step 2: Add the `contract_setup` entry to `SERVICE_CATALOG`**

Inside the `SERVICE_CATALOG` object, add this entry as a sibling of `sba_disaster_loan` (preserve existing closing brace placement):

```ts
contract_setup: {
  key: "contract_setup",
  name: "AuthiChain Contract Pilot — Setup Fee",
  tagline: "Custom integration + compliance reporting onboarding",
  description:
    "One-time implementation fee for AuthiChain Contract Pilot customers (signed Service Agreement). Covers METRC/DSCSA compliance reporting setup, custom API integration, dedicated onboarding, and Stripe subscription provisioning at the Professional tier ($499/mo).",
  price: 250000,
  displayPrice: "$2,500",
  // Stripe IDs are populated by scripts/setup-stripe-products.ts.
  stripeProductId: "",
  stripePriceId: "",
  deliverables: [
    "METRC / DSCSA compliance reporting configuration",
    "Custom API integration & webhook setup",
    "Dedicated onboarding session",
    "Provisioning of recurring B2B Professional subscription",
  ],
  targetAudience: [
    "Manufacturers",
    "Dispensaries",
    "Brand-protection directors",
    "Compliance officers",
  ],
  deliveryTime: "5-10 business days",
  icon: "FileSignature",
},
```

- [ ] **Step 3: Run type check**

Run: `pnpm check`
Expected: No errors. If `ServiceType` exhaustiveness is checked anywhere (`switch`/`Record<ServiceType, ...>`), TypeScript catches it here.

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/service-catalog.ts
git commit -m "feat(services): add contract_setup ($2,500) for B2B contract pilots"
```

---

## Task 7: Rewrite `client/src/pages/Pricing.tsx` to switch by host + read from shared

**Files:**
- Modify: `client/src/pages/Pricing.tsx`

- [ ] **Step 1: Read the existing file to capture any feature-list copy worth preserving**

Run: `pnpm exec rg "PLANS\[|features:" client/src/pages/Pricing.tsx -n`
Expected: Several references inside the local `PLANS` constant.

- [ ] **Step 2: Replace the file**

Overwrite `client/src/pages/Pricing.tsx` with:

```tsx
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, Shield, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { B2B_PLANS, QRON_PLANS, type B2BBrand } from "@shared/pricing";

// ─── Cluster detection by host ───────────────────────────────────────────────

type Cluster = "b2b" | "qron";

function clusterFromHost(host: string): Cluster {
  return host.startsWith("qron.") || host === "qron.space" ? "qron" : "b2b";
}

function brandFromHost(host: string): B2BBrand | undefined {
  if (host.startsWith("strainchain.")) return "strainchain";
  if (host.startsWith("govchain.")) return "govchain";
  if (host.startsWith("authichain.") || host === "localhost" || host.startsWith("localhost:"))
    return "authichain";
  return undefined;
}

// ─── B2B plan rendering ──────────────────────────────────────────────────────

const B2B_DISPLAY = [
  {
    id: "starter" as const,
    icon: Shield,
    color: "green",
    description: "Essential brand-protection authentication.",
    features: [
      `${B2B_PLANS.starter.quota.toLocaleString()} authentications/month`,
      "QR code generation",
      "Basic certificates",
      "Email support",
    ],
  },
  {
    id: "professional" as const,
    icon: Zap,
    color: "yellow",
    description: "Advanced authentication for serious brands.",
    features: [
      `${B2B_PLANS.professional.quota.toLocaleString()} authentications/month`,
      "NFT certificate minting",
      "AI Autopilot engine",
      "Priority support",
    ],
    featured: true,
  },
  {
    id: "enterprise" as const,
    icon: Crown,
    color: "blue",
    description: "Full-scale enterprise authentication.",
    features: [
      `${B2B_PLANS.enterprise.quota.toLocaleString()} authentications/month`,
      "White-label solution",
      "Custom smart contracts",
      "Dedicated account manager",
    ],
  },
];

// ─── QRON plan rendering ─────────────────────────────────────────────────────

const QRON_DISPLAY = [
  {
    id: "launch_pack" as const,
    icon: Sparkles,
    color: "purple",
    priceLabel: `$${QRON_PLANS.launch_pack.oneTimeCents / 100}`,
    period: "one-time",
    description: "Launch your first 3 portals.",
    features: [
      `${QRON_PLANS.launch_pack.portals} QR portals`,
      "Editable destinations",
      "Basic analytics",
    ],
  },
  {
    id: "studio" as const,
    icon: Zap,
    color: "yellow",
    priceLabel: `$${QRON_PLANS.studio.monthlyCents / 100}`,
    period: "/mo",
    description: "Generate up to 20 living QR portals per month.",
    features: [
      `${QRON_PLANS.studio.generationsPerMonth} generations/month`,
      "Editable destinations",
      "Scan analytics",
      "Saved templates",
    ],
    featured: true,
  },
  {
    id: "studio_pro" as const,
    icon: Crown,
    color: "blue",
    priceLabel: `$${QRON_PLANS.studio_pro.monthlyCents / 100}`,
    period: "/mo",
    description: "Unlimited generations + advanced analytics.",
    features: [
      "Unlimited generations",
      "Advanced analytics & A/B routing",
      "Brand library",
      "Priority support",
    ],
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Pricing() {
  const [host, setHost] = useState<string>("");
  useEffect(() => setHost(window.location.host), []);

  const cluster = useMemo<Cluster>(() => clusterFromHost(host), [host]);
  const brand = useMemo<B2BBrand | undefined>(() => brandFromHost(host), [host]);

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const checkout = trpc.subscriptions.checkout.useMutation();
  // QRON Launch Pack is one-time → routed through services.checkout when it lands.
  // For now (recurring tiers only), QRON Studio / Studio Pro use subscriptions.checkout
  // with the shared Stripe products.

  const handleSubscribe = async (planId: string, displayName: string) => {
    setLoadingPlan(planId);
    try {
      const { checkoutUrl } = await checkout.mutateAsync({
        plan: planId as any,
        billing: "monthly",
        origin: window.location.origin,
        ...(cluster === "b2b" && brand ? { brand } : {}),
      });
      toast.success(`Redirecting to ${displayName} checkout…`);
      window.location.href = checkoutUrl;
    } catch (error: any) {
      toast.error(`Checkout failed: ${error.message}`);
      setLoadingPlan(null);
    }
  };

  const isQron = cluster === "qron";
  const items = isQron ? QRON_DISPLAY : B2B_DISPLAY;

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">
          {isQron ? "QRON Pricing" : "AuthiChain Pricing"}
        </h1>
        <p className="text-muted-foreground">
          {isQron
            ? "Living QR portals for small businesses, makers, and single-location brands."
            : "Brand-protection authentication that scales with your supply chain."}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {items.map((p) => {
          const PlanIcon = p.icon;
          const priceLabel = isQron
            ? (p as typeof QRON_DISPLAY[number]).priceLabel
            : `$${B2B_PLANS[p.id as keyof typeof B2B_PLANS].monthlyCents / 100}`;
          const period = isQron
            ? (p as typeof QRON_DISPLAY[number]).period
            : "/mo";
          const displayName = isQron
            ? QRON_PLANS[p.id as keyof typeof QRON_PLANS].name
            : B2B_PLANS[p.id as keyof typeof B2B_PLANS].name;

          return (
            <Card key={p.id} className={(p as any).featured ? "border-primary" : ""}>
              <CardHeader>
                {(p as any).featured && <Badge>Most Popular</Badge>}
                <CardTitle className="flex items-center gap-2">
                  <PlanIcon className="w-5 h-5" /> {displayName}
                </CardTitle>
                <CardDescription>{p.description}</CardDescription>
                <div className="text-3xl font-bold mt-2">
                  {priceLabel}
                  <span className="text-sm font-normal text-muted-foreground"> {period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-1 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(p.id, displayName)}
                  disabled={loadingPlan === p.id}
                >
                  {loadingPlan === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 4: Run the dev server and visually verify**

Run: `pnpm dev`
Expected: dev server starts.

In a browser, open `http://localhost:5173/pricing`:
- B2B view should show three tiers ($199 / $499 / $999), brand defaulted to `authichain` on localhost.
- Click each Subscribe button — should hit the tRPC mutation. (It will fail without a logged-in user; that's fine — error toast confirms wiring.)

(Optional) Add a temp host override during dev: visit `?host=qron.space` is NOT supported by this implementation; verify QRON manually by editing `clusterFromHost` to force `"qron"` and reverting before commit, OR by adding a `?cluster=qron` query-param shortcut as a follow-up.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Pricing.tsx
git commit -m "feat(pricing-page): host-aware B2B vs QRON view from shared/pricing"
```

---

## Task 8: Create `scripts/setup-stripe-products.ts` (idempotent product creation)

**Files:**
- Create: `scripts/setup-stripe-products.ts`

- [ ] **Step 1: Create the script**

Create `scripts/setup-stripe-products.ts`:

```ts
/**
 * Idempotent Stripe product/price seeder.
 *
 * Usage: STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/setup-stripe-products.ts
 *
 * Creates 7 products + their canonical prices if they do not already exist
 * (matched by Stripe `product.metadata.canonical_name`). Emits the resulting
 * price IDs so they can be pasted into `shared/pricing.ts:STRIPE_PRICE_TO_PLAN`.
 *
 * Run once per Stripe account (test mode and live mode separately).
 */

import Stripe from "stripe";
import { B2B_PLANS, QRON_PLANS, CONTRACT } from "../shared/pricing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set");
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" as any });

interface Spec {
  canonicalName: string;
  displayName: string;
  /** When set, a recurring monthly price is created. */
  monthlyCents?: number;
  /** When set, a recurring annual price is created. */
  annualCents?: number;
  /** When set, a one-time price is created. */
  oneTimeCents?: number;
  planKey: string;
}

const specs: Spec[] = [
  // B2B
  { canonicalName: B2B_PLANS.starter.product,      displayName: B2B_PLANS.starter.name,      monthlyCents: B2B_PLANS.starter.monthlyCents,      annualCents: Math.round(B2B_PLANS.starter.monthlyCents      * 12 * 0.8), planKey: "starter" },
  { canonicalName: B2B_PLANS.professional.product, displayName: B2B_PLANS.professional.name, monthlyCents: B2B_PLANS.professional.monthlyCents, annualCents: Math.round(B2B_PLANS.professional.monthlyCents * 12 * 0.8), planKey: "professional" },
  { canonicalName: B2B_PLANS.enterprise.product,   displayName: B2B_PLANS.enterprise.name,   monthlyCents: B2B_PLANS.enterprise.monthlyCents,   annualCents: Math.round(B2B_PLANS.enterprise.monthlyCents   * 12 * 0.8), planKey: "enterprise" },
  // QRON
  { canonicalName: QRON_PLANS.launch_pack.product, displayName: QRON_PLANS.launch_pack.name, oneTimeCents:   QRON_PLANS.launch_pack.oneTimeCents,                                                                              planKey: "launch_pack" },
  { canonicalName: QRON_PLANS.studio.product,      displayName: QRON_PLANS.studio.name,      monthlyCents:   QRON_PLANS.studio.monthlyCents,                                                                                       planKey: "studio" },
  { canonicalName: QRON_PLANS.studio_pro.product,  displayName: QRON_PLANS.studio_pro.name,  monthlyCents:   QRON_PLANS.studio_pro.monthlyCents,                                                                                   planKey: "studio_pro" },
  // Contract setup
  { canonicalName: CONTRACT.setupProduct,          displayName: "AuthiChain Contract Pilot — Setup", oneTimeCents: CONTRACT.setupCents,                                                                                            planKey: "contract_setup" },
];

async function findOrCreateProduct(canonicalName: string, displayName: string): Promise<Stripe.Product> {
  const list = await stripe.products.list({ limit: 100, active: true });
  const existing = list.data.find(p => p.metadata?.canonical_name === canonicalName);
  if (existing) return existing;
  return await stripe.products.create({
    name: displayName,
    metadata: { canonical_name: canonicalName },
  });
}

async function findOrCreatePrice(
  product: Stripe.Product,
  amountCents: number,
  recurring: "month" | "year" | null,
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const interval = recurring;
  const match = prices.data.find(p =>
    p.unit_amount === amountCents &&
    (interval === null ? !p.recurring : p.recurring?.interval === interval),
  );
  if (match) return match;
  return await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency: "usd",
    ...(interval ? { recurring: { interval } } : {}),
  });
}

async function main() {
  const mappings: Record<string, string> = {};

  for (const spec of specs) {
    const product = await findOrCreateProduct(spec.canonicalName, spec.displayName);
    console.log(`[product] ${spec.canonicalName} -> ${product.id}`);

    if (spec.monthlyCents !== undefined) {
      const monthly = await findOrCreatePrice(product, spec.monthlyCents, "month");
      mappings[monthly.id] = spec.planKey;
      console.log(`  monthly  ${monthly.id} ($${spec.monthlyCents / 100})`);
    }
    if (spec.annualCents !== undefined) {
      const annual = await findOrCreatePrice(product, spec.annualCents, "year");
      mappings[annual.id] = spec.planKey;
      console.log(`  annual   ${annual.id} ($${spec.annualCents / 100})`);
    }
    if (spec.oneTimeCents !== undefined) {
      const oneTime = await findOrCreatePrice(product, spec.oneTimeCents, null);
      mappings[oneTime.id] = spec.planKey;
      console.log(`  oneTime  ${oneTime.id} ($${spec.oneTimeCents / 100})`);
    }
  }

  console.log("\n=== Paste into shared/pricing.ts:STRIPE_PRICE_TO_PLAN ===");
  for (const [priceId, planKey] of Object.entries(mappings)) {
    console.log(`  "${priceId}": "${planKey}",`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Run against the Stripe TEST account**

Run: `STRIPE_SECRET_KEY=$STRIPE_TEST_SECRET_KEY pnpm exec tsx scripts/setup-stripe-products.ts`

(If `tsx` isn't installed: `pnpm add -D tsx` first, then re-run.)

Expected output: 7 product lines + their price IDs + a "Paste into…" block at the end.

- [ ] **Step 4: Paste the price IDs into `shared/pricing.ts:STRIPE_PRICE_TO_PLAN`**

Open `shared/pricing.ts`, find the empty `STRIPE_PRICE_TO_PLAN = { ... }` and paste the test-mode IDs from the script output.

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests pass — including `lookupPlanByPriceId` "known IDs" test, which now has real entries.

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-stripe-products.ts shared/pricing.ts
git commit -m "feat(stripe-setup): idempotent product seeder + populate STRIPE_PRICE_TO_PLAN (test mode)"
```

(Run the same script against the live Stripe account in a deploy step before production cutover; commit live-mode IDs in a separate environment-specific config rather than into source if your repo policy requires that.)

---

## Task 9: Delete obsolete files + verify clean

**Files:**
- Delete: `server/stripe-products.ts`
- Delete: `shared/subscriptionPlans.ts`
- Possibly delete: `.github-staging/webhooks/stripe.ts` (operator decision)

- [ ] **Step 1: Verify no remaining imports**

Run: `pnpm exec rg "from\s+['\"](?:\.\.?/)*(?:server/)?stripe-products['\"]|from\s+['\"]@shared/subscriptionPlans['\"]" -n`
Expected: Only `.github-staging/webhooks/stripe.ts:27` (staging dupe) — no live code references.

If any other files match, update their imports to `@shared/pricing` and re-run before deleting.

- [ ] **Step 2: Delete the two source files**

```bash
git rm server/stripe-products.ts shared/subscriptionPlans.ts
```

- [ ] **Step 3: Decide on `.github-staging/webhooks/stripe.ts`**

This file lives outside production code. Inspect it:

```bash
git log --oneline -- .github-staging/webhooks/stripe.ts | head -5
```

If recent commits are only deploy/infra fiddles and the file is a stale dupe, delete it: `git rm .github-staging/webhooks/stripe.ts`.
If unsure, leave it but add a TODO comment at the top noting that its import of `../stripe-products` is now broken.

- [ ] **Step 4: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(pricing): remove obsolete stripe-products.ts + subscriptionPlans.ts"
```

---

## Task 10: End-to-end smoke test (manual)

**Files:** None changed. This task verifies the complete flow.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Expected: Frontend on `http://localhost:5173`, server logs show no errors.

- [ ] **Step 2: Trigger a B2B Professional checkout (logged-in user required)**

In a browser:
1. Sign in.
2. Visit `/pricing`.
3. Click "Subscribe" on the Professional tier.
4. Stripe Checkout opens. Use test card `4242 4242 4242 4242`, any future date, any CVC, any ZIP.
5. Complete checkout.

Expected: Redirect back to `/subscriptions?session_id=...&success=true`.

- [ ] **Step 3: Verify webhook recorded the right plan + brand**

Connect to the database:

```bash
pnpm exec drizzle-kit studio   # or your preferred client
```

Query:

```sql
SELECT id, source, amount, type, metadata->>'plan' AS plan,
       metadata->>'brand' AS brand, metadata->>'contract' AS contract
FROM revenue_records
ORDER BY id DESC
LIMIT 1;
```

Expected:
- `plan = 'professional'`
- `brand = 'authichain'` (default for localhost)
- `contract = 'false'`
- `amount = 499.00`

- [ ] **Step 4: Verify the subscription row**

```sql
SELECT plan, status, monthly_quota, billing_cycle
FROM subscriptions
WHERE user_id = <your_test_user_id>
ORDER BY id DESC
LIMIT 1;
```

Expected:
- `plan = 'professional'`
- `monthly_quota = 10000` (the new bumped value, NOT 5000)
- `status = 'active'`

- [ ] **Step 5: Trigger a contract-pilot flow**

(Operator-driven flow — no UI yet for this; simulate via tRPC or direct DB.)

a. Create a `service_orders` row for `contract_setup`:

```sql
INSERT INTO service_orders (user_id, service_key, amount, status, created_at)
VALUES (<your_test_user_id>, 'contract_setup', 250000, 'pending', NOW())
RETURNING id;
```

(Actual column names may differ; use the existing `services.checkout` mutation in tRPC instead if available.)

b. Pay the resulting Stripe Checkout session with the test card.

c. Open a B2B Professional checkout via the tRPC `subscriptions.checkout` mutation, passing `contractSetupOrderId` = the order ID from (a). Complete the test payment.

d. Re-run the query from Step 3. Expected: most recent revenue row has `contract = 'true'` and `setupOrderId` populated.

- [ ] **Step 6: Document any drift in a follow-up issue**

If real outputs diverge from the expected values, file an issue and link this plan. Common drift points:
- `subscription_details` is missing on some Stripe invoice events (older API versions). Webhook fallback should still resolve `brand` from the customer metadata.
- Quota mismatch (5000 vs 10000) means an existing subscription pre-dates the schema change; archive it.

- [ ] **Step 7: Final commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "test(pricing): end-to-end smoke verified" --allow-empty
```

(`--allow-empty` is fine here — this commit is the marker that the plan completed.)

---

## Self-review (against the spec)

| Spec requirement | Implemented in |
|---|---|
| `shared/pricing.ts` as single source of truth | Task 1 |
| B2B cluster: $199 / $499 / $999 with quotas 500 / 10K / 25K | Task 1 |
| QRON cluster: $39 one-time / $49 / $99 monthly | Task 1 |
| Contract: $2,500 setup + reuse `b2b_professional` recurring | Tasks 1, 6 |
| Brand attribution via `metadata.brand` | Tasks 2, 3, 4 |
| Contract origin via `metadata.contract` + `metadata.setup_order_id` | Tasks 2, 3 |
| Webhook plan detection: lookup table → amount fallback | Task 3 |
| Pricing page reads from shared, switches by host | Task 7 |
| Service catalog gains `contract_setup` | Task 6 |
| 7 Stripe products created idempotently | Task 8 |
| Delete `server/stripe-products.ts` + `shared/subscriptionPlans.ts` | Task 9 |
| End-to-end verification | Task 10 |

No spec requirement is unmapped.
