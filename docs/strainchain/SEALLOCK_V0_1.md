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
The original photos and identifying labels stay in a private evidence packet,
not this repository. A QR identifier only identifies a record; it does not
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
4. **BYPASS_WITNESSED** — continuous first-opening evidence, independent
   observer and the defined access challenge establish accessibility
   without destruction. Requires human review; not a legal finding.
5. **FIRST_OPENING_BARRIER_OBSERVED** — a physical barrier appears in
   visual evidence but has not passed all qualification gates.
6. **DESIGN_QUALIFIED** — independent qualification artifacts and all
   physical gates pass for the identified package **design revision**.
   This does NOT certify a specific retail unit or its contents.

All states carry explicit boundaries: no counterfeit conclusion, no legal
noncompliance determination, no unauthorized lab/Metrc integration, no
hash-as-authenticity claim.

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

Michigan Administrative Code R 420.504 requires the container, bag or product
holding marihuana to be sealed and labeled before retail sale or transfer.
Whether a particular package is legally compliant requires the **effective**
rule, original condition at transfer, full facts and regulator/legal review.
A proposed StrainChain SealLock criterion may be stricter than the current
minimum legal rule and must never be mislabeled as a statutory mandate.

No economic or deployment actions are part of this document. Protect
humanHold, production_send=false, review gates and independent verification.
