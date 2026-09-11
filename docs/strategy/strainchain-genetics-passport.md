# StrainChain genetics passports — strategy and recorded decisions

**Date:** 2026-09-11 · **Status:** active · Supersedes nothing.

This file exists so decisions stop being blockers. Anything technical, architectural
or visual is decided here with its reasoning, and is reversible by editing this file
and the code it points at. Only decisions with external consequences — money charged,
mail sent, claims published under the founder's name — are escalated, and those are
built to the edge and queued rather than left undone.

---

## 1. What has actually worked in this space

### Phylos Galaxy — the cautionary precedent, and the closest one

Phylos Bioscience built the most recognised visualisation cannabis genetics has ever
had: an interactive 3D "Galaxy" plotting the genetic relationships of thousands of
cultivars, assembled from samples breeders submitted. It won the industry's attention
completely.

On 2019-04-16 Phylos announced it was starting a plant breeding company. The
community revolted. Breeders who had sent in "their life's work to be genetically
sequenced" concluded they had been farming data for a future competitor; a video
surfaced of the CEO pitching investors on how Phylos strains would dominate the
market; East Fork Cultivars publicly terminated its partnership in an open letter.

**The lesson is precise and it governs this product.** In cannabis genetics the
platform that aggregates breeder data is one perceived conflict of interest away
from losing the entire community that feeds it. The asset is not the database. The
asset is the breeders' willingness to keep sending things. Mike at Mendo Love Farms
is exactly the breeder in that story.

### Kannapedia — the model that survived

Medicinal Genomics' Kannapedia has run for years and now holds 2,400+ registered
strains. Two things distinguish it from the Phylos outcome:

1. Medicinal Genomics sells **sequencing and testing**, not genetics. It never
   became its customers' competitor.
2. Registration issues a **blockchain digital stamp certificate establishing prior
   art.** A breeder registers in order to _defend_ their genetics, not to donate
   them. The product's value to the breeder is protective, and that is why they
   keep coming.

### GS1 — where third-party recognition is actually available

GS1 released **Conformant Resolver v1.2.0 in January 2026**, and publishes
conformance test suites that validate resolver behaviour: URI parsing, HTTP response
codes, content negotiation, link-set generation. The **EU DPP registry goes live in
July 2026**, with batteries as the first mandatory category, and GS1 Digital Link is
the dominant implementation route for ESPR compliance.

This matters because it is _checkable_. "Beautiful passport pages" is a claim.
"Passes the GS1 conformant-resolver test suite" is a credential someone else issues.

---

## 2. What that means for what we build

### D1 — StrainChain never breeds, sells, or options genetics. Stated publicly.

Not an internal policy: a visible commitment on the passport page itself and in the
terms. The Phylos failure was not the breeding program, it was the discovery of the
breeding program by people who thought they were dealing with a lab. We foreclose
the suspicion by making the promise checkable and prominent before anyone asks.

### D2 — The passport is the breeder's defensive record, not our catalogue.

Reframes the whole offer, and it is the Kannapedia lesson. The breeder is buying
_evidence they control_: a timestamped, independently-verifiable record that they
had this chemistry, this lineage, on this date. That is a thing a breeder wants to
own. "A nice page for your strain" is not.

Consequence: the export and the revoke are first-class product surfaces, not
settings buried in an account page. A breeder who can take their record and leave
is a breeder who can safely stay.

### D3 — Prior-art timestamping is the flagship feature, and it is nearly built.

The repo already carries Ed25519 signing, Polygon anchoring, and a `seals` table
with `fingerprint_sha256` and `tx_hash` (`workers/gs1-resolver/src/schema.sql`).
Hashing a reconciled certificate set and anchoring it is a small step from what
exists, and it converts the passport from a brochure into an instrument.

### D4 — GS1 conformance is the recognition target, ahead of visual polish.

`workers/gs1-resolver` already serves a `.well-known` discovery document and
declares `supportedLinkType`. Running GS1's conformance suite against it and fixing
what fails is a concrete, externally-validated credential — and it lands before the
July 2026 registry date rather than after.

### D5 — One visual system, differentiated by issuer, never by cultivar.

Recorded against the earlier suggestion that each cultivar family get its own
identity. A verification surface earns trust by being recognisable; if every farm's
passport looks different, no one can tell a real one from a forgery. The farm gets
an issuer mark inside a fixed frame. The cultivar gets none.

### D6 — Two resource types, one shell.

`/genetics/[farm]/[cultivar]` is a cultivar dossier; `/passport/[id]` is a unit seal
resolved through the existing GS1 resolver. A jar of flower is a unit with a GTIN
and a serial. VT-26 is a cultivar with neither. A CoA belongs to a batch that
bridges them. Cultivar is namespaced under farm because cultivar names are not
globally unique and a passport must be unambiguous about who issued it.

### D7 — Totals are derived at render time, never transcribed.

Implemented in `src/lib/genetics.ts`. Every total THCV / THC / ratio shown on a page
is recomputed from raw mg/g at the 0.877 decarboxylation factor, and any certificate
whose published total disagrees is surfaced as a discrepancy instead of silently
displayed. This makes the entire class of error found in the 2026-09-10 prototype
pass — a headline figure contradicting the panel beneath it — structurally
impossible to publish. Locked by `src/lib/genetics.test.ts`.

### D8 — Lineage carries provenance, always.

Every edge is `confirmed_in_writing`, `inferred`, `claimed`, or `none`, with its
evidence attached. An inferred edge is never rendered as a confirmed one. This is
the single strongest thing the prototypes did and it is now enforced by the type
system rather than by whoever writes the page.

---

## 3. Pricing — decided

**The conflict.** `shared/pricing.ts` calls itself the single source of truth and is
not: it holds test-mode Stripe IDs and is consumed only by webhook plan-detection
and a setup script. Live money runs through `src/lib/plans.ts`. The two disagree on
every overlapping figure. Separately, the Mendo proposal quotes $49 one-time /
$149 per month / custom, which appears in neither file.

**Decision.** The pitched tiers describe a product that does not yet have a SKU, and
that is the thing to fix — not the price. `theater_1` at $499/mo is a 5,000-
generation enterprise QR subscription that happens to mention StrainChain; it is a
different buyer from a Laytonville breeder and is not the comparable. So:

1. `src/lib/plans.ts` is the single source of truth for anything that charges. Its
   docstring says so, and `shared/pricing.ts`'s false claim to that title is
   corrected to describe what it actually is.
2. Two StrainChain passport SKUs are defined there matching what was pitched —
   $49 one-time per cultivar, $149/mo farm plan — because the offer is already in a
   prospect's inbox and honouring it costs nothing structurally.
3. Both ship with `stripe_price_id: null`. **Nothing can charge until a human
   creates the live Stripe price.** That is the escalation, and it blocks no
   engineering.
4. The manual-outreach playbook's instruction to ground pricing in
   `shared/pricing.ts` is corrected to point at `plans.ts`.

**Still escalated:** creating the live Stripe prices, and any further mail to Mendo
Love Farms.

---

## 4. Open, and deliberately not guessed

Eight questions for the breeder are enumerated in
`content/strainchain/mendo-love-farms/certificates.json`. The two that block most:
LT-35's parentage, and the true certificate count. Neither is inferable from the lab
data and neither should be guessed.

A verification pass of `certificates.json` against the original SC Labs PDFs is
still owed. The arithmetic is self-consistent, which is strong evidence of faithful
transcription, but self-consistency is not verification against the certificate.
