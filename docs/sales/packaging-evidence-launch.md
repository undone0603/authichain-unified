# AuthiChain / StrainChain — package evidence commercial launch packet

**2026-11-02 · Public-safe commercial draft · No issuer endorsement or payment implied.**

## Buyer and problem

Buyer: manufacturer, licensed distributor, authorized brand owner, or laboratory with legitimate authority to supply label specifications, state-traceability records and lab certificates. Do not target end consumers with physical cannabis sales. The sample used to design the workflow is a Michigan **trade sample explicitly not for resale**; observed packaging data are not issuer-attested.

Problem: a printed QR and state tag can identify a record but cannot alone prove who issued it or whether the pictured physical package corresponds to that record. A separate tracking label shown behind a package requires reconciliation, **not an allegation of tampering**.

## Currently purchasable (do not rename a product to disguise scope)

- **StrainChain genetics passport — $49 per cultivar**, built from authorized issuer-supplied CoAs; existing live catalogue and checkout: https://authichain.com/trumark then https://authichain.com/checkout/strainchain_passport.
- Deliverable is a passport based on reviewed source panels, QR/shareable link as described in `src/lib/plans.ts`. **No packaging forensic certificate, verification guarantee, regulatory determination, or trade-sample transfer is included**.
- Manufacturer label/QR program: request an asynchronous **written packet** at hello@authichain.com (custom enterprise scope; no invented price).

## Verified commercial readiness

**CHECKOUT ACTIVE; PASSPORT FULFILLMENT HUMAN-HELD.** The existing live Stripe link contains the $49 passport price, but `workers/stripe-webhook/src/grant-map.ts` sets `strainchain_passport` to `humanHold: true`, zero automatic credits, and no certificate. There is no verified automated CoA review, issuance, or customer delivery. Therefore customer-facing materials must disclose evidence review before issuance, and the existing payment link must not be represented as immediate delivery. The first real paid order requires an auditable operator/intake response before any announcement of completion.

**Release gate:** Provide a documented post-checkout route for the buyer to supply authorized CoAs, an owner-review queue, a confirmed issuer signature, a public verifiable issued artifact, and explicit customer acceptance. Keep the manual issuance hold until those checks are demonstrated. Never silently change a held purchase to a grant.

## Buyer journey / completion gates

1. **Discovery.** Share a redacted observation-only demo and explain the missing issuer, label-binding and CoA proof. Obtain contact from a public, legitimate business source; comply with opt-out/suppression rules. No mass-send or impersonation.
2. **Qualification.** Buyer confirms authority over the cultivar/labels and availability of underlying CoAs and intended publishable information. Do not ingest raw state tracking identifiers before a safe intake channel is agreed.
3. **Checkout.** Buyer chooses the existing $49 product via its gated checkout; Stripe must show a distinct non-founder `paid` live session. A visible link or created session is not a sale.
4. **Fulfillment.** Confirm webhook signature, idempotent entitlement, access provisioned, CoA reviewed against source, issuer approval, public QR/record issued with a verifiable signature. **Do not claim this is automated until tests and real worker evidence demonstrate each step.**
5. **Acceptance.** Independent verifier returns issuer/evidence and a precise bounded result; a missing record does not mean counterfeit. Record actual buyer activation and first successful verification, not only payment.
6. **Retain.** Offer multi-cultivar scope only after first customer receives the promised passport. No new billing or unchecked automatic charges.

## First outreach draft (async, one-to-one, permission-based)

**Subject: Can your team independently verify what a package QR claims?**

We are testing an evidence-first packaging workflow for authorized brands: photograph and label observations are hashed, apparent identifier mismatches are flagged for reconciliation, and issuer-authenticated provenance remains separate from what a QR alone claims. A redacted Michigan trade-sample example demonstrates the missing link—not a counterfeit accusation or certification.

For brands with their own lab CoAs, StrainChain offers one genetics passport at $49 through a self-serve checkout: https://authichain.com/trumark. If your priority is batch-level labeling and issuer verification rather than a genetics passport, I can send a written scope packet by email. No sales call is needed. Please reply 'no' and I won't follow up.

AuthiChain / StrainChain

## Launch proof register

| Gate | Evidence | Current verified state |
| --- | --- | --- |
| Repo | `undone0603/authichain-unified` | public repository; source-of-truth catalogue `src/lib/plans.ts` |
| Live sales page | https://authichain.com/trumark | GET page reachable 2026-11-02 |
| Stripe price and link | Existing live account | active $49 payment link; no new products or charges created by this packet |
| Local evidence tool | `tools/package-evidence/` | Node tests and generated case report; not issuer verification |
| Target buyer | One authorized brand/lab | **Not yet qualified/contracted** |
| Buyer money | Positive live non-founder payment | **Not established** |
| Entitlement and activation | Stripe webhook + usable passport | **Not established for this campaign** |

### Safeguards

Do not publish the user's raw media, complete Michigan tracking IDs, or unconsented issuer facts. Preserve `production_send`/`human_send_approved` authorization and campaign suppression. Do not bypass CI, environment reviewers, payment/billing locks or issue seals without issuer authority. A repository PR is not a production deployment.
