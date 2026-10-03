# First-dollar growth loops — 2026-09-28

Owner: Growth Loop Operator.
Catalog freeze: `src/lib/plans.ts` `PUBLIC_PLAN_IDS` only.
Live money: 0 stranger customers. One founder $10 charge is not a sale.
Do not list First Dollar $1 or AuthiChain Seal $99/mo.
Apex CTAs only: `/generate`, `/checkout/{plan}`, `/dpp-check`, `/verify`, `/onboard`. Never a `*.vercel.app` URL.

## Current readiness blocker — 2026-10-03

LOOP-03 is instrumented for `/generate` views, anonymous submissions, and
checkout views/session starts, but it is **not launch-ready**: `POST /api/generate`
requires an authenticated user and returns 401 for an anonymous visitor.
`worker-app/index.ts` deliberately does not emit `free_gen_granted` or
`free_gen_exhausted` because the promised anonymous five-generation tier does
not exist. Do not describe the current flow as “five free” or use the LOOP-03
kill threshold until either that tier is implemented and verified or the offer
and its copy are revised to match the existing sign-in/credit flow.

## Priority

1. LOOP-03 QRON generate → Starter $29 (first stranger dollar).
2. LOOP-02 /dpp-check → $299 (after LOOP-03 events exist).
3. LOOP-01 genetics QR → Passport $49 (content already live; do not spend founder time on MSO email).

GovChain stays `/onboard` only. No self-serve gov price. No FedRAMP-ready claim.

---

## LOOP-03 — QRON generate → Starter $29

### Page: `qron.space/generate` (proxied to AuthiChain app)

- **Headline:** Generate a Living QR. Five are free.
- **Subhead:** Enter a product URL and an optional style prompt. Each free generation is lookup-verify only. Signed AuthiChain verification is in development.
- **Proof (citeable only):** Ed25519 JWKS at `https://authichain.com/.well-known/jwks.json`. Polygon certificate contract `0x4da4D2675e52374639C9c954f4f653887A9972BE`. No customer logos.
- **Primary CTA:** Queue Living QR
- **Secondary CTA:** Buy Starter Pack — $29 → `https://authichain.com/checkout/starter`
- **Tertiary:** Start Launch $19/mo → `https://authichain.com/checkout/qron_launch`

### Paywall at 5/5 free

- **Headline:** Those 5 are signed. The next 100 are $29.
- **Subhead:** Starter Pack — 100 AI QR generations that never expire. No subscription.
- **CTA:** Buy Starter Pack $29 → `/checkout/starter`
- **Secondary:** or Launch at $19/mo → `/checkout/qron_launch`

### Checkout gate (`/checkout/starter`)

- Work email required before the Stripe session starts.
- Line: “We use this for your receipt and to follow up if checkout doesn’t finish. No newsletter.”
- Payment Link fallback: `https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E`

### FAQ

1. **What do I get for $29?** 100 AI QR generations that do not expire.
2. **Is the QR an AuthiChain authenticity proof?** The generation is live. Signed product verification against the physical item is in development. A scannable QR is not by itself a proof of authenticity.
3. **Do you email a list?** No. Email is receipt + abandoned-checkout recovery only.

### Meta

- Title: `Living QR generator | QRON — 5 free, then $29`
- Description: `Generate scannable AI QR art. Five free lookup-only generations, then a $29 Starter Pack of 100 that never expire.`

### JSON-LD

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "QRON Living QR generator",
  "applicationCategory": "DesignApplication",
  "offers": {
    "@type": "Offer",
    "price": "29.00",
    "priceCurrency": "USD",
    "url": "https://authichain.com/checkout/starter"
  }
}
```

### Loop mechanics

| | |
|---|---|
| Trigger | Anonymous hit on `/generate` |
| Mechanism | 5 free → hard paywall → email-gated `/checkout/starter` → Stripe |
| CVR | estimate 2–6% submit → paid (no stranger baseline yet) |
| Events | `generate_view`, `generate_submit_anon`, `free_gen_granted`, `free_gen_exhausted`, `checkout_starter_view`, `checkout_email_captured`, `checkout_session_started`, `checkout_abandoned`, `purchase_starter_succeeded` |
| Kill | 14 days after events exist: 0 non-founder `purchase_starter_succeeded` and ≥200 `generate_view` |

### Lifecycle email (recovery only)

**T+1h abandoned**  
Subject: Your Starter Pack checkout is still open  
Body: You left 100 QRON generations unpaid. No list. This is the open cart.  
CTA: Finish $29 checkout → `https://authichain.com/checkout/starter`

