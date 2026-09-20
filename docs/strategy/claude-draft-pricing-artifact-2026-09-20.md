# Cloudflare Automation / StrainChain Pricing Artifact

> **CLAUDE ARTIFACT DRAFT — NOT LIVE.** Do not wire into estate `/pricing`, marketing auto-publish, or Stripe.
>
> Captured from the Claude artifact in the chat “Cloudflare Automation Management” on **2026-09-20** for reconciliation only. No Stripe action, deployment, CTA submission, or live catalogue change was performed.

## Artifact identity and header

- Rendered title: **Choose Your Plan**
- Header copy: “Join 1,247+ cannabis businesses already using StrainChain”
- Billing toggle: **Monthly** (default) / **Annual — Save 20%**.
- Annual prices are implemented as monthly-equivalent prices and still display `/month`.
- Professional is marked **MOST POPULAR**.

## Plan inventory

### Basic

| Billing | Price shown | Annual savings text |
|---|---:|---:|
| Monthly | **$199/month** | — |
| Annual | **$159/month** | **Save $480/year** |

**Included features**

- 500 Monthly Scans
- 1 Brand Account
- 5 Artist Profiles
- Basic Analytics
- Email Support
- NFT Minting
- QR Authentication

**Shown as not included (dimmed/X)**

- API Access
- Compliance Reports
- White Label
- Priority Support

**Limits in source:** scans 500; brands 1; artists 5.

**CTA/trial:** `Start Free Trial`; “14-day free trial • No credit card required”.

### Professional — MOST POPULAR

| Billing | Price shown | Annual savings text |
|---|---:|---:|
| Monthly | **$499/month** | — |
| Annual | **$399/month** | **Save $1,200/year** |

**Included features**

- 2,500 Monthly Scans
- 5 Brand Accounts
- 25 Artist Profiles
- Advanced Analytics
- Priority Support
- Compliance Reports
- API Access (50K calls)
- Bulk Operations
- Custom Integrations

**Shown as not included (dimmed/X)**

- White Label
- Dedicated Support
- Custom Features

**Limits in source:** scans 2,500; brands 5; artists 25.

**CTA/trial:** `Start Free Trial`; “14-day free trial • No credit card required”.

### Enterprise

| Billing | Price shown | Annual savings text |
|---|---:|---:|
| Monthly | **$999/month** | — |
| Annual | **$799/month** | **Save $2,400/year** |

**Included features**

- Unlimited Scans
- Unlimited Brands
- Unlimited Artists
- Custom Analytics
- Dedicated Support
- White Label Options
- Unlimited API Access
- SLA Guarantee
- Custom Integrations
- Training & Onboarding
- Custom Reporting
- Priority Features

**Shown as not included:** none.

**Limits in source:** scans unlimited; brands unlimited; artists unlimited.

**CTA/trial:** `Start Free Trial`; “14-day free trial • No credit card required”.

## Other visible pricing/marketing material

- If current usage is available and the tier is `free`, the UI shows: “⚠️ You've used {scans} of 10 free scans this month. Upgrade now to continue scanning!”
- ROI panel: **34%** “Increase in Customer Loyalty”; **6 weeks** “Average Payback Period”; **100%** “Counterfeit Elimination”.
- Testimonial: Green Valley Premium — claims 100% counterfeit elimination and six-week payback.
- Testimonial: Maya Chen, Cannabis Artist — claims $2,500/month in royalties.
- FAQ: plans can be upgraded/downgraded anytime and changes take effect immediately.
- FAQ: approaching-limit notifications and an upgrade path; “You won't lose any data or functionality.”
- FAQ: custom enterprise pricing/features available by contacting the organization.
- Bottom copy: “Need help choosing the right plan?” with **Contact Sales** CTA.

## Source/behavior caveats

- Full source is saved in this repo as `claude-draft-pricing-artifact.tsx` (same directory).
- Source imports React hooks and `lucide-react` icons. `selectedTier` is initialized to `professional` but is not used in the rendered mapping.
- The trial buttons call `handleUpgrade` (not clicked during capture). If no browser `localStorage.userId` exists, the code alerts the user to log in. Otherwise it POSTs `/subscription/upgrade` with a placeholder `paymentToken: 'demo_token'`, then may redirect to `/dashboard`. This is draft/demo behavior, not evidence of a live Stripe integration.
- The component reads `localStorage.userId` and, when present, fetches `/subscription/usage`; no such calls were initiated by this capture.
- The source’s annual prices mathematically produce the displayed savings: Basic 199→159, Professional 499→399, Enterprise 999→799.

## Chat-side Cloudflare automation notes (separate from artifact catalogue)

The visible chat contains a deployment guide and monitoring checklist. These are preserved here as notes only; **nothing was deployed or run**.

- Suggested worker/project: `strainchain-nft-api`; suggested source file `strainchain-nft-api-v2.js` / `src/index.js` or `index.js`.
- Suggested Wrangler config: compatibility date `2024-01-01`, `workers_dev = true` in one variant, KV bindings `CACHE` and `ANALYTICS`, D1 binding `DB` for `strainchain-main`, and `PRICING_ENABLED = "true"` in one variant.
- Chat verification claims: pricing endpoint should return 3 tiers (Basic $199, Professional $499, Enterprise $999); new users have free-tier limits; a 402 should occur after 10 free scans.
- Chat describes a 10 free-scans/month limit, upgrade prompts, and suggested endpoints `/pricing`, `/subscription/status`, `/admin/revenue`, and `/scan-package`.
- Monitoring suggestions include `npx wrangler tail strainchain-nft-api`, pretty/status/method/search filters, exporting logs, looking for `/pricing` 200s, 402 limit hits, successful `/subscription/upgrade`, and 500/404/401 errors.
- Suggested rollback command in chat: `npx wrangler rollback --name strainchain-nft-api`.
- Chat also contains speculative conversion/revenue projections (5–10 upgrades day 1, 50+ week 1, 200+ month 1); these are not verified and are not catalogue facts.
- Chat mentions adding `STRIPE_SECRET_KEY`; this was **not** done.

## Live truth (monorepo — overrides this artifact)

Do not publish artifact tiers as current pricing. Money paths:

- `src/lib/plans.ts` and active Stripe Payment Links only
- AuthiChain DPP Readiness **$299**; StrainChain Passport **$49**, Farm **$149/mo**; QRON credit packs and Theater SKUs; DPP checkout routes — verify in `plans.ts` before any customer-facing change

## Capture files in repo

- `claude-draft-pricing-artifact.tsx` — full artifact React source (reference only).
