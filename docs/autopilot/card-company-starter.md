# First sale: $29 signed pack

Issue: none
Source: AuthiChain Board autopilot
Written: 2026-09-23T15:03:29.582Z

## Outcome
Surface the existing $29 signed pack (100 gens, Ed25519) and $49 Stripe Payment Links first on high-traffic pages users already open (home, generate, account). No email, outreach queues, revenue counting, or new checkout flows.

## Files to touch
- `apps/web/app/page.tsx` (or home layout)
- `apps/web/app/generate/page.tsx`
- `apps/web/app/account/page.tsx`
- `apps/web/components/PricingStrip.tsx` (new or extend)
- `apps/web/lib/stripe-links.ts` (constants only)

## Acceptance checks
- $29 link (`https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E`) and $49 link render above the fold on home, generate, and account.
- Links open Stripe checkout in same tab; no custom charge logic.
- No outbound mail, queues, analytics revenue events, or “pending = paid” paths.
- Free tools remain usable without payment.
- Build and typecheck pass; copy does not frame this as a design service.

## Patch sketch
```tsx
// apps/web/lib/stripe-links.ts
export const STRIPE_LINKS = {
  pack29: "https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E", // 100 gens + Ed25519
  pack49: "https://buy.stripe.com/REPLACE_49_LINK", // existing $49
} as const;

// apps/web/components/PricingStrip.tsx
import { STRIPE_LINKS } from "@/lib/stripe-links";

export function PricingStrip() {
  return (
    <aside className="w-full border-b bg-muted/40 px-4 py-3">
      <p className="text-sm font-medium mb-2">Signed packs</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={STRIPE_LINKS.pack29}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          $29 — 100 generations + Ed25519 signature
        </a>
        <a
          href={STRIPE_LINKS.pack49}
          className="rounded-md border px-3 py-2 text-sm"
        >
          $49 pack
        </a>
      </div>
    </aside>
  );
}

// apps/web/app/page.tsx (and generate/account): render <PricingStrip /> as first main child
```
