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
