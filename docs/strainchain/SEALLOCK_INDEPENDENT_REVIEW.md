# StrainChain SealLock — neutral independent review package

**Status:** request template, unsent. Does not establish a product defect, an
illegal sale, counterfeit contents, or a finding of intent. This is a proposed
private examination framework, not a regulator order or existing certification.

## Engineering question

Can the sealed design be accessed through the zipper, ends, side seams or any
other product route **without destroying a documented irreversible
first-opening barrier**? Distinguish the design's intended barrier from
tear-away appearance, child-resistant reclosure and ordinary print labels.

## Documents requested from the maker or authorized packager

- Controlled drawing for the precise pouch or jar design and revision,
  showing the full cross-section, tear-away position, reclosure location,
  first-opening barrier and corners/end seams.
- The specified heat-seal or destructible-membrane process, including accepted
  machine settings, calibration/maintenance records, lot records, rejected
  units and whether an additional barrier is applied after filling.
- Predeclared, material-specific acceptance criteria and stratified sampling
  plan, including how rework and process deviations are handled. Do not invent
  a universal minimum force, leakage rate or sample size.
- Original seal-strength test method/results and any applicable leakage tests,
  the intact barrier evidence and documented bypass/access challenge results.
- Issuer-authorized identification of packager, lot and product design revision;
  any signed process/lot attestation and a way to verify the issuer identity.
- Applicable child-resistance and accessible-opening documentation **separate**
  from tamper evidence. Show any reclose capability after the irreversible
  first barrier is opened.

## Physical independent review protocol

1. **Intake:** Collect sealed control units from the same design and at least
   one relevant production lot where feasible. Save original receipts, seller
   representation, transport/handling record and custody signatures privately.
2. **Pre-opening examination:** Document uncut, unaltered package front/back,
   hanging feature, top edge, seams, corners, zipper and product label.
   Identify whether the observed physical barrier matches the controlled
   drawing. A seal not visible from outside may still exist; investigate rather
   than assuming absence.
3. **Pre-registered challenge:** Specify before tests the attempted access
   routes and objective criteria for what counts as "contents accessible".
   Include access from zipper, zipper-end, side, bottom and material seam
   routes as relevant to the construction. Record a continuous first-opening
   sequence. Preserve separate unchallenged controls.
4. **Seal testing:** Use qualified packaging-engineer-selected methods;
   appropriate examples are ASTM F88/F88M-23 (seal strength) and F3039-23
   (nonporous-packaging dye-penetration leak detection, destructive). Those
   tests do not replace the challenge in step 3.
5. **Chain of custody:** Hash original video and photo bytes. Record witness
   names and qualifications privately, times, sample design/lot, outcomes,
   manufacturer responses and evidence transfers. An SHA-256 digest alone
   does not prove authenticity or the date recorded.
6. **Report:** Describe physical observations and limits; distinguish
   `not tested` from `passed`, `witnessed access` from allegations, and a
   design-level conclusion from every individual packaged product.
7. **Remediation discussion:** If a bypass is reproduced, request manufacturer
   review of seal geometry, process records and retailer receiving controls.
   Evaluate corrective action without attributing motive. Regulator contact,
   if warranted, follows documented facts and current guidance.

## Required review outcome fields

| Field | Options |
| --- | --- |
| Original condition at intake | documented / partially documented / unknown |
| First-opening barrier in drawing | present / absent / unknown |
| Barrier observed on actual unit | present / absent / obscured |
| Zipper accessible before barrier break | yes / no / untested |
| Contents accessed without barrier damage | yes / no / untested |
| Complete first-opening video | yes / no |
| All relevant side/end routes challenged | yes / no / partial |
| Strength/leak acceptance criteria preregistered | yes / no |
| Qualification artifacts original and authenticated | yes / no / incomplete |
| Independent reviewer signature verified | yes / no |
| Verdict | reported bypass / indeterminate / ready for external review only |
| Operational disposition | **HOLD until independently authorized** |

No automated SealLock state means "verified genuine product" or authorizes
sale, destruction, recall, payment, branding or public accusation. A pilot
supplier can adopt contractual hold rules, but StrainChain cannot impose
them on sellers who do not participate.

## Implementation trace

- Consumer-image observation: `scripts/strainchain/seal-evidence.mjs`
- Design packet completeness: `scripts/strainchain/seal-design-preflight.mjs`
- Proposed standard: `docs/strainchain/SEALLOCK_V0_1.md`
- Next integration (not implemented): independently authenticated signed
  issuer certificate, timestamped immutable audit entry, per-lot receiving
  witness, and explicit provenance/revocation states on StrainChain.io.

**Private case handling:** Do not paste full product tracking codes, company
names, photographs, personal contact details, original receipts or signed
statements into public test fixtures or GitHub issues. The original user
photos remain outside this PR.

**Compliance:** Michigan R 420.504's sealing-and-labeling language supplies
a relevant baseline; this protocol is proposed additional technical
assurance. It is not a legal claim that SealLock procedures are mandatory.
