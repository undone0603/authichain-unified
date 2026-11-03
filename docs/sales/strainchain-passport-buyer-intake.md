# StrainChain $49 Genetics Passport — paid buyer intake and acceptance

**Status: OPERATING TEMPLATE / HUMAN-HOLD, not an automated fulfillment endpoint.**  
The active payment link collects money; source files and issuer approval are not obtained by checkout alone. Never claim a paid receipt means an issued passport.

## Before payment: disclose prerequisites

- This is one cultivar genetics passport based on existing, authentic lab CoAs the buyer is entitled to submit.
- The buyer must have authority to make public genetics/chemistry claims for the named issuer/farm; a distributor or retail shopper may not have it.
- Publication follows source-panel reconciliation and authorized issuance. Payment alone does not cause instant publication.
- Package-level physical authentication, Metrc/state compliance certification, and a forensic counterfeit determination are **not included** in this $49 product.
- For a batch/packaging QR integration, agree a separate written scope, evidence custody and price before charge.

## After a real, independent live payment: private intake request

**Subject:** StrainChain passport order — evidence and issuer approval needed

Thank you for ordering a one-cultivar StrainChain Genetics Passport. To prepare an accurate, issuer-controlled passport, we need the issuer's written permission and original lab certificates for that cultivar.

Please first confirm the correct authorized business contact and an agreed private method for transferring CoA PDFs. Do **not** publish private source files or complete state tracking identifiers in a public issue or repository.

We will reconcile reported cannabinoid/terpene panels with the source documents, flag any differences for review and ask the authorized issuer to approve publishable information. This is not an instant authenticity certificate or a regulatory clearance. You retain the right to request withdrawal of your published record.

This order is complete only after a signed record has been issued, the public QR/verification target works, and you have confirmed access to the deliverable.

AuthiChain / StrainChain

## Private intake schema (operator use, never publish as raw JSON)

| Field | Required evidence | Failure behavior |
| --- | --- | --- |
| Stripe paid session | Authenticated live Stripe session + matching $49 price, payment intent/charge and buyer identity | HOLD; don't trust screenshots, metadata or a browser POST |
| Issuer namespace | Authorized legal business/brand and per-cultivar namespace | HOLD for ownership validation |
| Issuer approval | Written consent describing which lab data may be published | HOLD; don't mint |
| Original CoAs | Original lab PDFs including testing date, lab identity, sample ID and analyte panels | HOLD; no invented totals |
| Cultivar mapping | Buyer-approved mapping from CoA sample to cultivar | HOLD conflicting lineage/batches |
| Public fields | Explicitly approved data; avoid raw tracking IDs or personal data | REDACT or withhold |
| Revocation/export | Named authorized request process | Must be possible before delivery claim |
| Verification | Issuer-signed payload, verifiable public QR URL, independent verifier result | DELIVERED blocked until verified |

## Operational states and proof boundaries

- `CHECKOUT_STARTED`: Stripe session exists; **not payment**.
- `PAID_REVIEW_REQUIRED`: Signed, positive-amount live provider event reconciled to a real charge; **not delivery**. No founder/demo/zero-dollar purchase counts as a customer sale.
- `ISSUER_AUTHORIZATION_PENDING`: Buyer identity exists; permission and/or CoAs missing.
- `EVIDENCE_REVIEW`: Authorized original documents collected privately and reviewed.
- `ISSUANCE_APPROVED`: Source panel and public disclosure approved by issuer; not yet issued.
- `ISSUED_VERIFIED`: A verifiable signed record and QR target exist, with verifier evidence.
- `DELIVERED`: Authorized buyer notified and confirms usable access; record first value separately.

All transitions need timestamps, opaque session identifier, evidence references and responsible actor. Store no secrets or raw CoAs in a public repository. Reject manual status advancement that purports to replace Stripe verification. Duplicate provider events must not create second orders or certificates.

## Existing implementation and blocker

- `src/lib/plans.ts` defines the existing $49 `strainchain_passport` payment offer.
- `workers/stripe-webhook/src/grant-map.ts` deliberately holds it with `humanHold: true` and `generations: 0`.
- `src/lib/strainchain-lifecycle.ts` has evidence preflight but does not mint, anchor or publish.
- PR #2305 adds privacy-safe package evidence and accurate storefront wording; issue #2307 tracks persistent order intake, secure source upload and signed fulfillment.

**No production migration, buyer email, auto-charge, or issuer seal is authorized by this template.**
