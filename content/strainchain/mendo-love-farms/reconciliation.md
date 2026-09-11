# Mendo Love Farms — reconciliation findings

**Date:** 2026-09-11 (updated same day — see "What the inbox still held")
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

LT-35's passport carries the headline _"highest THCV on file"_ and a crimson
`Highest verified THCV` chip. The library index repeats it.

| Cultivar         | Peak total THCV |
| ---------------- | --------------- |
| **VT-26**        | **11.618%**     |
| LT-35 #10        | 11.233%         |
| VT-26 × LT-11 #6 | 8.814%          |

VT-26 is higher by 0.385 points. The library index's own masthead states
"11.62% — Peak verified THCV," contradicting the LT-35 card three inches below
it. LT-35 is the **second**-highest.

### 2. THCV does not exceed both parents in the crosses — HIGH

Both the VT-26 passport and the crosses passport state that THCV _"climbs above
either confirmed parent's levels."_ The crosses peak at 8.814% (#6). VT-26, a
confirmed parent, is 11.618%. The crosses exceed LT-11 (6.244%) but fall well
short of VT-26.

This one matters most: it is a substantive genetics claim, it is the stated
explanation for the backcross framing, and it is the kind of assertion a
licensing partner's diligence would check first.

### 3. "#6 is the only one to show detectable CBD" — MEDIUM

The crosses passport says so; the table immediately beneath it shows #14 at
0.103% CBD and #6 at 0.092%. #14 has _more_. Two selections show CBD, not one.

### 4. Certificate count is stated three different ways — MEDIUM

| Source                              | Count                        |
| ----------------------------------- | ---------------------------- |
| Library index masthead              | "17 certificates reconciled" |
| Proposal (twice)                    | "14 certificates"            |
| Itemised across all seven passports | **12 unique CoA IDs**        |

The library index's own per-cultivar cards sum to 13 card-declared CoAs, of
which `240823Q009-001` is double-counted (it appears on both the VT-26 batch
table and the VT-41 passport) — so 12 unique. The proposal's "14" is in the
prospect's inbox. Either five certificates exist that were never carried onto a
passport, or the headline is inflated. Resolve before restating any count.

### 5. "0 open lineage questions" — MEDIUM

The library index masthead claims zero. The same page displays an amber flag on
the VT-41 card reading _"Unexplained 'x 6.75' / 'V#17' codes."_ LT-35's passport
says _"No parentage on file … treat as a separate line."_ There are at least
two open lineage questions; `certificates.json` records eight open items.

### 6. "Within one day of each other" — LOW

VT-41's passport says both selections were collected _"within one day of each
other in August 2024."_ The dates are 2024-08-23 and 2024-08-07 — sixteen days
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
- The backcross inference is correct reasoning, even though the _consequence_
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

---

## What the inbox still held — 2026-09-11

Going back to the source emails to start the CoA verification pass turned up a
message that had never been processed. Mike, 2026-09-10 20:43 UTC, subject
**"Lineage"**:

> The VT 26 female and the VT 41 male were grown out in 2024, LT 11, LT 17 and
> LT 57 are there male offspring that were grown out in 2025 and used for
> breeding purposes. **LT 35 and LT 63 are females from that cross**, that we
> have clones of. **The LT 63 is available for licenscing.** The LT 35 we are
> keeping for breeding purposes.

It arrived 35 minutes after the lineage confirmation the passports were built
on, and nothing downstream had read it.

### It settles the bigger of the two open questions

**LT-35 is not a separate line.** It is a VT-26 × VT-41 female — a full sibling
of LT-11, LT-17 and LT-57. Every surface said "no parentage on file, treat as a
separate line," which was honest when written and is now wrong. The edge is
recorded as `confirmed_in_writing`, and `lt35_parentage` moves to
`answered_questions`.

That also explains the chemistry rather than leaving it a curiosity: LT-35 #10
at 11.233% THCV is not an unrelated outlier, it is what this cross produces in a
female.

### And it introduces a cultivar nobody had heard of

**LT-63 exists, is a full sibling of LT-35, and is the one offered for
licensing.** LT-35 is retained for breeding.

This is the commercially significant half. Every passport built so far covers
genetics the breeder is _keeping_. The cultivar he is actually willing to
license has **no certificate on file, no chemistry, and no passport** — and a
licensee's first question will be what LT-63 tests at.

