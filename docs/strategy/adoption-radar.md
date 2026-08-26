# Adoption Radar

Weekly, append-only log in support of Move 3 in
[`INDUSTRY_LEADERSHIP_STRATEGY.md`](./INDUSTRY_LEADERSHIP_STRATEGY.md): own the reference
definition of provenance verification. **Never rewrite prior weeks** — correct forward, in a
new entry, if something below turns out wrong.

Honesty rules for every entry: report what was actually found, with links; say plainly when a
week was quiet; never invent statistics or adoption numbers; never characterize a competitor's
product from something unread; claim no certification we do not hold.

---

## 2026-08-19 (first entry)

No prior radar exists yet — this establishes the format. Research was general web search, not
access to paywalled standards-tracker services, so treat absence of a finding as "not found by
this search," not "did not happen."

### What actually moved this week

- **EU Digital Product Passport Registry went live.** The European Commission's DPP Registry
  and a separate testing environment became operational **2026-07-20**, with
  [Commission Implementing Regulation (EU) 2026/1778](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en)
  (effective 2026-08-06) setting the rules for access management, user verification, data
  registration, and the Registry's technical architecture. This is a real, running reference
  implementation in the exact "physical item provenance" space our spec targets — the first
  mandatory passports (batteries) land 2027-02-18. Worth reading the Implementing Regulation's
  technical-architecture annex directly to check where our record/anchor model lines up or
  diverges. Not independently confirmed here beyond the Commission's own page — no third-party
  writeup of the API was read.
