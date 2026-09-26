# First sale: $49 cultivar page

Issue: none
Source: AuthiChain Board autopilot
Written: 2026-09-23T15:03:05.437Z

## Increment: Surface $49 cultivar Stripe checkout

### Outcome
Visitors on an existing cultivar detail route see the live $49 Stripe payment link first (with the $29 link secondary). Checkout uses the provided Payment Link only. No email, outreach queues, revenue counters, or Metrc changes.

### Files to touch
- `apps/web/app/cultivars/[slug]/page.tsx` (or equivalent cultivar detail page)
- `apps/web/components/cultivar/CheckoutCtas.tsx` (new or thin wrapper)
- `apps/web/lib/commerce/stripeLinks.ts` (constants only)

### Acceptance checks
- [ ] Cultivar page renders `$49` CTA above `$29`, both pointing at existing Stripe Payment Links
- [ ] `$49` href is exactly `https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y`
- [ ] No outbound email, queue workers, or “pending charge = revenue” logic added
- [ ] Copy states purchase is certificate-backed cultivar access and does not replace Metrc
- [ ] Build/typecheck passes for touched packages only

### Minimal patch sketch
```ts
// apps/web/lib/commerce/stripeLinks.ts
export const STRIPE_LINKS = {
  cultivar49: "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y",
  cultivar29: "https://buy.stripe.com/REPLACE_WITH_EXISTING_29_LINK",
} as const;

// apps/web/components/cultivar/CheckoutCtas.tsx
import { STRIPE_LINKS } from "@/lib/commerce/stripeLinks";

export function CheckoutCtas() {
  return (
    <div className="flex flex-col gap-2">
      <a
        href={STRIPE_LINKS.cultivar49}
        className="btn btn-primary"
        rel="noopener noreferrer"
      >
        Buy cultivar — $49
      </a>
      <a
        href={STRIPE_LINKS.cultivar29}
        className="btn btn-secondary"
        rel="noopener noreferrer"
      >
        Buy cultivar — $29
      </a>
      <p className="text-sm text-muted">
        Certificate-backed purchase from brand inventory. Does not replace Metrc.
      </p>
    </div>
  );
}

// apps/web/app/cultivars/[slug]/page.tsx (placement only)
// import { CheckoutCtas } from "@/components/cultivar/CheckoutCtas";
// Render <CheckoutCtas /> at top of existing above-the-fold action column.
```
