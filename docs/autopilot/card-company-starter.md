# Sell the $29 Starter pack before building more

Issue: none
Source: AuthiChain Board autopilot
Written: 2026-09-23T14:22:31.179Z

## Increment: Surface $29 Starter checkout CTA

### Outcome
Ship a single, prominent path to the live $29 Starter pack Stripe checkout (100 Living QR generations, one-time) so visitors can buy before more product work. Reuse the existing payment link; do not add a second checkout or new Stripe session flow.

### Files to touch
- `apps/web/app/page.tsx` (or main landing) — hero/pricing CTA
- `apps/web/components/PricingCta.tsx` — small presentational CTA (new if missing)
- `apps/web/lib/commerce.ts` — constant for Starter URL only
- Optional: `apps/web/app/pricing/page.tsx` — same link if pricing route exists

### Acceptance checks
- [ ] Primary CTA label clearly offers Starter ($29) and opens `https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E` in same tab
- [ ] Creator pack URL is not used on the primary CTA; no second checkout created
- [ ] CTA renders on mobile and desktop; link is plain HTTPS anchor (no client Stripe.js required)
- [ ] No secrets, price logic, or Supabase/Workers changes in this increment
- [ ] Copy mentions one-time 100 Living QR generations; does not claim deploy/metrics

### Minimal patch sketch
```ts
// apps/web/lib/commerce.ts
export const STARTER_CHECKOUT =
  "https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E";
// Creator (secondary only): https://buy.stripe.com/aFa8wP0EV2l08um8rq1ND3F

// apps/web/components/PricingCta.tsx
import { STARTER_CHECKOUT } from "@/lib/commerce";

export function PricingCta() {
  return (
    <a
      href={STARTER_CHECKOUT}
      className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium"
    >
      Get Starter — $29 · 100 Living QR generations
    </a>
  );
}

// apps/web/app/page.tsx (hero fragment)
import { PricingCta } from "@/components/PricingCta";
// ...
<section className="space-y-4">
  <h1>AuthiChain Living QR</h1>
  <p>One-time Starter pack. Sell first; build next.</p>
  <PricingCta />
</section>
```
