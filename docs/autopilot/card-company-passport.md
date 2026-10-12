# First sale: $49 cultivar page

Issue: none
Source: AuthiChain Board autopilot
Written: 2026-10-12T03:07:49.131Z

## Increment: First-sale $49 cultivar page

### Outcome
Ship a single cultivar “StrainChain Passport” page that surfaces the existing $49 Stripe checkout first (and $29 second) on a route people already open. One cultivar tied to certificates the brand already holds. Does not replace Metrc. No outbound email, no outreach queues, no treating pending charges as revenue.

### Files to touch
- `apps/web/app/checkout/strainchain_passport/page.tsx` — cultivar passport landing + CTA order
- `apps/web/components/checkout/StripeLinkCTA.tsx` — thin wrapper for existing $29 / $49 Payment Links
- `apps/web/lib/commerce/firstSale.ts` — constants + “completed only” revenue guard
- `apps/web/app/api/stripe/webhook/route.ts` — ignore `payment_intent.processing` / pending for any first-sale counter
- `apps/web/content/cultivars/passport.mdx` (or equivalent CMS slice) — copy for one existing certificate-backed cultivar

### Acceptance checks
- [ ] `/checkout/strainchain_passport` loads; $49 link is the primary CTA, $29 secondary
- [ ] CTAs point at existing Stripe Payment Links only (no new products, no invented keys)
- [ ] Page states passport is certificate-backed for one cultivar and is not a Metrc substitute
- [ ] No email templates, send jobs, or outreach queue toggles changed/re-enabled
- [ ] Any first-sale / revenue path counts only `checkout.session.completed` (or equivalent success); pending/processing excluded
- [ ] No claim of live revenue or deployment in code/comments

### Minimal patch sketch
```tsx
// apps/web/lib/commerce/firstSale.ts
export const STRAINCHAIN_PASSPORT = {
  path: "/checkout/strainchain_passport",
  // Existing Payment Links — replace hrefs with repo’s real env-backed constants
  primary49: process.env.NEXT_PUBLIC_STRIPE_LINK_49!,
  secondary29: process.env.NEXT_PUBLIC_STRIPE_LINK_29!,
} as const;

export function isCountableFirstSale(eventType: string) {
  // Pending charges are not revenue
  return eventType === "checkout.session.completed";
}

// apps/web/components/checkout/StripeLinkCTA.tsx
export function StripeLinkCTA() {
  return (
    <div className="flex flex-col gap-3">
      <a href={STRAINCHAIN_PASSPORT.primary49} className="btn-primary">
        Buy StrainChain Passport — $49
      </a>
      <a href={STRAINCHAIN_PASSPORT.secondary29} className="btn-secondary">
        $29 option
      </a>
      <p className="text-sm text-muted">
        One cultivar passport from certificates on hand. Does not replace Metrc.
      </p>
    </div>
  );
}

// apps/web/app/checkout/strainchain_passport/page.tsx
export default function StrainchainPassportPage() {
  return (
    <main>
      <h1>StrainChain Passport</h1>
      {/* Certificate
