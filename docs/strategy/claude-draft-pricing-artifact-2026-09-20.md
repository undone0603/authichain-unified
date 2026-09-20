# Claude artifact draft pricing (desktop capture)

> **CLAUDE ARTIFACT DRAFT — NOT LIVE.** Do not wire into estate `/pricing`, marketing auto-publish, or Stripe.
>
> Captured from Claude desktop on **2026-09-20** for reconciliation only. This file is a reference snapshot, not a price list customers should see.

## Artifact tier table (non-authoritative)

| Tier | Monthly | Annual | Notes |
| --- | --- | --- | --- |
| **Basic** | $199/mo | $159/yr | Entry B2B tier; scan and feature limits as described in the original artifact UI copy (not transcribed here). |
| **Professional** | $499/mo | $399/yr | Marked **MOST POPULAR** in the artifact. Higher scan/API limits than Basic in the artifact mock. |
| **Enterprise** | $999/mo | $799/yr | Top artifact tier; enterprise-style limits and positioning in the source mock. |

Annual figures in the artifact were presented as discounted yearly billing relative to the monthly list prices above. Do not treat annual/monthly pairs as live Stripe prices until reconciled.

## Why this conflicts with the monorepo

The artifact used a simplified three-tier AuthiChain subscription ladder. The unified monorepo does **not** expose these SKUs as live checkout today. Multiple historical docs (protocol Manus UI, QRON $5–35 packs, this artifact) disagree with each other and with production.

## Live truth (money paths)

Use only:

- `src/lib/plans.ts` — purchasable plans, Stripe price IDs, and Payment Links
- Live Stripe Payment Links and checkout routes actually wired in production

Current reconciliation anchors (verify in `plans.ts` before any copy change):

- **AuthiChain / DPP:** DPP Readiness Audit **$299** (one-time; credits toward conversion per plan copy)
- **StrainChain:** Passport **$49** per cultivar; Farm **$149/mo** (Stripe IDs may be pending — see `isPurchasable()`)
- **QRON:** credit packs (e.g. Starter **$29**, Creator **$99**) and Theater subscriptions — not the artifact’s Basic/Pro/Enterprise ladder
- **DPP checkout:** `/api/checkout/dpp` and related Stripe flows — not this artifact table

Historical references elsewhere may still say “StrainChain Basic $199/mo” or “Professional $499/mo” in narrative docs; those are not overridden by this artifact file and must not be published as current pricing without a deliberate reconciliation PR.

## Operator checklist

- [ ] Do not copy artifact dollar amounts into `content/seo/pages.json`, workers pricing HTML, or social bundles.
- [ ] If promoting tiers publicly, diff against `src/lib/plans.ts` and active Stripe products first.
- [ ] Keep this file in `docs/strategy/` only — internal reconciliation, not sitemap/blog content.
