# TruMark vs Passport vs DPP

**Date:** 2026-09-20 · **Status:** active · **Spend:** $0 · **Legal:** ZACHARY KIETZMAN (SAM). AuthiChain is a brand, not AuthiChain Inc.

This note exists so marketing, SEO, and checkout copy stop collapsing three different things into one invented SKU.

---

## Positioning

| Name | What it is | What it is not | Live money rail |
|---|---|---|---|
| **TruMark** | The physical / scan seal. A shopper or inspector points a camera at a tag. Already named in the StrainChain demo (“Simulate TruMark Scan”), enterprise tag-mint copy, and the shared “01 / TRUMARK” theme. | Not a Stripe product. Do not invent a TruMark price or a “seal mint” checkout. | Story page: `https://authichain.com/trumark`. CTAs below. |
| **Passport** | StrainChain genetics passport, one cultivar, built from existing CoAs. Totals are recomputed from the raw panel at render time — never transcribed. | Not an origin-claim product. Not unlimited tag mints. | `$49` · `GET https://authichain.com/api/checkout/plan/strainchain_passport` |
| **DPP** | AuthiChain EU DPP Readiness: written assessment, self-serve activation, 50 workspace generations. The same rail used for Made in USA / origin-claim documentation. | Not a genetics passport. Not a call with sales. | `$299` · `GET https://authichain.com/api/checkout/dpp` |

Enterprise tag programs (unlimited TruMark mints, channel printers) are a **written packet** via `hello@authichain.com`, or the published catalogue at `/pricing`. Do not quote a number that is not in `src/lib/plans.ts`.

---

## Made in America

Public surfaces: `/made-in-america` (canonical), `/partners/brief`, `/ftc-shield`.

Hold to:

- The rule a seller is held to is the **FTC Made in USA Labeling Rule (16 CFR Part 323)**.
- **EO 14392** is context (agencies directed to prioritize truthful Made in America advertising). It is not a product certification.
- USDA “Product of USA” is a separate meat / poultry / egg standard.
- A signed record is **evidence**, not a finding that the product meets all-or-virtually-all.

National branding missions (Office of Made in America / GSA / Commerce) stay async: self-serve checkout or a written packet. No “book a call.”

---

## CTAs that are allowed

1. Passport checkout — `$49`
2. DPP checkout — `$299`
3. `/pricing`
4. `mailto:hello@authichain.com` with subject “written packet”

Forbidden on these surfaces: Calendly, “book a call,” “book a demo” as a meeting, AuthiChain Inc. letterhead, invented TruMark or enterprise prices.

---

## Code pointers

- Live catalogue: `src/lib/plans.ts` (`strainchain_passport`, `dpp_readiness`)
- Apex pages: `workers/authichain-com/src/money-surfaces.ts`
- Next.js mirrors: `src/app/trumark/page.tsx`, `src/app/made-in-america/page.tsx`, `src/app/partners/brief/page.tsx`
- Programmatic SEO: `scripts/gen-seo-pages.cjs` (`isMusaKeyword`, `isTrumarkKeyword`)
