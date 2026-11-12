# Aerospace component provenance — buyer discovery and proof-of-value pilot

**Status:** candidate, unshipped. This is a commercial discovery proposition, NOT aerospace certification or a flight-release system. P0 remains the independently paid $299 DPP Readiness sale. Do not attach a mandatory aerospace gate to that checkout.

## Problem to validate
Aerospace supplier-quality teams need to reconcile genuine manufacturer source, authorized distributor, part identity, custody events, test and inspection reports, discrepancies, and controlled hardware release. A signed CoC, scanned QR or ledger entry alone is insufficient. An independent supplier/quality buyer must confirm this is a purchasing priority and budget exists.

## Proposed deliverable
- A **synthetic, no-customer-data prototype** `scripts/ci/aerospace-acceptance.mjs` with 27 adversarial Node tests.
- A bounded AgentZ opt-in workflow `aerospace_preacceptance_pilot` executing **only** these local tests. It never opens a browser or sends outreach and cannot approve parts for flight.
- A candidate paid scope, to negotiate only after discovery: buyer-provided anonymized sample of **one** component/lot, evidence-mapping and discrepancy report, acceptance findings and a validation matrix. No government data, export-controlled drawings, secrets, regulated test records or actual component certification requested. No custom build or flight integration promised.
- A buyer-specific statement of work must define price, timeline, rights, exclusions, acceptance criteria and payment terms **before** a checkout or invoice is issued; the existing $299 DPP readiness product is not repackaged as a certified aerospace inspection.

## Initial buyer discovery based on public evidence
- **Firefly Aerospace** — NASA's Small Business Subcontracting profile explicitly lists a counterfeit parts prevention program as a desired supplier qualification; its public supplier portal has a supplier interest form. This establishes **topic relevance, not buyer interest or a sale**. Source: https://www.nasa.gov/osbp/prime-contractor-firefly/ and https://fireflyspace.com/suppliers/.
- **SpaceX** — a saved Apollo account exists; this does **not** indicate an interested or qualified contact. Do not create an opportunity or count it as pipeline without a verified introduction or explicit reply.
- **Existing AuthiChain product buyers and pilots** — prioritize already engaged, independently interested contacts over unsolicited aerospace claims; this keeps the legitimate $299 path faster.

## Buyer qualification and negotiation
1. Use official supplier/vendor channels first; establish whether a small software evidence-mapping pilot is in scope, whether the buyer requires AS9100/ISO, ITAR, CMMC, insured testing or procurement onboarding, and who controls budget.
2. Request an **anonymized, non-sensitive** evidence example only after approval. Never ask for restricted spacecraft designs or controlled component details.
3. Present a *nonbinding* pilot scope and demo with explicit limits: AuthiChain verifies digital evidence and evaluates anomalies; it does **not** certify hardware or replace the buyer's inspection and release authority.
4. Qualify business authority, exact use case, budget and willingness to pay. Negotiate documented fixed scope and terms, and send a quote only on a valid buyer request.
5. Use an independently authorized paid payment rail. Confirm cleared funds, durable entitlement/delivered report, acceptance evidence and non-founder attribution before recognizing a WIN.
6. Respect `production_send=false`, `humanHold`, $0 discretionary spend and all protected release requirements. No autonomous cold send on a held sender. No CRM 'closed won' until authoritative payment settles.

## Pilot acceptance metrics
- 100% of specified negative fixtures cause `HOLD` with `flightReleaseAuthorized=false`.
- Complete synthetic evidence results only in `ELIGIBLE_FOR_HUMAN_REVIEW` — never flight approval.
- No invented counterfeit verdict from incomplete evidence.
- Runtime source SHA, native CI logs, trusted upstream-source checks, named buyer acceptance, signed scope, payment intent/settlement and actual delivered output are separate records.
- Any missing evidence remains UNKNOWN/PENDING, not success.

## Commercial WIN definition
**Qualified non-founder buyer + signed agreement or checkout + actual settled payment + verifiably delivered and accepted paid output.** A lead, meeting, response, draft, free test, $0 session, pending charge or unfulfilled payment is **not** a WIN.
