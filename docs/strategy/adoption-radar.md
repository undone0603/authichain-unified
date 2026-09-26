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

## 2026-09-02

General web search again this week; WebFetch was blocked by the network egress proxy for
several primary sources this week specifically (`eprint.iacr.org`, `spherity.com`,
`regenstudio.world`, `standards.iteh.ai`), so several items below are sourced from search-result
summaries rather than the primary document — flagged individually. Absence of a finding below
means "not found by this search," not "did not happen."

### What actually moved this week

- **CEN-CLC/JTC 24 has two of the eight EU DPP technical standards still outstanding, both due
  this month, and one of them is squarely our spec's problem.** The other six (EN
  18216/18219–18223) published 2026-05-27, cited in the Official Journal 2026-07-15
  ([field guide, Regen Studio](https://www.regenstudio.world/blog/dpp-system-standards/) —
  fetch blocked, read via search summary; [wiot-group summary](https://wiot-group.com/think/en/news/cen-cenelec-six-eu-dpp-standards-en-18xxx/)).
  The two still due:
  - **FprEN 18239** — access rights management, IT security, business confidentiality.
  - **FprEN 18246** — "Digital product passport: data authentication, reliability and
    integrity." Per standards-catalog listings
    ([iteh.ai](https://standards.iteh.ai/catalog/standards/cen/9d9fbc1f-0c14-4e84-ab6c-f233e3f19398/pren-18246) —
    fetch blocked, [DIN mirror](https://www.dinmedia.de/en/draft-standard/din-en-18246/394416240),
    [dpp.gs alignment note](https://dpp.gs/blog/dpp-cen-cenelec-standards-compliance.html)), it
    requires "Electronically Signed Data Constructs" (ESDCs) — cryptographically signed by the
    issuing party, tamper-evident, digitally verifiable — referencing **ISO/IEC 20248 (DigSig)**
    for the signature data structure, plus an audit-proof log of every DPP-modifying event. That
    is a formal EU standard for exactly the problem `protocol/SPEC.md` solves — signing and
    verifying a product-provenance record — arriving under different vocabulary (ESDC, DigSig)
    than ours (VC 2.0, Ed25519/JCS). The enquiry-stage draft (`prEN 18246:2025`) is already
    closed for public comment; what's left is formal publication, expected this month. Whether
    ESDC verification is designed to work offline the way ours does was not established — no
    primary-source text was read, only catalog summaries — so treat that specific comparison as
    open, not settled.
- **A new academic security analysis of C2PA landed on the IACR Cryptology ePrint Archive as
  2026/804**, "Verifying Provenance of Digital Media: Security Analysis of C2PA and its
  Implementation" (Golaszewski, Krawetz, Sherman, Zieglar, et al. — a UMBC-affiliated group with
  an earlier arXiv companion piece, [2604.24890, "Why the C2PA Specifications Fall
  Short"](https://arxiv.org/html/2604.24890v1)). `eprint.iacr.org` itself was blocked by the
  network proxy this session, so this is read via search-result summaries only, not the primary
  text — treat the specifics as reported-by-search, not verified firsthand. Per those summaries,
  the paper's findings include: conforming C2PA validators accept manifests signed with
  known-compromised certificates because of inadequate revocation policy; conforming validators
  produce inconsistent verdicts from identical input; an "exclusion range" in the manifest format
  permits undetectable alteration; and the C2PA conformance program certifies implementations
  without technical review. This is exactly the kind of public argument over verification claims
  this radar watches for, and — if the summaries hold up under a direct read — it names a
  specific adjacent spec's conformance program as weaker in precisely the place ours was
  deliberately hardened (`conformance/README.md`'s suite, validated against three deliberately
  broken implementations). Worth a follow-up week where this paper is actually read in full
  before leaning on it any harder.
- **Spherity has two items this radar missed last week because they predate this week's search
  window**, corrected forward per the append-only rule rather than by editing 2026-08-26: it
  [joined W3C](https://www.spherity.com/post/spherity-joins-w3c-to-advance-open-interoperable-standards)
  (announced 2026-05, fetch blocked, read via search summary) and was named the sole "Pioneer"
  in [Gartner's Emerging Market Quadrant for Digital Product Passport — Established
  Vendors](https://www.spherity.com/post/gartner-emerging-market-quadrant-for-digital-product-passport),
  published 2026-07-06. Narravero was separately named a "Market Shaper" in the same report
  ([PR Newswire](https://www.prnewswire.com/news-releases/narravero-named-a-market-shaper-in-the-2026-gartner-emerging-market-quadrant-for-digital-product-passport-302849620.html)).
  The underlying Gartner report itself is paywalled and was not read; both placements are
  reported only via the vendors' own press material, not verified against Gartner directly.
- **A W3C/GS1 joint workshop — "E-commerce for Humans and AI Agents" — runs 2026-09-08 to
  09-09 in Zurich, hosted by Google**
  ([workshop overview](https://www.w3.org/2026/ecommerce-agents/), [W3C news](https://www.w3.org/news/2026/upcoming-w3c-gs1-workshop-on-e-commerce-for-humans-and-ai-agents/)).
  This is the two standards bodies our spec explicitly aligns to (§2: W3C VC 2.0 + GS1 Digital
  Link) convening jointly on how AI agents interact with e-commerce and product data — directly
  adjacent to both this protocol and to Move 2 of the leadership strategy (agent-payable
  verification). The Position Statement / Expression of Interest deadline was 2026-07-10 — long
  past — so there is nothing to submit; the only remaining move is to watch for published
  outputs (minutes, position statements, any resulting Community Group work) once the workshop
  happens. OriginTrail has separately said it will attend
  ([TradingView/Coindar reprint](https://www.tradingview.com/news/coindar:afb62218b094b:0-origintrail-to-attend-w3c-gs1-workshop-in-zurich-on-september-8th/) —
  a market-data aggregator's syndication of a press item, not a primary source).
- **OriginTrail (adjacent, not a direct competitor):** "Election Guardian," built with Viva AI on
  OriginTrail's Decentralized Knowledge Graph, launched 2026-08-21 across the Americas for
  deepfake and disinformation detection during elections; source is OriginTrail's own material,
  not independently corroborated. Its **DKGcon 2026** runs online, live from Zurich, 2026-09-11,
  themed "Scaling trust in the age of AI — verifying what's real, from deepfakes to
  impersonation" ([event page](https://dkgcon.origintrail.io/)). Both are content/media
  authenticity and disinformation-detection use cases, not physical-item provenance — adjacent
  noise in our narrow scope, not a direct competitive signal, but notable that three
  trust-and-verification events (W3C/GS1, DKGcon, and the Global Digital Collaboration
  Conference, 2026-09-01–03, Geneva) all landed in the same September window.
- **Quiet this week:** no EPCIS/CBV version change beyond an already-reported 2026-08-15 page
  refresh; no dated Transmute news; no further milestone on Confidence Method / Render Method
  beyond what was already reported 2026-08-26 (both still targeting W3C Recommendation status in
  September 2026 per the working group charter — no confirmation found this week that either has
  actually been published as a Recommendation yet); the UK GOV.UK digital product record
  consultation (see below) had no news beyond remaining open.

### Where we are genuinely differentiated

- **Offline verification with no server dependency** — unchanged, and now facing its first
  concrete formal-standard comparison rather than only vendor/W3C comparisons: FprEN 18246's
  ESDC model is the thing to check this against once it publishes and is actually readable,
  since today's finding is catalog-summary-level only.
- **Adversarial conformance suite validated against deliberately broken implementations** — the
  IACR paper on C2PA, if its summarized findings hold up, is the sharpest external validation of
  this differentiator found in any week so far: a widely-deployed provenance conformance program
  reportedly certifying products "without technical review," which is precisely the failure mode
  `conformance/README.md` was built to make impossible for us. Flagged as summary-sourced, not
  independently confirmed — worth reading the full paper before repeating this claim publicly.
- **Apache-2.0 with a patent grant on the protocol, proprietary platform** — unchanged.
- **Three verdicts, no score** — unchanged from the 2026-08-26 correction; no new information
  this week either direction.

### Where we are genuinely behind

- **No revocation until v0.2** — unchanged, but the C2PA findings (summary-sourced) sharpen what
  "solving" this actually requires: a shipped, adopted, industry-standard revocation mechanism is
  reportedly failing in practice at the certificate-checking step. Simply adding
  `credentialStatus` in v0.2 without a robust operational revocation-checking story could
  reproduce the same failure mode rather than fix it. The honest framing is not just "we don't
  have revocation yet" but "we don't yet have a plan for avoiding C2PA's reported failure mode
  when we do."
- **Signatures prove authorship, not truth** — unchanged, structural.
- **No crypto-agility or post-quantum story** — unchanged from last week; not yet addressed.
- **New this week: our record vocabulary has no stated relationship to the EU's emerging DPP
  vocabulary.** If FprEN 18246 publishes with ESDC/ISO-IEC-20248 as the reference model for
  "data authentication" in European DPP implementations, `SPEC.md` §2's alignment table (W3C VC
  2.0, GS1 Digital Link, CAIP-2) has nothing bridging to it. Not a defect today — the standard
  isn't published yet — but worth tracking before it calcifies into "two incompatible ways to
  sign the same kind of record, invented independently."

### Named awareness targets

- **UK GOV.UK digital product record call for evidence** —
  [gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy).
  Carried forward from last week and now the most time-boxed item on this radar: closes
  **2026-09-21**, 19 days from today, and still not acted on. This remains the single most
  actionable item precisely because the window to submit is still open, unlike the two other
  items below.
- **FprEN 18246 (CEN-CLC/JTC 24)** — publication expected this month. Once it's actually
  publishable and readable in full, a short technical note mapping our Ed25519+JCS signed-record
  model against its ESDC/ISO-IEC-20248 model is the single most relevant thing we could publish
  next quarter: it would surface for the exact audience — EU compliance engineers implementing
  DPP data authentication — who will be searching for practical guidance the standard itself
  won't provide.
- **W3C/GS1 Workshop on E-commerce for Humans and AI Agents**, 2026-09-08–09, Zurich —
  [w3.org/2026/ecommerce-agents](https://www.w3.org/2026/ecommerce-agents/). Submission window
  closed; the move is to watch for published minutes or follow-on Community Group work once the
  workshop happens, since it sits at the exact intersection of our two aligned standards and our
  agentic-verification strategy.
- **IACR eprint 2026/804 / the UMBC group behind it** —
  [eprint.iacr.org/2026/804](https://eprint.iacr.org/2026/804) (blocked this session; revisit
  directly next week). If they publish a cross-industry "lessons learned" piece, our
  conformance-suite-with-teeth story is a natural point of contrast worth having ready.

### Spec gaps

Noted here per instructions, not edited into `SPEC.md`:

- Carried over, unresolved: `confidenceMethod`-style interaction with the §5.1 verdict; no named
  mechanism for v0.2 `credentialStatus` revocation (Bitstring Status List remains the plausible
  candidate); Ed25519-only with no crypto-agility or post-quantum migration statement.
- New this week: no bridging or mapping between our record vocabulary and the EU's emerging
  ESDC/ISO-IEC-20248 vocabulary for the same underlying problem (signed-record authenticity for
  provenance/passport data). Not a spec defect today since FprEN 18246 isn't published yet, but
  worth a forward note once it is, so the gap doesn't calcify into two incompatible vocabularies
  for the same idea.

---

## 2026-09-09

General web search again this week. `w3.org`, `eprint.iacr.org`, and `digital-link.com` were all
blocked by the network egress proxy when fetched directly this session, same pattern as prior
weeks — items sourced from those domains below are read via search-result summaries only, not the
primary document, and flagged individually. Absence of a finding means "not found by this
search," not "did not happen."

### What actually moved this week

- **The EU Commission missed its own legal deadline on battery-passport access rights.** Article
  77(9) of the Battery Regulation required the Commission to adopt, by **18 August 2026**, the
  implementing act defining the third tier of passport-data access — "any natural or legal person
  with a legitimate interest," per Article 77(2) and Annex XIII. It did not; the act is now
  reported pushed to Q4 2026
  ([Battery-Tech Network](https://battery-tech.net/why-the-eu-is-about-to-miss-its-own-battery-passport-deadline-while-industrys-stays-fixed/)).
  The **18 February 2027** mandatory-passport date is reported unchanged and, unlike most other
  dates in the Regulation, carries no conditional extension. This is directly relevant to our own
  §6: the EU's live rollout is landing on a **three-tier** access model (public / regulators /
  vetted third parties) for the same class of record our spec treats as a single public tier — see
  "Spec gaps" below. Read via secondary coverage, not the Commission's own implementing-act text
  (which does not yet exist to read).
- **FprEN 18246 ("Digital product passport: data authentication, reliability and integrity")
  remains on track for September 2026 publication, alongside FprEN 18239** — consistent with, not
  new beyond, what was reported 2026-09-02
  ([standards.iteh.ai catalog entry](https://standards.iteh.ai/catalog/standards/cen/9d9fbc1f-0c14-4e84-ab6c-f233e3f19398/pren-18246),
  fetch blocked last week and this week; [CEN-CENELEC](https://www.cencenelec.eu/news-events/news/2026/en-in-the-spotlight/2026-07-15-dpp/)).
  No confirmation was found this week that it has actually published yet — "expected this month"
  is still the state of the evidence, not "shipped."
- **The W3C/GS1 "E-commerce for Humans and AI Agents" workshop ran 2026-09-08–09 in Zurich**,
  hosted by Google, concluding today
  ([workshop site](https://www.w3.org/2026/ecommerce-agents/), fetch blocked, read via search
  summary). The published agenda covers Consumer Pack Variant disambiguation via GS1 Digital Link
  and the GS1 Web Vocabulary, emerging agentic-commerce protocols (**MCP, UCP, ACP** named
  explicitly), product discovery, connected packaging, trusted payments, verifiable credentials,
  and liability when an agent transacts on a person's behalf. This is the first item this radar
  has found that sits at the exact intersection of *both* halves of our strategy at once: the two
  standards our spec aligns to (W3C VC, GS1 Digital Link) convening jointly, on an agenda that
  names agent-to-agent commerce protocols alongside verifiable credentials — i.e., Move 3 (own the
  spec) and Move 2 (agent-payable verification) are the same room this week. No minutes or
  position statements have been published yet; the submission window closed long before this
  research began, so nothing to submit — the only available action is watching for outputs.
- **A new academic security analysis of C2PA is more concretely findable this week**, though the
  primary source (`eprint.iacr.org/2026/804`) was still blocked by the network proxy both this
  week and last. Secondary sources — the paper's own UMBC project page
  ([cisa.umbc.edu](https://cisa.umbc.edu/verifying-provenance-of-digital-media-security-analysis-of-c2pa-and-its-implementation/))
  and an arXiv companion piece
  ([arxiv.org/pdf/2604.24890](https://arxiv.org/pdf/2604.24890)) — give firmer detail than last
  week's summary-of-a-summary: the paper reportedly uses formal-methods analysis to show C2PA
  timestamps can be replaced or modified without detection, finds inconsistent validation behavior
  across implementations, cites inadequate certificate-revocation handling, and reports that
  Google's Pixel 10 — a real, shipping C2PA-conformant device — omitted required EXIF metadata
  from its claims. The paper's stated conclusion, per these summaries, is that the C2PA
  specifications are "not ready for standardization or deployment." Still not independently read
  in full here; treat the specifics as reported-by-secondary-source.
- **OpenAI joined C2PA as a Conforming Generator** (announced 2026-05-20, not previously logged in
  this radar), pairing C2PA Content Credentials with Google DeepMind's SynthID watermark on every
  ChatGPT/API-generated image, and expanded the same pairing to audio by 2026-07-31
  ([OpenAI](https://openai.com/index/advancing-content-provenance/)). Worth logging now because of
  the timing contrast with the item above: a major AI lab has just become a certified conformer to,
  and standard-steering-committee member of, the exact program a fresh academic paper says
  certifies implementations "without technical review." This is adjacent to us — content/media
  authenticity, not physical-item provenance — but it is precisely the kind of live public argument
  over what a "conformant" verification claim is actually worth that this radar watches for.
- **OriginTrail (adjacent, not a direct competitor):** opened OT-RFC-27 (2026-09-06) proposing a
  read-side TRAC payment mechanism for metered AI inference over its Decentralized Knowledge Graph
  ([TradingView syndication of a CoinMarketCal item](https://www.tradingview.com/news/coinmarketcal:45d7074d4094b:0-origintrail-ot-rfc-27-proposes-paid-inference-for-the-decentralized-knowledge-graph-06-sep-2026/) —
  a market-data aggregator repost, not a primary source), and runs DKGcon 2026 (Zurich Online
  Edition, 2026-09-11, "Scaling trust in the age of AI — verifying what's real"). Still a
  knowledge-graph/RAG substrate play, not a signed single-item provenance record — adjacent noise,
  not a direct competitive signal, but notable that a paid-per-call settlement RFC for AI
  inference is conceptually close to our own Move 2 (agent-payable, per-call verification pricing),
  just for a different kind of query.
- **Quiet or not found this search:** no confirmation that W3C Confidence Method or Render Method
  actually reached Recommendation status this week — both now have `/TR/` (not just draft-repo)
  URLs, which typically signals advancing maturity, but the primary pages were blocked and no
  secondary source confirmed the exact status reached, so this stays "targeting Recommendation in
  September 2026," not "recommended," pending direct confirmation. No GS1 Digital Link or EPCIS
  version change beyond the already-reported August 2026 releases. No dated Transmute news. No
  IBM TrustChain or Avery Dennison atma.io news this week. No direct public forum thread arguing
  verdict-vs-score specifically for physical-item verification (the closest hits were general
  AI-content-detection commentary, already adjacent-scope). The UK GOV.UK consultation (see below)
  had no news beyond remaining open.

### Where we are genuinely differentiated

- **Offline verification with no server dependency** — unchanged; the EU battery-passport
  access-tiering story this week is a live counter-example of a *server-mediated, permissioned*
  access model for provenance-adjacent data, which sharpens rather than weakens the contrast.
- **Three verdicts, no score** — unchanged from the 2026-08-26 correction.
- **Adversarial conformance suite validated against deliberately broken implementations** — the
  clearer detail on IACR 2026/804 this week (Pixel 10 shipping without required metadata,
  inconsistent cross-implementation validation) is the strongest independent evidence yet, across
  every week of this radar, for exactly the failure mode `conformance/README.md`'s suite was built
  to catch. Still summary-sourced pending a direct read, and still about a different spec (C2PA,
  media authenticity) rather than ours — cite the contrast, not the specific numbers, until the
  primary paper is actually read.
- **Apache-2.0 with a patent grant on the protocol, proprietary platform** — unchanged.

### Where we are genuinely behind

- **No revocation until v0.2** — unchanged.
- **Signatures prove authorship, not truth** — unchanged, structural.
- **No crypto-agility or post-quantum story** — unchanged.
- **No bridging to the EU's ESDC/ISO-IEC-20248 vocabulary** — unchanged; still pending FprEN
  18246's actual publication.
- **New this week: no access-tiering model.** `SPEC.md` §6 requires records to be "served without
  authentication" full stop — "verification that requires an account is not public verification."
  That is a deliberate, defensible design choice for the record our spec covers. But the EU's live
  battery-passport rules are landing on three distinct access tiers for passport data generally,
  and the Commission is actively defining who counts as a "legitimate interest" third party for
  the non-public tier. Our spec doesn't currently say anything about scope here — i.e., whether
  "no-auth for everything" is a claim about the *verification record specifically* (narrower than
  a full product passport, and thus fine to keep fully public) or a position on product-data access
  generally (which would conflict with what regulators are actually building). Silence reads as
  the latter by default. See "Spec gaps."

### Named awareness targets

- **UK GOV.UK digital product record call for evidence** —
  [gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy).
  Closes **2026-09-21** — 12 days from today. Third straight week this radar has flagged it as the
  single most actionable, time-boxed item, and it remains unacted on. The window will close before
  next week's entry if nothing is submitted before then.
- **W3C/GS1 Workshop on E-commerce for Humans and AI Agents outputs** —
  [w3.org/2026/ecommerce-agents](https://www.w3.org/2026/ecommerce-agents/). The workshop itself
  just happened (2026-09-08–09); the concrete move now is watching for published minutes,
  position statements, or a follow-on Community Group, since its agenda — GS1 Digital Link,
  verifiable credentials, and agent commerce protocols (MCP/UCP/ACP) together — is the closest
  thing found yet to a single forum spanning both Move 2 and Move 3.
- **IACR 2026/804 / UMBC CISA group** —
  [cisa.umbc.edu](https://cisa.umbc.edu/verifying-provenance-of-digital-media-security-analysis-of-c2pa-and-its-implementation/),
  paper at [eprint.iacr.org/2026/804](https://eprint.iacr.org/2026/804) (blocked again this
  session — worth a direct-read attempt from a non-proxied environment). If its findings hold up
  under a full read, this is a citable, independent, academic point of contrast for our
  conformance-suite story, in a way no vendor comparison can match.
- **FprEN 18246 (CEN-CLC/JTC 24)** — unchanged from last week, expected to publish this month.

### Spec gaps

Noted here per instructions, not edited into `SPEC.md`:

- Carried over, unresolved: `confidenceMethod`-style interaction with the §5.1 verdict; no named
  mechanism for v0.2 `credentialStatus` revocation; Ed25519-only with no crypto-agility statement;
  no bridging to the EU's emerging ESDC/ISO-IEC-20248 vocabulary.
- New this week: `SPEC.md` §6 mandates unauthenticated public access with no stated scope
  boundary. Worth a clarifying sentence in a future revision — e.g., "this specification covers
  the provenance record only; a deployment MAY restrict access to other product data under its own
  policy" — so the no-auth requirement reads as a scoped design decision rather than a silent,
  broader claim that conflicts with the tiered-access model real regulators (EU battery passport)
  are building for the wider category of product data this protocol's records can live alongside.

---

## 2026-09-11

General web search again this week. `eprint.iacr.org` and `forkast.news` were both blocked by the
network egress proxy on direct fetch attempts this session — same pattern as prior weeks for
`eprint.iacr.org` specifically, now three weeks running unread in full. Items sourced from those
two domains below are read via search-result summaries only, not the primary document, and flagged
individually. Absence of a finding below means "not found by this search," not "did not happen."

### What actually moved this week

- **The EU DPP Registry published a concrete, current technical requirement for product
  identifiers that lines up with our record's identity field.** The Registry's user guide
  (v1.02, dated 24 August 2026, per search-result summaries — not fetched directly) requires the
  unique product identifier submitted at registration to be a URL starting with `https://`,
  compliant with CEN/CENELEC JTC 24, and no longer than 2000 characters. `SPEC.md` §3's example
  `credentialSubject.id` is already an `https://id.gs1.org/...` GS1 Digital Link URL well under
  that length — so this is a live regulatory data point confirming our identifier choice is
  compatible with the EU's registry, not a gap. Worth reading the actual JTC 24 format
  requirement directly once fetchable, since "CEN/CENELEC JTC 24 compliant" is a specific format
  constraint this entry has not verified beyond the length/scheme rule.
- **The W3C/GS1 "E-commerce for Humans and AI Agents" workshop (Zurich, 2026-09-08–09, covered as
  upcoming in last week's entry) has its first substantive third-party writeup**, via Forkast
  ([forkast.news](https://forkast.news/what-agent-commerce-needs-from-product-data-lessons-from-the-w3c-gs1-workshop/) —
  fetch blocked, read via search-result summary only). Per that summary: the workshop framed a
  "last meter" problem — an agent can search, compare, and pay, but still fail at checkout if it
  cannot definitively identify the exact physical item a person intends to buy. Paola Di Maio
  (W3C AI KR Community Group) is reported to have named a vocabulary-interoperability gap between
  schema.org, GoodRelations, and the GS1 Web Vocabulary as a blocker to agent commerce scaling.
  Sessions on agent identity are reported to be converging on signed-JWT protocols to let merchant
  infrastructure distinguish human-authorized agents from malicious bots. None of this is
  specifically about our narrow scope (signed, offline-verifiable item provenance), but it's the
  clearest evidence yet that the room hosting both of our aligned standards bodies is actively
  short on exactly the kind of interoperable, verifiable identity layer this protocol provides —
  and per a separate search last week, the workshop concluded with no formal outcomes report, so
  there is nothing to react to yet beyond watching for follow-on Community Group work.
  Separately, Digital Link's own CEO, Paula Rivero, is reported to have spoken there on product
  identity ([digital-link.com](https://digital-link.com/news/w3c-gs1-workshop-on-e-commerce-ai-agents)).
- **The evidence on W3C Confidence Method / Render Method reaching Recommendation status this
  month is now contradictory, not just unconfirmed.** One search this week returned a summary
  stating both were "published as Recommendations" in September 2026. A second, more targeted
  search found no Recommendation-dated page for either and instead found W3C calendar listings
  for "VCWG Spec Refinement" calls explicitly described as "refining the W3C Recommendation Track
  Render Method and Confidence Method specifications," scheduled on an ongoing basis into
  **November and December 2026** ([w3.org calendar](https://www.w3.org/groups/wg/vc/calendar),
  [meeting listing](https://www.w3.org/events/meetings/10fb1cba-4e48-4307-b3cc-5c6ea6ab6842/20261111T110000)).
  Refinement calls running that far past a claimed publication date is inconsistent with "already
  a Recommendation" — the more likely read is that "Recommendation Track" was compressed into
  "Recommendation" somewhere upstream of the first search's summary. Correcting forward rather
  than asserting either version: treat both specs as **still pre-Recommendation, actively being
  refined, target unconfirmed**, not as shipped standards, until a primary `/TR/` page with a
  Recommendation-track status header is actually read.
- **FprEN 18246 is reported "at formal vote," still not confirmed published.** Consistent with,
  not new beyond, the 2026-09-02 and 2026-09-09 entries: six of the eight DPP standards under
  standardisation request M/604 published 2026-05-27; FprEN 18239 and FprEN 18246 remain the two
  outstanding, with FprEN 18246 covering exactly our spec's problem (data authentication via
  Electronically Signed Data Constructs referencing ISO/IEC 20248) and now described in one
  catalog-summary source as at formal vote rather than merely drafted — a step closer to
  publication than last week's "expected this month," but still not itself a publication.
- **IACR eprint 2026/804 (the C2PA security-analysis paper) has firmer, more specific findings
  available via search summary than any prior week, but the primary text is still unreadable
  here.** Per those summaries: the paper is described as the first formal-methods analysis of
  C2PA's core protocols, finding that claim generators and validators achieve strong agreement on
  a claim's *assertions* but not on its *trusted timestamp* — a specific, named protocol gap, not
  a vague "revocation is weak" claim. It also reports that C2PA v2.3 (January 2026) incorporated
  some of the researchers' suggested fixes, while v2.4 (April 2026) is reported to address none of
  the remaining concerns, and states the paper's own conclusion that C2PA "should not yet be
  relied upon for high-stakes uses such as financial disclosures, journalism, or legal evidence."
  This is a materially stronger claim than "certifies without technical review" (2026-09-02's
  framing) — it's closer to "a maintained, shipping conformance program received a specific fix
  request and a subsequent release didn't act on it." Still not independently verified against the
  primary paper (`eprint.iacr.org` blocked again this session, third week running) — treat as
  reported-by-search, not confirmed firsthand, and do not repeat the "should not be relied upon"
  line publicly without reading the source first.
- **Quiet this week, specifically:** no dated Spherity, Transmute, or OriginTrail news found for
  this week (a broad combined search returned only older, previously-logged material). No IBM
  TrustChain news found. Avery Dennison atma.io coverage found is about a ChatGPT/AI feature
  addition, undated to this specific week and not verification-standard-related. No EPCIS/CBV
  version change found. The UK GOV.UK digital product record call for evidence (below) had no
  news beyond remaining open.

### Where we are genuinely differentiated

- **Offline verification with no server dependency** — unchanged. The W3C/GS1 workshop's reported
  "vocabulary interoperability gap" finding is a reminder that the wider agent-commerce ecosystem
  is still working out basic shared vocabulary, let alone a verification model that doesn't
  require a live call — the gap between "what the room is solving" and "what this protocol already
  does" if anything widened this week, not narrowed.
- **Three verdicts, no score** — unchanged; this week's Confidence Method status confusion (see
  above) is a reason for more caution citing it as a comparator, not less — until its actual
  Recommendation status is confirmed, don't describe it as a shipped extension point our verdict
  layer contrasts against.
- **Adversarial conformance suite validated against deliberately broken implementations** — the
  sharper IACR summary this week (a named, specific protocol disagreement on timestamps; a
  reported fix request a maintained spec release didn't act on) is the most concrete version of
  this contrast found in any week so far, and it remains the single most valuable primary source
  to actually read once the network egress proxy stops blocking it.
- **Apache-2.0 with a patent grant on the protocol, proprietary platform** — unchanged.

### Where we are genuinely behind

- **No revocation until v0.2** — unchanged.
- **Signatures prove authorship, not truth** — unchanged, structural.
- **No crypto-agility or post-quantum story** — unchanged.
- **No bridging to the EU's ESDC/ISO-IEC-20248 vocabulary** — unchanged; FprEN 18246 is reported
  closer (formal vote) but still not published.
- **No access-tiering model** — unchanged from 2026-09-09's finding. This week's EU DPP Registry
  identifier-format requirement is a confirmation of compatibility at the *identifier* layer, not
  a resolution of the access-tiering gap at the *record* layer — those are separate questions and
  this week's finding only closes the first one.

### Named awareness targets

- **UK GOV.UK digital product record call for evidence** —
  [gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy).
  Closes **11:59pm, 21 September 2026** — 10 days from today. Fourth straight entry flagging this
  as the single most actionable, time-boxed item on the radar, and it remains unacted on. Stated
  plainly per the honesty rules: repeating "most actionable" for a fourth week without a submission
  is itself worth noticing — either act on it in the next 10 days or stop calling it the top
  target, since a consultation window that closes unsubmitted stops being an opportunity and
  starts being a missed one.
- **EU DPP Registry technical documentation** —
  [single-market-economy.ec.europa.eu/single-market/digital-product-passport_en](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en).
  New this week as a named target rather than a general reference: the Registry now has a
  concrete, versioned user guide with a specific identifier-format rule our spec already satisfies.
  Reading the full user guide directly (blocked this session at the general DPP portal level in
  earlier weeks; worth a direct retry) would let a future entry state precisely how our
  `credentialSubject.id` requirement maps to the Registry's own field, rather than inferring
  compatibility from a search summary.
  W3C/GS1 workshop's own site remains
  [w3.org/2026/ecommerce-agents](https://www.w3.org/2026/ecommerce-agents/) for watching future
  outputs; no minutes or Community Group formation found yet.
- **IACR 2026/804 / UMBC CISA group** —
  [cisa.umbc.edu](https://cisa.umbc.edu/verifying-provenance-of-digital-media-security-analysis-of-c2pa-and-its-implementation/),
  paper at [eprint.iacr.org/2026/804](https://eprint.iacr.org/2026/804) (blocked a third
  consecutive week — if this session's network policy doesn't change, worth asking whether a
  future run should fetch it from a different tool or have a human paste the abstract in). The
  summarized findings are specific enough now (named timestamp-agreement gap, a dated fix request
  a subsequent release didn't act on) that this is overdue for an actual read before citing it
  any further in public-facing material.
- **FprEN 18246 (CEN-CLC/JTC 24)** — unchanged from last week; reported at formal vote, still not
  confirmed published.

### Spec gaps

Noted here per instructions, not edited into `SPEC.md`:

- Carried over, unresolved: `confidenceMethod`-style interaction with the §5.1 verdict; no named
  mechanism for v0.2 `credentialStatus` revocation; Ed25519-only with no crypto-agility statement;
  no bridging to the EU's emerging ESDC/ISO-IEC-20248 vocabulary; no stated scope boundary on the
  §6 no-auth requirement relative to the EU's tiered access model for the wider product-data
  category.
- No new gap identified this week. This week's EU DPP Registry finding was a compatibility
  confirmation, not a gap — noted above under differentiation rather than invented here to fill
  the section.

---

## 2026-09-20

General web search again this week. `eprint.iacr.org`, `arxiv.org`, `medium.com`,
`untp.unece.org`, and `bpma.co.uk` were all blocked by the network egress proxy on direct fetch
attempts this session — `eprint.iacr.org` specifically now blocked on every one of the five weeks
this radar has tried it. Items sourced from those domains below are read via search-result
summaries only, not the primary document, and flagged individually. Absence of a finding below
means "not found by this search," not "did not happen."

### What actually moved this week

- **A new, directly on-point competitor surfaced this week that no prior entry had found: the UN
  Transparency Protocol (UNTP), built by UNECE/UNCTAD.** UNTP defines "a suite of interoperable
  digital credentials and discovery mechanisms that enable verifiable supply-chain transparency at
  scale" — a UN standard digital product passport, a digital conformity credential, and a
  traceability-event structure spanning a value chain
  ([UNCTAD](https://unctad.org/news/unlocking-transparency-promise-un-transparency-protocol-global-trade),
  [UNECE spec index](https://untp.unece.org/docs/specification/), fetch of the primary site blocked
  this session, read via search-result summary). Per search summaries, UNTP mandates **W3C VC Data
  Model 2.0 using the JSON-LD Compacted Document Form with the W3C VC JOSE/COSE *enveloping* proof
  mechanism** — not the embedded Data Integrity proof (`Ed25519Signature2020`) our spec uses. That
  is a real, specific divergence between two VC-based provenance specs solving the same class of
  problem: UNTP wraps the credential in a signed JWT/JOSE envelope, ours signs a JCS-canonicalized
  (RFC 8785) JSON document directly per §3.2. Whether the two are cross-verifiable, or only
  cross-verifiable with extra tooling, was not established this week — no primary UNTP text was
  read, so treat this as a confirmed *difference in mechanism*, not yet a confirmed *interop
  problem*. UNTP v1.0 was reported, as of late summer, to be targeting release "by 1 September
  2026," "suitable for pre-production pilot implementations"; no independent confirmation was found
  this week that v1.0 actually shipped on that date, so treat it as targeted, not confirmed
  shipped. Named backers/implementers found this week: **Transmute** — already an adjacent
  competitor this radar tracks — published its own explainer on UNTP digital product passports
  ([Medium, transmute-techtalk](https://medium.com/transmute-techtalk/introducing-the-un-transparency-protocol-digital-product-passports-3e115213e64c),
  fetch blocked this session, read via search-result summary only), and the EU's own textiles
  transition-pathways platform is tracking UNTP as relevant to EU DPP implementation
  ([transition-pathways.europa.eu](https://transition-pathways.europa.eu/textiles/news/united-nations-transparency-protocol-untp)).
  A UN institutional backer aligning the same underlying data model (W3C VC) to the same problem
  (physical-item/supply-chain provenance) as our spec, with a named vendor implementer already
  writing about it, is a materially bigger signal than anything else logged in this radar to date
  — see awareness targets below.
- **The UK GOV.UK digital product record call for evidence closes tomorrow, 21 September 2026**,
  still with no news this week beyond confirmation of the closing date and topics covered
  ([GOV.UK](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy),
  [LexisNexis summary](https://www.lexisnexis.co.uk/legal/news/dbist-dbt-launch-call-for-evidence-on-digital-product-records-policy)).
  This is the fifth straight entry flagging it, and the window closes before this radar's next
  scheduled run. Stated plainly: it was not acted on while open. The honest framing going forward
  is not "still actionable" but "missed" — future entries should watch for the government's
  published response/summary of evidence instead, which is the next real opportunity to be cited
  or to comment.
- **FprEN 18246 remains reported "at formal vote," still not confirmed published**, consistent
  with every prior week back to 2026-09-02
  ([standards.iteh.ai catalog](https://standards.iteh.ai/catalog/standards/cen/9d9fbc1f-0c14-4e84-ab6c-f233e3f19398/pren-18246),
  [renoon.com](https://www.renoon.com/blog/digital-product-passport-standards-cen-cenelec-publication-in-may-2026)).
  One source this week states the Commission's own roadmap now expects both outstanding DPP
  standards (FprEN 18239, FprEN 18246) resolved "in September 2026" — the same "expected this
  month" framing carried for three weeks running, not new confirmation of publication.
- **W3C Confidence Method and Render Method status is contradictory again this week, same pattern
  as 2026-09-11.** The working group charter states both reach Recommendation status in September
  2026, but other search results this week describe Render Method as still undergoing horizontal
  review in late August/early September with an open a11y-review window through 2026-10-12
  ([w3c/a11y-request#176](https://github.com/w3c/a11y-request/issues/176),
  [w3cping/privacy-request#225](https://github.com/w3cping/privacy-request/issues/225)), and
  Confidence Method's own most recent dated Working Draft found is 2025-10-30
  ([w3.org/TR/2025/WD-vc-confidence-method-20251030](https://www.w3.org/TR/2025/WD-vc-confidence-method-20251030/)).
  A review window explicitly open until mid-October is inconsistent with "already a Recommendation"
  today. Carrying forward the same caution as last week: treat both as still pre-Recommendation,
  target unconfirmed, until a primary `/TR/` page with a dated Recommendation header is actually
  read.
- **The EU DPP Registry's launch date is now reported inconsistently across sources.** Prior
  entries (2026-08-19 onward) cited the Commission's own page for a **2026-07-20** operational
  date; a search result surfaced this week states the registry "launched... on September 2nd,
  2026." The primary Commission announcement page was not re-read this week to resolve the
  discrepancy, and the source making the September claim (bpma.co.uk) was blocked on direct fetch.
  Flagging the conflict rather than picking a date: this may be two different things (the Registry
  itself vs. a later public/testing-environment milestone) conflated by one summary, but it should
  not be repeated as fact in either direction without reading a primary source first.
- **The W3C/GS1 "E-commerce for Humans and AI Agents" workshop (Zurich, 2026-09-08–09) confirmed
  no formal outcomes report**, consistent with the 2026-09-11 entry's finding
  ([Forkast](https://forkast.news/what-agent-commerce-needs-from-product-data-lessons-from-the-w3c-gs1-workshop/)).
  New this week: Forkast's writeup names Google, Shopify, OpenAI, and Mars as participants framing
  the "last meter" problem (an agent completing a transaction without being able to definitively
  identify the exact physical item involved). No new information on outputs beyond last week —
  still nothing published to react to, only participants and framing.
- **The IACR C2PA security-analysis paper (eprint 2026/804) is unread in full for a fifth
  consecutive week** — both `eprint.iacr.org` and, newly this week, `arxiv.org` (blocked for the
  first time this radar has tried it directly, for the companion piece 2604.24890) failed on
  direct fetch. Per search-result summaries only: the specific mechanism behind the
  timestamp-tampering finding reported 2026-09-11 is that "nothing in the signed data references
  the timestamp," so a trusted timestamp can be stripped or swapped without invalidating the
  content signature — a structural gap in how the layers of the C2PA proof compose, not a bug in
  one implementation. Stated plainly, per the honesty rules: this radar has now cited this paper
  five times without reading it once, because the network path to it is blocked in this
  environment every week it has been tried. That is worth surfacing to whoever operates this
  routine directly, since a citable independent security analysis of a major adjacent spec is
  exactly the kind of source this radar exists to actually verify, not just relay.
- **Quiet or not found this search:** no dated Spherity or OriginTrail news specific to this week
  (OriginTrail's most recent dated item remains the 21 August Election Guardian launch, already
  logged 2026-09-02). No IBM TrustChain or Avery Dennison atma.io news. EPCIS 2.1 is reported still
  in progress, targeted for "end of 2026" — no version bump this week. GS1 Digital Link stays at
  the already-reported v1.7.0 (August 2026). The Global Digital Collaboration Conference (Geneva,
  2026-09-01–03) was covered only in general framing ("trust as infrastructure," cross-border
  digital wallets) — no item found connecting it specifically to physical-item provenance or to
  our narrow scope.

### Where we are genuinely differentiated

- **Offline verification with no server dependency** — unchanged, and UNTP's JOSE-enveloping-proof
  choice doesn't itself change this comparison (a JOSE-signed VC can also be checked with just a
  public key), but it's the first adjacent spec found using a *different* proof mechanism for the
  *same* data model, which is a new and more precise kind of divergence than "they need a server
  and we don't."
- **Three verdicts, no score** — unchanged; still can't be sharpened against Confidence Method
  while its status stays unconfirmed.
- **Adversarial conformance suite validated against deliberately broken implementations** — no
  equivalent found for UNTP this week either; worth checking directly once its own conformance
  material (if any) is actually readable.
- **Apache-2.0 with a patent grant on the protocol, proprietary platform** — unchanged. UNTP is a
  UN-governed open specification, not a vendor platform, so this contrast doesn't apply to UNTP the
  way it does to Spherity/Transmute/OriginTrail as products — a different, institutional kind of
  competition for "the reference definition" than a vendor comparison.

### Where we are genuinely behind

- **No revocation until v0.2** — unchanged.
- **Signatures prove authorship, not truth** — unchanged, structural.
- **No crypto-agility or post-quantum story** — unchanged.
- **No bridging to the EU's ESDC/ISO-IEC-20248 vocabulary** — unchanged; FprEN 18246 still not
  published.
- **No access-tiering model** — unchanged from 2026-09-09.
- **New this week: no stated position on proof-mechanism interoperability.** `SPEC.md` §3.2
  mandates an embedded Data Integrity proof over JCS-canonicalized bytes and says nothing about
  the JOSE/COSE enveloping-proof form that W3C VC 2.0 also permits and that UNTP has now chosen.
  Two specs both claiming "we implement W3C VC 2.0" while using incompatible proof mechanisms is
  exactly the kind of silent divergence our own conformance suite's canonicalization vectors exist
  to catch *within* one proof mechanism — this is the same failure mode one level up, *between*
  proof mechanisms, and today nothing in `SPEC.md` even names it as a choice that was made.

### Named awareness targets

- **UN Transparency Protocol (UNECE/UNCTAD)** —
  [untp.unece.org](https://untp.unece.org/docs/specification/) (fetch blocked this session, read
  via search summary; revisit directly next week). This is now the single most actionable
  awareness target this radar has found: a UN-governed spec using the same base standard (W3C VC)
  for the same problem class (physical-item provenance / supply-chain transparency), already being
  written about by an adjacent competitor (Transmute) and tracked by an EU sectoral platform
  (textiles). A short, direct technical comparison — proof mechanism, verdict/status model,
  offline-verifiability claims — read from UNTP's primary spec once fetchable, is higher-leverage
  right now than anything else on this radar, including the closing UK consultation.
- **UK GOV.UK digital product record call for evidence** —
  [gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy).
  Closes tomorrow, 21 September 2026, unsubmitted through five straight entries. Demoted from "top
  target" this week per the honesty rules — it is closing, not open — with the government's
  eventual published summary of responses as the next real touchpoint to watch for.
- **W3C `vc-confidence-method` and `vc-render-method` repos** — unchanged as ongoing watches:
  [github.com/w3c/vc-confidence-method](https://github.com/w3c/vc-confidence-method),
  [w3.org/TR/vc-render-method](https://www.w3.org/TR/vc-render-method/). Horizontal review windows
  open into mid-October make this the point to check back on Recommendation status.
- **IACR 2026/804 / UMBC CISA group** —
  [cisa.umbc.edu](https://cisa.umbc.edu/verifying-provenance-of-digital-media-security-analysis-of-c2pa-and-its-implementation/).
  Fifth straight week blocked from direct read in this environment; flagged above as an
  infrastructure limitation worth escalating rather than continuing to cite secondhand indefinitely.

### Spec gaps

Noted here per instructions, not edited into `SPEC.md`:

- Carried over, unresolved: `confidenceMethod`-style interaction with the §5.1 verdict; no named
  mechanism for v0.2 `credentialStatus` revocation; Ed25519-only with no crypto-agility statement;
  no bridging to the EU's emerging ESDC/ISO-IEC-20248 vocabulary; no stated scope boundary on the
  §6 no-auth requirement relative to the EU's tiered access model.
- New this week: `SPEC.md` §2–3 name exactly one proof mechanism (embedded Data Integrity,
  `Ed25519Signature2020`, JCS-canonicalized per RFC 8785) with no acknowledgment that W3C VC 2.0
  also defines a JOSE/COSE enveloping-proof form, which at least one other VC-based provenance
  spec (UNTP) has chosen instead. Worth a short note in a future revision naming the choice
  explicitly — e.g., "this specification defines the embedded-proof profile of VC 2.0; an
  enveloping-proof credential is out of scope for a v0.1 conformant verifier" — so the omission
  reads as a deliberate profile choice rather than an unnoticed gap once a reader is comparing the
  two specs side by side.

---

## 2026-09-22

General web search again this week. `w3.org`, `eprint.iacr.org`, `untp.unece.org`, and
`route-fifty.com` were all blocked by the network egress proxy on direct fetch attempts this
session — `eprint.iacr.org` specifically is now blocked on all **six** weeks this radar has tried
it. Absence of a finding below means "not found by this search," not "did not happen."

### What actually moved this week

- **New this week, not previously logged: a W3C Verifiable Supply Chain Community Group launched
  2026-02-21**, proposed 2026-02-03 by Amir Hameed Mir
  ([call for participation](https://www.w3.org/community/vsc/2026/02/21/call-for-participation-in-verifiable-supply-chain-community-group/),
  [Biometric Update](https://www.biometricupdate.com/202602/w3c-launches-group-to-tackle-supply-chain-fraud-with-vcs),
  [ID Tech Wire](https://idtechwire.com/w3c-launches-community-group-to-apply-verifiable-credentials-to-supply-chains/)).
  Its stated mission is to develop "industry-specific profiles, interoperability frameworks, and
  **certification guidelines**" so businesses can exchange cryptographically verifiable proofs of
  origin, custody, compliance, and sustainability, with deliverables explicitly including test
  suites, conformance criteria, and trust-anchor requirements, and it names pharma, automotive,
  food & beverage, critical minerals, and luxury goods as target verticals. This radar has logged
  five weeks of W3C VC Working Group activity without once finding a venue this directly aimed at
  *certifying* supply-chain verification implementations — which is exactly the problem
  `protocol/conformance/README.md` already ships a solution for. It's a Community Group (open
  participation, no membership fee, anyone can join or file input) and it's seven months old, not
  a mature venue with an established roster yet — this is early, not a place we're already
  overdue to.
- **The UK GOV.UK digital product record call for evidence closed as scheduled, 21 September
  2026, unsubmitted through six straight entries.**
  ([GOV.UK](https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy)).
  No government response or summary-of-evidence has been published yet, and no source found this
  week gives a timeline for one. Nothing left to act on regarding the original call; the next
  actionable moment is whenever that response lands. Consistent with 2026-09-20's framing that
  this was a missed window, not an open one — stated again plainly rather than re-flagged as live.
- **UNTP's proof-mechanism divergence from last week is now confirmed with a direct technical
  citation, not just search-summary inference.** Per GS1's own VC/DID technical-landscape
  reference and W3C's `vc-jose-cose` background material (search-summary level; primary pages
  blocked): **UNTP mandates JOSE enveloping proof (JWS, RFC 7515) for every credential it issues**,
  a deliberate choice over the embedded Data Integrity proof our spec uses, explicitly because
  JOSE verification "does not depend on `@context` resolution at proof-checking time" and lowers
  the implementation barrier by reusing mainstream web-security tooling. This is a real, named
  reason for the divergence, not an arbitrary one — worth citing precisely if a future comparison
  note gets written, rather than just "they chose differently." Separately: UNTP's own published
  Verifiable Credentials page still lives at a `/docs/0.7.0/` path
  ([untp.unece.org/docs/0.7.0/specification/VerifiableCredentials/](https://untp.unece.org/docs/0.7.0/specification/VerifiableCredentials/)),
  and the "1 September 2026" v1.0 target reported last week has now passed with no source found
  confirming it actually shipped — treat UNTP v1.0 as **still targeted, not confirmed released**,
  eleven days past its own target date.
- **Correcting forward, not editing 2026-09-11 or 2026-09-20: the "W3C VC Confidence
  Method/Render Method published as Recommendations" claim those two entries flagged as
  contradictory appears to trace to a conflation with a different, already-shipped spec.** The
  search hit behind that claim ("W3C Verifiable Credentials 2.0 Specifications are Now Standards")
  is Mike Jones's post about the **VC Data Model v2.0 family becoming a W3C Recommendation in May
  2025** — over a year before this radar's window, and a different pair of specs from Confidence
  Method and Render Method, which this week's search still finds tracked as open GitHub
  horizontal-review issues with a stated review window through 2026-10-12
  ([w3c/a11y-request#176](https://github.com/w3c/a11y-request/issues/176),
  [w3cping/privacy-request#225](https://github.com/w3cping/privacy-request/issues/225)). Treating
  this as resolved rather than still-contradictory: Confidence Method and Render Method are most
  likely **not yet Recommendations**, and the "published" claim in two prior entries was probably
  a search-summary mixing up VCDM 2.0 (old, shipped) with Confidence/Render Method (new,
  in-progress). Primary `/TR/` pages remain blocked this session, so this is a correction of
  confidence, not a confirmed primary-source read.
- **The EU DPP Registry launch-date discrepancy flagged 2026-09-20 is resolved: 20 July 2026 is
  correct.** Multiple independent, dated sources — the European Commission's own news page
  ([single-market-economy.ec.europa.eu](https://single-market-economy.ec.europa.eu/news/digital-product-passport-registry-now-live-2026-07-20_en)),
  Euroconsumers, Narravero, and an EU-monitoring outlet — converge on the Registry and testing
  environment going live **2026-07-20**, consistent with every entry before 2026-09-20. No source
  found this week corroborates the "launched 2 September 2026" claim that appeared last week;
  treat it as an error in that one summary, not a second milestone.
- **FprEN 18246 remains unpublished, and the specific date this radar should check next has now
  passed.** One source found this week states CEN-CENELEC's own tracker listed the standard as
  "under approval" with ratification scheduled **17 August 2026** and "definitive texts" expected
  **16 September 2026** — both now in the past, with no source found confirming either actually
  happened. Consistent with everything reported since 2026-09-02 (still not among the six DPP
  standards cited in the Official Journal), but this is the first week a concrete, now-lapsed date
  has surfaced — worth checking directly next week whether the 16 September date slipped or
  whether publication happened without fresh coverage yet.
- **A public "verdict, not a score" framing is visible in the adjacent AI-content-authenticity
  space this week**, via a Route Fifty piece on AI watermarking and digital trust rules (title and
  framing only — `route-fifty.com` was blocked on direct fetch, so this is a headline-level
  finding, not a read article). The line found in search results — "a watermark should be treated
  as a signal — not a verdict" — argues almost exactly our own §5.1 position (no partial-credit
  verdict, no numeric score) but for AI-generated-content watermarking rather than physical-item
  provenance. Noted as a live public argument in the neighboring space, not evidence of anyone
  discussing our narrow scope specifically.
- **Quiet or not found this search:** no dated Spherity, Transmute, OriginTrail, IBM TrustChain, or
  Avery Dennison news specific to this week (Avery Dennison's only dated item, an investor
  showcase 2026-09-23, is not verification-standard-related). No GS1 Digital Link or EPCIS version
  change — EPCIS 2.1 remains targeted "end of 2026," unchanged for the third week running. No
  GS1, ISO, or CEN open public-comment period specific to a provenance/credential standard was
  found this week (a broad search surfaced only unrelated consultations — net-zero standards, AI
  standardisation, ETSI cybersecurity drafts — none in our scope).

### Where we are genuinely differentiated

- **Offline verification with no server dependency** — unchanged.
- **Three verdicts, no score** — unchanged; the Route Fifty finding above is a reason to note this
  argument is happening in public, in an adjacent space, not to claim it's being made about us.
- **Adversarial conformance suite validated against deliberately broken implementations** —
  sharpened by this week's finding: a brand-new W3C Community Group has just named "certification
  guidelines" and "conformance criteria" for verifiable supply-chain credentials as explicit
  deliverables it doesn't yet have, in a space where — across six weeks of this radar — no
  comparable adversarial test suite has been found for GS1 Digital Link, EPCIS, the EU DPP
  Registry, UNTP, or any vendor tooling. We already have the thing a new W3C group is setting out
  to define.
- **Apache-2.0 with a patent grant on the protocol, proprietary platform** — unchanged.

### Where we are genuinely behind

- **No revocation until v0.2** — unchanged.
- **Signatures prove authorship, not truth** — unchanged, structural.
- **No crypto-agility or post-quantum story** — unchanged.
- **No bridging to the EU's ESDC/ISO-IEC-20248 vocabulary** — unchanged; FprEN 18246 still not
  published, now past its own reported target dates.
- **No access-tiering model** — unchanged from 2026-09-09.
- **No stated position on proof-mechanism interoperability** — unchanged from 2026-09-20, now
  reinforced with a confirmed, specific reason UNTP chose JOSE over embedded Data Integrity (see
  above), which makes the omission in `SPEC.md` §3.2 more concrete to fix, not more urgent in
  itself.

### Named awareness targets

- **W3C Verifiable Supply Chain Community Group** —
  [w3.org/community/vsc](https://www.w3.org/community/vsc/2026/02/21/call-for-participation-in-verifiable-supply-chain-community-group/),
  [participant list](https://www.w3.org/community/vsc/participants). New this week and the single
  most actionable item found: an open-participation venue, seven months old, explicitly building
  certification and conformance criteria for verifiable supply-chain credentials — precisely the
  problem our conformance suite already solves. Filing an issue, joining as a participant, or
  contributing the conformance suite's design (28 fixtures, deliberately-broken reference
  implementations, `--strict` reason checking) as prior art would put us in front of the exact
  people defining this category's certification model while the group's roster and deliverables
  are still forming, rather than after they calcify.
- **UNTP (UNECE/UNCTAD)** — [untp.unece.org](https://untp.unece.org/docs/specification/). Carried
  forward as still open and still blocked on direct fetch; now specifically worth checking for
  whether v1.0 has shipped, since its own "1 September 2026" target has passed unconfirmed.
- **FprEN 18246 (CEN-CLC/JTC 24)** — unchanged as a watch item, now with two lapsed target dates
  (17 August ratification, 16 September definitive text) to check against next week.
- **IACR 2026/804 / UMBC CISA group** —
  [cisa.umbc.edu](https://cisa.umbc.edu/verifying-provenance-of-digital-media-security-analysis-of-c2pa-and-its-implementation/).
  Blocked a sixth consecutive week. Secondary sourcing has converged enough (consistent findings
  across independent searches: timestamp-agreement failure between generators and validators,
  validators accepting manifests signed by known-compromised certificates, inconsistent
  cross-implementation results, an exclusion range permitting undetectable alteration, and a
  conformance program certifying products without technical review; published 2026-04-23) that the
  substance is probably reliable, but this radar has now cited a paper it has never once been able
  to read directly for six straight weeks. Repeating from last week, more firmly: this is worth
  raising with whoever operates this routine, since the block is an infrastructure limitation of
  this specific session's network path, not a property of the paper.

### Spec gaps

Noted here per instructions, not edited into `SPEC.md`:

- Carried over, unresolved: `confidenceMethod`-style interaction with the §5.1 verdict; no named
  mechanism for v0.2 `credentialStatus` revocation; Ed25519-only with no crypto-agility statement;
  no bridging to the EU's emerging ESDC/ISO-IEC-20248 vocabulary; no stated scope boundary on the
  §6 no-auth requirement; no stated position on JOSE/COSE enveloping-proof interoperability
  (logged 2026-09-20, reinforced this week with UNTP's specific stated rationale for choosing it).
- No new gap identified this week. This week's findings (UNTP's proof-mechanism rationale, the EU
  DPP Registry date correction, the Confidence/Render Method status correction) sharpened or
  resolved existing threads rather than surfacing a new one — noted under differentiation/behind
  above rather than invented here to fill the section.

---