- **W3C Verifiable Credentials Working Group is mid-charter, not between charters.** The
  current charter runs 2026-03-11 to 2028-03-31
  ([charter](https://www.w3.org/2026/03/vc-wg-charter.html)). Under it, the group has published
  First Public Working Drafts of **Confidence Method v1.0** and **Verifiable Credential Render
  Method v1.0** ([W3C news](https://www.w3.org/news/2026/five-first-public-working-drafts-published-by-the-verifiable-credentials-working-group/),
  [confidence method repo](https://github.com/w3c/vc-confidence-method)), and a First Public
  Working Draft of **VCDM v2.1**
  ([W3C news](https://www.w3.org/news/2026/first-public-working-draft-verifiable-credentials-data-model-v2-1/)).
  Exact publication dates within 2026 were not confirmed — W3C's own pages were unreachable
  from this session's network (egress-blocked), so these are read from search-result summaries
  only, not the primary documents. Render Method targets completion around 2026-07-01 per the
  charter; Confidence Method has four known implementations (MIT DCC, Digital Bazaar, MOSIP,
  Government of Singapore) working toward an interoperability test suite.
- **W3C Bitstring Status List is stable, not just proposed.** It reached Candidate
  Recommendation Draft status (2025-02-17) and current W3C material describes it as a
  Recommendation-track credential-status mechanism in active use
  ([spec](https://www.w3.org/TR/vc-bitstring-status-list/)). This is directly relevant to our
  own §8 gap — see "Where we're behind" below.
- **GS1 Sunrise 2027 is now inside its active migration window, not a future deadline.**
  Multiple vendor guides published or updated this year describe an 18–24 month packaging lead
  time against the 2027-12-31 target for retail POS to read 2D/GS1 Digital Link barcodes
  ([e.g. barcode.graphics](https://www.barcode.graphics/gs1-sunrise-2027-compliance-deadline-are-your-gtins-ready/)),
  meaning brand owners starting now are already late by that estimate. GS1 Digital Link's own
  URI syntax standard shows a version dated August 2026 (v1.7.0) and the conformant-resolver
  spec a January 2026 revision (v1.2.0) — cited from search-result summaries, not the primary
  PDFs, so treat the exact version numbers as unconfirmed.
- **Spherity (adjacent VC-for-supply-chain vendor) had a visible quarter**, not this specific
  week: completed a SOC 2 Type II examination for 2026, joined the W3C, and cites (via its own
  newsroom, not verified independently) "over 33,000 VRS requests in late 2025" for DSCSA
  pharmaceutical serialization credentials with LedgerDomain
  ([spherity.com/newsroom](https://www.spherity.com/newsroom)). That number is Spherity's own
  claim, sourced from its own site — not corroborated here, and not repeated as fact.
- **Quiet or not found this search:** no GS1 Digital Link "open comment period" was located
  (the one open-comment provenance item found, the [OGC Provenance Domain Working Group
  charter](https://www.ogc.org/requests/ogc-seeks-public-comment-on-proposed-provenance-domain-working-group-charter/),
  closed 2026-02-09 and is geospatial-provenance, not physical-item provenance — noted only as
  a signal that "provenance" is becoming a formal standards topic outside GS1/W3C too). No
  EPCIS-specific news beyond routine doc refreshes was found. No IBM TrustChain / Avery
  Dennison atma.io news specific to this week was found. No public forum thread specifically
  litigating verification-score-vs-verdict claims was found this search.

### Where we are genuinely differentiated

- **Offline verification with no server dependency** — still not something the DPP Registry,
  EPCIS, or Spherity's VRS-based flow claim; all three require a live registry or router call.
- **Three verdicts, no score** — sharpened, not weakened, by this week's finding: W3C's own
  Confidence Method is explicitly a *confidence/scoring* extension point layered on top of VCs.
  That is a reason to say plainly, not quietly, that our verdict layer is deliberately narrower
  than what the working group is now standardizing — see "Spec gaps" below.
- **Adversarial conformance suite validated against deliberately broken implementations** — no
  equivalent was found for GS1 Digital Link, EPCIS, the DPP Registry, or Spherity's tooling in
  this search. If one exists we didn't find it.
- **Apache-2.0 with a patent grant on the protocol, proprietary platform** — Spherity is the
  closest adjacent comparator found and it is a closed enterprise SaaS vendor, not a published
  spec; that contrast is real and citable.

### Where we are genuinely behind

- **No revocation until v0.2**, as stated in `SPEC.md` §8. This is now a smaller excuse than it
  was: W3C Bitstring Status List is stable and Recommendation-track, so the mechanism we'd
  adopt already exists and doesn't need to be designed from scratch — it needs to be
  implemented and wired into `credentialStatus`.
- **Signatures prove authorship, not truth** — unchanged, stated plainly in `SPEC.md` §8 and
  `protocol/README.md`. Nothing found this week changes that; it is a structural property of
  signature-based systems, not a gap specific to us.
- **No public registry with a permanent-URL guarantee yet** — Move 3, item 3 in the strategy
  doc is still open, while the EU DPP Registry just shipped exactly that pattern for a
  regulator-backed program. That is a live, working example of the thing we said we'd build.

### Named awareness targets

- **GS1's own VC/DID landscape document and repo** —
  [ref.gs1.org/gs1/vc/](https://ref.gs1.org/gs1/vc/) and
  [`VCs-and-DIDs-tech-landscape`](https://ref.gs1.org/docs/2025/VCs-and-DIDs-tech-landscape).
  This is GS1 cataloguing the VC/DID implementation landscape for the exact stack our spec
  aligns to (W3C VC + GS1 Digital Link). Being cited or listed here would put the spec in front
  of the audience it is built for, at the source GS1 itself points people to.
- **W3C Verifiable Credentials Working Group repos** —
  [github.com/w3c/verifiable-credentials](https://github.com/w3c/verifiable-credentials) and
  [github.com/w3c/vc-confidence-method](https://github.com/w3c/vc-confidence-method). The
  working group is actively recruiting interoperability-test participants for Confidence
  Method right now (four implementers so far). Participating — or at minimum filing an issue
  noting how a binary-verdict verifier interacts with an optional confidence extension — is a
  concrete way to become a named reference point rather than an outside observer.
- **EU DPP Registry / CIRPASS-2 stakeholder channel** —
  [single-market-economy.ec.europa.eu/single-market/digital-product-passport_en](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en).
  Real implementers (textiles, batteries, electronics) are now building against a live
  registry API; this is the highest-credibility place to demonstrate spec compatibility with
  an actual regulatory reference implementation rather than a hypothetical one.
- **GS1 Sunrise 2027 vendor/advisory ecosystem** — e.g.
  [barcode.graphics](https://www.barcode.graphics/gs1-sunrise-2027-compliance-deadline-are-your-gtins-ready/),
  [trackvision.ai](https://trackvision.ai/blog/2026-03-24-what-is-gs1-sunrise-2027). Brand
  owners are actively searching for GS1 Digital Link migration guidance under a hard deadline
  right now; a plain technical post on how a signed, offline-verifiable record sits on top of a
  Sunrise-2027-compliant Digital Link URL would reach people mid-decision, not cold.

### Spec gaps

Noted here per instructions, not edited into `SPEC.md`:

- `SPEC.md` does not currently say anything about the W3C Confidence Method extension point.
  Since our verdict layer (§5.1) is deliberately binary/ternary with "no partial credit," it
  would be worth a short explicit statement of how (or whether) a `confidenceMethod` entry on a
  credential is expected to interact with a conforming verifier — e.g., "MAY be present, MUST
  NOT affect the §5.1 verdict" — so a future third-party extension proposal can't quietly turn
  the verdict into a score by attaching a confidence field and expecting verifiers to read it.
  This is a clarity gap, not a correctness bug in the current spec.
- `SPEC.md` §8 names `credentialStatus` for planned v0.2 revocation but doesn't name a
  mechanism. Now that W3C Bitstring Status List is stable and Recommendation-track, it may be
  worth naming it explicitly as the intended mechanism in a future revision, the same way §2
  names Ed25519 and JCS explicitly rather than leaving the choice open.

---

## 2026-08-26

General web search again this week, no paywalled standards-tracker access. Absence of a
finding below means "not found by this search," not "did not happen."

### What actually moved this week

- **W3C VC Working Group published five First Public Working Drafts, two of them squarely
  about signature longevity** —
  [announcement](https://www.w3.org/news/2026/five-first-public-working-drafts-published-by-the-verifiable-credentials-working-group/).
  Two are new information since last week's entry:
  - **Quantum-Resistant Cryptosuites v1.0**, published 2026-06-16
    ([FPWD notice](https://www.w3.org/news/2026/first-public-working-draft-quantum-resistant-cryptosuites-v1-0/),
    [spec](https://www.w3.org/TR/vc-di-quantum-resistant-1.0/)). Defines Data Integrity
    cryptosuites for signing VCs with post-quantum algorithms (Dilithium, Kyber), motivated by
    research suggesting elliptic-curve keys could be broken "by the early 2030s."
  - **Verifiable Credential Forgery Defense v1.0**, published 2026-06-30
    ([FPWD notice](https://www.w3.org/news/2026/first-public-working-draft-verifiable-credential-forgery-defense-v1-0/)).
    A mechanism for credentials already signed with a quantum-vulnerable algorithm (i.e.,
    exactly what Ed25519 is) to retroactively gain quantum-resistant backing via a
    separately-signed witness list, for cases where re-issuing isn't feasible.
  - Also published this batch: **Recognized Entities v1.0** and a first-draft **Verifiable
    Credentials Overview v1.1** Group Note. Not yet read in detail — noting existence only.
  - **Confidence Method** and **Render Method**, covered last week as Working Drafts, have a
    firmer target now: the [working group charter](https://w3c.github.io/vc-charter-2026/)
    lists both for Recommendation status in **September 2026**, with the mandatory exclusion
    period already closed (2026-03-29). Correction to last week's framing: reading the
    [Confidence Method draft](https://w3c.github.io/vc-confidence-method/) itself, its worked
    example is about conveying which cryptographic key was identity-bound during issuance
    (e.g., an employer binding a key to a badge credential at vetting time) — closer to
    "proof of possession assurance" than a general trust/authenticity score. That's a narrower
    claim than last week's entry implied; see the differentiation note below.
- **GS1 Digital Link URI syntax v1.7.0 is confirmed as an August 2026 release** (unconfirmed
  last week). The GS1-Conformant Resolver Standard stays at v1.2.0
  ([spec](https://ref.gs1.org/standards/resolver/1.2.0/GS1_Conformant_Resolver_standard_i1.2-r-2026-01-19)),
  ratified January 2026, with no further update expected per search-result summaries — not
  itself confirmed against a primary GS1 roadmap page.
- **Sunrise 2027 has a concrete, named production deployment, not just vendor advisory
  content.** Tesco moved its entire own-label core sausage range to GS1 QR/DataMatrix codes in
  April 2026 — the first full-range (not pilot-scale) rollout by a UK supermarket
  ([GS1 UK](https://www.gs1uk.org/insights/news/Tesco-in-early-trials-of-next-generation-barcodes),
  [itbrief](https://itbrief.co.uk/story/tesco-trials-2d-qr-barcodes-as-eu-demand-for-data-grows)).
  This matters to us because it's a real GS1 Digital Link URL now printed on real retail
  packaging at scale — the exact substrate our record model is designed to sit on top of.
- **The UK opened a live consultation on a domestic "digital product record" policy**, closing
  **2026-09-21**
  ([GOV.UK call for evidence](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy),
  [Digital Watch summary](https://dig.watch/updates/uk-digital-product-passport-consultation)).
  It explicitly references the EU DPP as a comparator and asks what a UK-specific policy
  should look like. This is a genuine open comment period in the exact "physical item
  provenance" space, not adjacent — see awareness targets below.
- **OriginTrail (adjacent, not a direct competitor in our narrow sense)** reports its
  Decentralized Knowledge Graph passed 2 billion "Knowledge Assets" in February 2026 and that
  SCAN's factory-audit system, built on the OriginTrail protocol, is used in auditing "approximately
  40% of all imports entering the United States." Both figures are from OriginTrail's own
  material and crypto-market aggregator sites
  ([coinmarketcap.com/cmc-ai/origintrail](https://coinmarketcap.com/cmc-ai/origintrail/latest-updates/)),
  not independently corroborated here — treat as claims, not facts. OriginTrail's actual
  problem (a decentralized knowledge graph / RAG substrate) is broader than and different from
  our narrow scope (signing and offline-verifying a single item's provenance record), so this
  is adjacent-space noise more than a direct competitive signal.
- **Transmute** continues DHS cross-border-trade verifiable-credential work per its own site,
  with no dated news specific to this week found. **Spherity** and **EPCIS** were quiet this
  week specifically — nothing dated beyond what was already reported 2026-08-19.
- **Quiet or not found this search:** no GS1 EPCIS/CBV version update or open comment period.
  No public forum thread specifically arguing verification-score-vs-verdict was found again
  this week (the closest hit, the Confidence Method spec itself, turned out on closer reading
  to be about identity-binding assurance, not a general score — see above).

### Where we are genuinely differentiated

- **Offline verification with no server dependency** — unchanged and, if anything,
  strengthened by this week's finds: Confidence Method's worked example assumes an issuer-side
  vetting record to check against; Forgery Defense requires fetching and checking a
  separately-published witness-list credential. Neither is designed to be checkable with
  nothing but the record and a public key.
- **Three verdicts, no score** — narrow this claim slightly per the correction above: the
  contrast isn't "we don't score, they do" so much as "we have one deliberately binary/ternary
  verdict layer with no optional extension points that could later carry a score." Still true
  and still worth stating, just more precisely.
- **Adversarial conformance suite validated against deliberately broken implementations** — no
  equivalent found this week either, across W3C's own FPWDs, GS1, or the adjacent vendors
  searched.
- **Apache-2.0 with a patent grant on the protocol, proprietary platform** — unchanged; still
  the sharpest contrast against Spherity, Transmute, and OriginTrail, all of which are vendor
  platforms rather than a published, independently implementable spec.

### Where we are genuinely behind

- **No revocation until v0.2** — unchanged from last week; the Bitstring Status List path
  remains the plausible mechanism.
- **Signatures prove authorship, not truth** — unchanged, structural.
- **New this week: no crypto-agility or post-quantum story.** `SPEC.md` §2 names Ed25519
  (RFC 8032) as *the* signature suite, singular, with no versioning or algorithm-negotiation
  mechanism. W3C is now actively standardizing both a forward path (Quantum-Resistant
  Cryptosuites) and a retrofit path (Forgery Defense) for exactly the class of signature our
  spec mandates. This isn't an urgent problem — "early 2030s" is the risk window cited — but a
  spec that names one non-agile signature algorithm as mandatory, with no stated migration
  story, is a real gap next to two W3C efforts addressing precisely that.

### Named awareness targets

- **UK GOV.UK call for evidence: digital product record policy** —
  [gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy),
  closes **2026-09-21**. This is the single most actionable item found this week: a live,
  open UK government consultation asking exactly what a domestic verification standard should
  look like, months before any policy is fixed. A submission citing an open, independently
  implementable, offline-verifiable spec with a public conformance suite is a concrete way to
  be considered while the policy is still being written, not after.
- **W3C `vc-di-quantum-resistant` repo** —
  [github.com/w3c/vc-di-quantum-resistant](https://github.com/w3c/vc-di-quantum-resistant).
  Early-stage (FPWD, June 2026) — filing an issue or comment on how a fixed-single-algorithm
  spec like ours would eventually reference or migrate to a quantum-resistant cryptosuite is a
  low-cost way to be visible in the group actually defining that transition.
- **GS1 UK Sunrise 2027 case-study channel** —
  [gs1uk.org/insights/news](https://www.gs1uk.org/insights/news/Tesco-in-early-trials-of-next-generation-barcodes).
  With a named retailer (Tesco) now running GS1 Digital Link codes on live product at
  full-range scale, GS1 UK's own case-study content is the place technical readers implementing
  against Sunrise 2027 are already looking; a plain writeup of signed offline records on top of
  a Digital Link URL fits directly into that reading path.
- **EU DPP Registry / testing environment** — unchanged from last week, still open:
  [single-market-economy.ec.europa.eu/single-market/digital-product-passport_en](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en).

### Spec gaps

Noted here per instructions, not edited into `SPEC.md`:

- Carried over from last week, unresolved: no explicit statement of how (or whether) a
  `confidenceMethod`-style entry should interact with the §5.1 verdict, and no named mechanism
  for the planned v0.2 `credentialStatus` revocation.
- New this week: `SPEC.md` §2 pins Ed25519 as the signature suite with no algorithm-agility or
  versioning mechanism, and no stated position on post-quantum migration. Worth a short note in
  a future revision — even just "v0.1 mandates Ed25519 only; a future version may add
  additional supported suites" — so the spec's silence on this isn't mistaken for "we haven't
  thought about it" once W3C's quantum-resistant cryptosuite work matures past FPWD.

---
