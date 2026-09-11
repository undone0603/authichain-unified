# Mendo Love Farms — reconciliation findings

**Date:** 2026-09-11
**Scope:** the seven Digital Product Passport prototypes and the library index published 2026-09-10/11, plus the passport-as-a-service proposal.
**Data of record:** `certificates.json` in this directory.

## Summary

The **chemistry is sound**. All eight certificate rows carrying a raw compound
breakdown were recomputed from mg/g using the standard decarboxylation factor
(0.877 — the THC/THCA molar ratio). Every published total THCV, total THC and
THCV:THC ratio reproduces exactly, to three decimals, with one exception noted
below. Whoever transcribed those panels did it correctly.

The **prose layered on top of the chemistry does not hold**. Six claims are
wrong, and four of them are contradicted by a table on the same page. One
appears on two different pages. Two are visible in the material already sent to
the prospect.

None of this is fatal — it is exactly what step 2 of the playbook exists to
catch, and catching it before a licensing partner does is the product working as
intended. But it must be corrected before anything further goes out, per step 6
("correct the artifact and say so plainly").

## Findings

### 1. "Highest THCV on file" is claimed for the wrong cultivar — HIGH

LT-35's passport carries the headline *"highest THCV on file"* and a crimson
`Highest verified THCV` chip. The library index repeats it.

| Cultivar | Peak total THCV |
|---|---|
| **VT-26** | **11.618%** |
| LT-35 #10 | 11.233% |
| VT-26 × LT-11 #6 | 8.814% |

VT-26 is higher by 0.385 points. The library index's own masthead states
"11.62% — Peak verified THCV," contradicting the LT-35 card three inches below
it. LT-35 is the **second**-highest.

### 2. THCV does not exceed both parents in the crosses — HIGH

Both the VT-26 passport and the crosses passport state that THCV *"climbs above
either confirmed parent's levels."* The crosses peak at 8.814% (#6). VT-26, a
confirmed parent, is 11.618%. The crosses exceed LT-11 (6.244%) but fall well
short of VT-26.

This one matters most: it is a substantive genetics claim, it is the stated
explanation for the backcross framing, and it is the kind of assertion a
licensing partner's diligence would check first.

### 3. "#6 is the only one to show detectable CBD" — MEDIUM

The crosses passport says so; the table immediately beneath it shows #14 at
0.103% CBD and #6 at 0.092%. #14 has *more*. Two selections show CBD, not one.

### 4. Certificate count is stated three different ways — MEDIUM

| Source | Count |
|---|---|
| Library index masthead | "17 certificates reconciled" |
| Proposal (twice) | "14 certificates" |
| Itemised across all seven passports | **12 unique CoA IDs** |

The library index's own per-cultivar cards sum to 13 card-declared CoAs, of
which `240823Q009-001` is double-counted (it appears on both the VT-26 batch
table and the VT-41 passport) — so 12 unique. The proposal's "14" is in the
prospect's inbox. Either five certificates exist that were never carried onto a
passport, or the headline is inflated. Resolve before restating any count.

### 5. "0 open lineage questions" — MEDIUM

The library index masthead claims zero. The same page displays an amber flag on
the VT-41 card reading *"Unexplained 'x 6.75' / 'V#17' codes."* LT-35's passport
says *"No parentage on file … treat as a separate line."* There are at least
two open lineage questions; `certificates.json` records eight open items.

### 6. "Within one day of each other" — LOW

VT-41's passport says both selections were collected *"within one day of each
other in August 2024."* The dates are 2024-08-23 and 2024-08-07 — sixteen days
apart.

### 7. LT-57 "second-highest absolute THCV" — LOW

LT-57's passport says it has the second-highest absolute THCV of the three LT
males. At 7.977% it is the **highest** (LT-17 7.714%, LT-11 6.244%). The same
sentence's other two claims — highest total THC, lowest ratio — are both correct.

### 8. LT-35 #10 has an incomplete compound table — LOW, data gap

The only arithmetic failure. Published THC is 1.31% and ratio 8.58:1, but the
transcribed panel lists only THCA 1.058% — which decarboxylates to 0.928%. The
published figures require roughly **0.381% Δ9-THC** that is absent from the
table. Almost certainly a transcription omission, not a lab error: LT-35 #4, the
sibling sample, does carry a Δ9-THC row. Recover the full panel from CoA
260715S011-001.

## What is genuinely strong

Worth stating plainly, because the list above is lopsided:

- Every ratio and total is arithmetically exact. The panels were read carefully.
- The lineage confirmation is properly sourced — three CoA sample names showing
  the `VT 26 x 41 #N` pattern, 3-for-3, plus Mike's written confirmation. That
  is the model for how provenance should be recorded.
- The backcross inference is correct reasoning, even though the *consequence*
  drawn from it (finding 2) is wrong.
- The VT-41 "x 6.75" / "V#17" flag is exactly right: an anomaly found on the
  certificates, absent from correspondence, raised rather than papered over.
- The terpinolene-dominance claim holds — 0.629% terpinolene against 0.138%
  myrcene is 4.6×, as stated.

## Open items requiring the breeder

Eight, enumerated in `certificates.json` under `open_questions_for_breeder`.
The two that block the most: **LT-35's parentage** (second-highest THCV on file,
no documented cross) and **the true certificate count**.

## Verification still owed

This file and `certificates.json` were built from the published prototypes, not
from the source SC Labs PDFs. The chemistry is self-consistent, which is strong
evidence of faithful transcription, but self-consistency is not verification
against the certificate. A pass against the original PDFs is still owed before
any of this is presented as certificate-verified to a third party.