**T+24h abandoned**  
Subject: 100 generations, $29, no subscription  
Body: Starter Pack does not renew. Credits do not expire.  
CTA: same.

**T+72h stop.** No third email. No win-back coupon invented.

---

## LOOP-02 — DPP-check magnet → $299

### Page: `authichain.com/dpp-check`

- **Headline:** Map your EU DPP gaps. Free.
- **Subhead:** AuthiChain does not operate the EU DPP registry. This check is a readiness map, not a filing, not a notified-body opinion, and not legal advice.
- **Proof:** Live JWKS, `/protocol` verdicts (`verified`, `valid-unanchored`, `invalid`), contract above. Programmatic SEO already covers battery, textile, electronics slugs — point every slug CTA here, not at a call.
- **Primary CTA after score:** Start EU DPP Readiness — $299 → `/checkout/dpp_readiness`
- **Secondary:** Onboard a pilot — work email, no call → `/onboard`

### FAQ

1. **Does $299 file my passport with the EU?** No.
2. **What does $299 buy?** A written readiness assessment, self-serve workspace activation, and 50 generations to publish a first passport draft.
3. **Is AuthiChain a GS1 Conformant Resolver?** No.

### Meta

- Title: `Free EU Digital Product Passport readiness check | AuthiChain`
- Description: `Score DPP gaps for free. Written readiness and workspace activation are $299. AuthiChain does not operate the EU registry.`

### Loop mechanics

| | |
|---|---|
| Trigger | `/p/{dpp-slug}` or docs visitor |
| Mechanism | Free score → email optional → `$299` gated checkout |
| CVR | estimate 0.5–2% completed check → paid |
| Events | `dpp_check_view`, `dpp_check_completed`, `dpp_check_email_captured`, `checkout_dpp_view`, `purchase_dpp_succeeded` |
| Kill | 30 days: 0 non-founder paid and ≥80 completed checks |

Proof still required before any “brands use this” line: one stranger `purchase_dpp_succeeded` plus the delivered written assessment file.

---

## LOOP-01 — Genetics page / QR → Passport $49

### Page pattern: `strainchain.io/genetics/{farm}/{cultivar}`

Use the live VT-26 page as the template. Do not invent panels.

- **Headline:** `{Cultivar}` · `{Farm}`
- **Subhead:** Totals on this page are recomputed from the lab panel at render time. A scan is not a potency guarantee.
- **Proof:** Named CoA sample IDs already on the page. METRC integration is on the roadmap — do not say live.
- **Primary CTA:** Publish your cultivar — $49 → `/checkout/strainchain_passport`
- **Secondary:** Farm Plan $149/mo → `/checkout/strainchain_farm`

### FAQ

1. **Does this replace METRC?** No.
2. **Is the COA hashed on-chain today?** Hashing COAs on-chain is in development.
3. **What does $49 publish?** One cultivar passport from CoAs you already have, with a public verify URL.

### Meta

- Title: `{Cultivar} genetics passport | {Farm} | StrainChain`
- Description: `Recomputed cannabinoid and terpene totals from filed CoAs. Publish your own cultivar passport for $49.`

### Loop mechanics

| | |
|---|---|
| Trigger | Organic genetics URL or package QR |
| Mechanism | Public record → $49 self-serve publish |
| CVR | estimate 1–4% view → paid |
| Events | `genetics_view`, `passport_qr_scan`, `checkout_passport_view`, `purchase_passport_succeeded` |
| Kill | 30 days: 0 non-founder paid and ≥150 genetics views |

---

## What not to launch this batch

- Directory listings that need a human application.
- LinkedIn / MSO outreach.
- GovChain paid SKU.
- Medical-device or FDA language.
- Fabricated scan-rate, dwell-time, or customer-count metrics.
- Marketing the $1 First Dollar SKU.

## Instrumentation contract

Fire the event names in `src/lib/growth/loops.ts` with `{ loop, sku, email_hash?, founder: boolean }`.
`founder` is true when billing email is `undone.k@gmail.com` or `authichain@gmail.com` — exclude from conversion math.

## Founder yes/no

Merge `growth/2026-09-28-first-dollar-loops` and wire LOOP-03 events + 5/5 paywall copy on `/generate` and `/checkout/starter`.
Do not send mail. Do not create Stripe products. Do not list $1 or Seal $99.
