# StrainChain SealLock v0.1 — demonstrable first-opening integrity

**Status: proposed technical standard, not a certification or Michigan enforcement ruling.**
**No product accused. No production activation.** This is a research/pilot specification
for consumer packages that are presented as sealed. It does not claim an opened
package is counterfeit.

## Failure mode illustrated by the private reference photographs

A consumer pouch has an intact-looking hanging/tear-away top while its interior
mouth is visibly open; the observer reports only a resealable zipper inside.
Classification: **OPEN_MOUTH_TEAR_FEATURE_INTACT (observation)**. Time of opening,
initial seal history, actual factory process and contents are **unverified**.
A subsequent photo shows a retail tracking label whose barcode matches the
identifier printed on the earlier pouch. The observer states that the package
was obtained as an **unopened retail unit directly from the named producer**.
That is a first-person retail-origin statement, NOT independent evidence of
original factory sealing, chain of custody, or the actual condition at sale.
The matching barcode links the pictured labels, but barcodes can be copied.
The original photos, identifying codes and source details stay in a private
case packet, not this repository. A QR identifier only identifies a record; it does not
prove a manufacturer's issuance, physical seal or untampered contents.

## Required physical construction

A primary consumer package advertised as sealed MUST provide a continuous,
irreversible **first-opening barrier** between all product-accessible paths
and the exterior. An internal reclosable zipper, decorative tear notch,
perforated flap, hanging-hole strip, or QR code does NOT qualify.

- Pouch option: a continuous factory-validated heat weld **between the
  tear-away entry and the zipper**, across the complete product access path,
  including both edges/corners. The product is inaccessible until the user
  irreversibly cuts, tears or breaks the weld.
- Jar option: an independently validated destructible foil membrane or
  equivalent one-use barrier inside the lid. A child-resistant lid alone
  does not qualify as a first-opening witness.
- No alternate route (side seam, bottom seam, zipper edge, detachable label)
  may permit product access without an irreversible, detectable alteration.
- Child resistance and accessibility must be tested **separately**. A
  difficult-to-open closure is not a substitute for tamper evidence.

## Mandatory verification gates

| Gate | Required evidence | Result if missing |
| --- | --- | --- |
| BARRIER_DESIGN | Cross-section drawing identifying continuous first-opening barrier, zipper position, every product-access path | NOT_DEMONSTRATED |
| PROCESS_PROOF | Lot, machine, approved temperature/pressure/dwell windows, calibrated readings, rejects/quarantine, seal sample testing | NOT_DEMONSTRATED |
| BYPASS_CHALLENGE | Independent, continuous pre-opening-to-access video and documented attempt to reach contents without breaking the first barrier; include seam/edge routes | HOLD_FOR_REVIEW; witnessed silent bypass = FAIL |
| SEAL_TEST | Applicable seal-strength and leak methodology with predetermined material-specific acceptance thresholds and sample plan; independent reviewer if claiming external validation | NOT_DEMONSTRATED |
| PER_UNIT_TRACE | Unit/lot/issuer identifier; signed issuer record, process evidence hash, seal design revision, inspection outcome | NOT_DEMONSTRATED |
| RETAIL_HANDOFF | Receiving inspection records intact seal or holds suspicious/unknown stock; no inference from QR alone | HOLD_FOR_REVIEW |

Examples of test methods for engineer selection: ASTM F88/F88M for flexible
seal strength; ASTM F3039 for destructive nonporous packaging dye-penetration
leak detection where applicable. Neither individually establishes that an
entire package resists a silent first-opening bypass, so perform the
separate adversarial access challenge. Never invent pass thresholds.

## StrainChain verification states

1. **NOT_ASSESSED** — insufficient package observations.
2. **OPEN_MOUTH_TEAR_FEATURE_INTACT** — photograph or other observation
   shows mouth open while apparent tear-away feature appears intact.
   This is a real visual contradiction to a *claimed* tear-first design,
   but not proof of what happened at the factory.
3. **BYPASS_SUSPECTED** — access without destruction is *reported* and
   supported by images, but no authenticated continuous first-opening
   record or chain of custody exists.
4. **BYPASS_WITNESSED_REVIEW_REQUIRED** — reported continuous first-opening evidence, independent
   observer and the defined access challenge establish accessibility
   without destruction. Requires human review; not a legal finding.
5. **FIRST_OPENING_BARRIER_OBSERVED** — a physical barrier appears in
   visual evidence but has not passed all qualification gates.
6. **DESIGN_QUALIFIED (future, not emitted by this code)** — only a
   separate authorized, independently verified design-review process could
   make this designation. No local classifier, photograph, uploaded metadata,
   hash or test fixture can certify a design or a specific retail unit.

All states carry explicit boundaries: no counterfeit conclusion, no legal
noncompliance determination, no unauthorized lab/Metrc integration, no
hash-as-authenticity claim.

## Enforceable design-review preflight (v0.2 branch implementation)

`scripts/strainchain/seal-design-preflight.mjs` adds a **separate**
manufacturer-design evidence gate. It never changes the classification of a
consumer's photographs, and it does not certify or release any stock.

The submission requires:
1. A design/revision and evidence of an **irreversible first-opening barrier**,
   located before the reusable closure, that covers every contents-access path
   including corners, side seams, zipper ends and bottom seams.