Recorded as a cultivar with an empty `coa_ids`, so it is visible as a known gap
rather than absent. Two new questions replace the answered one: whether SC Labs
certificates exist for LT-63, and whether it tests comparably to its sibling.

### Method note

This is why step 7 of the playbook exists. The lineage claim was already
confirmed in writing; this email was a _fuller_ written answer sitting unread
behind it. The reconciliation was accurate against what had been read, and
wrong about the world. Re-reading the source before publishing is not optional.

### Still owed

The certificate-by-certificate verification against the source SC Labs PDFs.
The attachments are located — four emails from 2026-09-06 carrying roughly 9 MB
between them — but each CoA still has to be opened and checked field by field
against `certificates.json`.

---

## Source inventory — 2026-09-11

The Gmail tool surface exposes attachment **filenames and IDs but not bytes**, so
the certificates still have not been opened. SC Labs names each file after its
CoA ID, though, which makes a full inventory possible without reading them.

### The certificate count is settled

**14 PDF attachments across four emails. 12 distinct certificates of analysis.**

| Email (2026-09-06)  | PDFs |
| ------------------- | ---- |
| VT 26               | 6    |
| 2025 breeding males | 3    |
| 2026 leaf females   | 2    |
| 2026 breeding males | 3    |

The two beyond the twelve certificates are not certificates:

- `VT-26-California-State-Fair-PhytoFacts.pdf` — a PhytoFacts chemotype report.
  The breeder's own wording: _"There are two flower/ phyto facts COA's of the
  VT 26."_
- `251104R041 (3).pdf` — a second document for sample `251104R041`, without the
  `-001` the certificate carries. Probably its PhytoFacts companion. Unopened.

So **the proposal's "14" was counting attachments, and 12 is the certificate
count.** Both were defensible readings of the same pile; neither was written
down. The library index's "17" was never supportable by anything.

One caution: `VT-26-California-State-Fair-CoA-1.pdf` is the only certificate
whose filename does not carry its CoA ID. Its mapping to `260320S005-001` is
inferred from it being the State Fair entry, not read off the document.

### The high moisture is deliberate, and nothing said so

Every certificate except the State Fair flower entry shows moisture between 70%
and 86%, against 11.6% on that one. Read cold, that looks like mishandled
samples. The breeder explained it in the first email and no passport carried it:

> you will see high moisture on our COA's because we test fresh leaf/ flower
> since gauging THCV levels for harvest. The California State fair entry is at
> the proper moisture levels.

The samples are fresh-tested on purpose, to time harvest. Analysis is dry-weight,
so the totals stay comparable — but a buyer looking at 85.6% moisture without
that sentence would reasonably wonder.

### Claimed against derived, across the whole set

Now that every breeder-stated figure is collected in one place, five of the six
deltas are rounding and one is not:

| Cultivar   | Breeder         | Derived          | Δ           |
| ---------- | --------------- | ---------------- | ----------- |
| LT-11      | 7.48:1          | 7.49:1           | 0.01        |
| **LT-17**  | **6.28:1**      | **6.09:1**       | **0.19**    |
| LT-57      | 4.37:1 · 7.997% | 4.36:1 · 7.977%  | 0.01 · 0.02 |
| LT-35 #10  | 8.57:1          | 8.58:1           | 0.01        |
| LT-35 #4   | 7.95:1 · 10.90% | 7.96:1 · 10.901% | 0.01        |
| VT-41 leaf | 4.75:1          | 4.79:1           | 0.04        |

LT-57 is worth a note: the breeder's pair is internally consistent
(7.997 / 1.829 = 4.37), so the certificate's printed total may genuinely differ
from a recomputation off rounded mg/g. That is a question only the PDF can
answer.

### The Phylos comparison is the breeder's claim, not ours

The VT-26 passport states that most THCV genetics on the market — _"including
reference chemovars like Phylos and Pink Boost (Emerald Spirits)"_ — are
myrcene-dominant. That sentence came from Mike's email verbatim. It is now
tagged `claimed` rather than presented as research.

The measurable half stands: VT-26's own certificate shows 0.629% terpinolene
against 0.138% myrcene, 4.6×. What has not been checked is the claim about the
other chemovars.

### What is still owed

Opening the twelve certificates. The inventory is complete and every CoA ID is
accounted for, but no field has been read off a source document. `arithmetic_check`
in `certificates.json` still means "internally consistent", not "matches the PDF".