2. A SHA-256-referenced **predeclared acceptance criteria** document and
   **sampling plan**. The standard does not prescribe arbitrary strength or
   leak thresholds; the qualified packaging engineer must specify those in
   advance for the selected materials, packaging geometry and intended use.
3. Seven individually reported checks: `barrier_design`,
   `process_controls`, `bypass_challenge`, `seal_strength`,
   `leak_method_if_applicable`, `unit_trace`, `retail_handoff`.
4. A first-opening challenge, including test count, whether the witness
   recorded the entire opening sequence, whether **all access routes** were
   challenged and whether contents were accessed without destroying the barrier.
5. An evidence hash for each passing/failing gate. The leak method may be
   **not applicable** only with a documented, independently reviewable reason.
   Neither the method nor the result may be fabricated to satisfy a gate.

The decisions are strictly:

| Software assessment | Meaning | Product release |
| --- | --- | --- |
| `BLOCK_REPORTED_BYPASS_OR_FAILED_GATE` | Submission reports a missing barrier, accessible zipper, unprotected access route, silent bypass or failed gate | **HOLD** |
| `BLOCK_INCOMPLETE_DESIGN_EVIDENCE` | One or more required observations, tests, evidence references or qualifications are missing/unknown | **HOLD** |
| `READY_FOR_INDEPENDENT_REVIEW_ONLY` | Submitted metadata is internally complete and self-consistent enough for a qualified reviewer to audit the actual documents and samples | **HOLD** |

`READY_FOR_INDEPENDENT_REVIEW_ONLY` is deliberately **not** an approval.
The supplied reviewer role is just a claim; an independent reviewer must
authenticate identities, obtain original test data, verify hash correspondence,
confirm seal/test standards and applicability, inspect samples and validate
acceptance criteria. A signed record requires independently trusted AuthiChain
issuer-key verification. A QR code or a copied barcode is not that proof.

Test offline with Node 22, without secrets or services:

```sh
node --test scripts/strainchain/seal-evidence.test.mjs
node --test scripts/strainchain/seal-design-preflight.test.mjs
```

The test files cover refusal of zipper-first and side-seam access, claimed
silent entry, missing sample evidence, invalid hashes, unqualified exceptions,
failing strength tests and the no-automatic-release invariant.

**Physical enforcement model:** producers validate and record the sealing
process per lot; independent reviewers challenge representative quarantined
samples; participating receiving retailers put ambiguous/failing lots on
contractual hold; genuine issuer attestations link designs and lots to the
consumer-facing record. StrainChain itself is not a regulator and cannot
compel independent businesses to adopt this workflow. An issuer-signed
document is evidence of the *claim*, not an independent physical guarantee.

**Methods distinction:** [ASTM F88/F88M-23](https://store.astm.org/standards/f88_f88m)
measures flexible seal strength; [ASTM F3039-23](https://store.astm.org/standards/f3039)
identifies certain nonporous package leaks using destructive dye penetration. Neither proves that an entire unopened bag resists silent
entry through a bypass route. Verify the applicable methods and specimen
handling with an independent packaging engineer. Do not use destructive
test samples for retail resale.

## Evidence added after first observations

- Record a dated **observer statement** describing where and in what stated
  condition the unit was received, and whether the seller described it as unopened.
- Retain the original retail receipt, packaging, contemporaneous photographs,
  and barcode/package-number agreement **privately**.
- The classifier flags `RETAIL_UNOPENED_AS_REPORTED_NOT_INDEPENDENTLY_VERIFIED`
  separately; this does **not** upgrade `BYPASS_SUSPECTED` to witnessed proof.
- Request factory sealing specifications for that exact package design/lot,
  including location of the irreversible barrier relative to the zipper.
- Never equate a license number, duplicate barcode or matching package name
  with a trusted issuer signature or proof of regulatory compliance.

## Suggested first pilot

Select a sample of **unopened, original retail units** from multiple lots
and designs with receipts and timestamps. Before touching a tear feature,
record continuous video showing both sides, top/zipper, seams and the label.
With the manufacturer's barrier layout in hand, run a documented independent
access challenge. Preserve untouched controls separately. For each unit
record design, lot, witness, chain-of-custody, whether contents were reached,
whether the tear feature was destroyed, and the native video/photo SHA-256.
No tampering with products for resale; destructive tests use quarantined
samples. Do not publish product IDs or images without permission.

If silent access is reproducibly witnessed, notify the supplier/manufacturer
with a neutral report and offer a documented corrective-action review.
Regulator notification follows applicable reporting rules and defensible
evidence, not inference about motives.

## Compliance boundary

[Michigan Administrative Code R 420.504](https://ars.apps.lara.state.mi.us/AdminCode/DownloadAdminCodeFile?FileName=R+420.1+to+R+420.1004.pdf&ReturnHTML=True)
requires the container, bag or product holding marihuana to be sealed and
labeled before retail sale or transfer.
Whether a particular package is legally compliant requires the **effective**
rule, original condition at transfer, full facts and regulator/legal review.
A proposed StrainChain SealLock criterion may be stricter than the current
minimum legal rule and must never be mislabeled as a statutory mandate.

No economic or deployment actions are part of this document. Protect
humanHold, production_send=false, review gates and independent verification.
