# AuthiChain evidence-led anti-counterfeit casework v0.1

**Status: draft, offline-only pilot. No accusations, third-party contact, or live
MCP/A2A service deployment.** AuthiChain must be aggressive about gathering
valid evidence, not aggressive about inventing a verdict.

## Existing verification contract

The canonical AuthiChain verifier already distinguishes `verified`,
`warning`, `blocked`, `revoked`, `expired`, `risk`, `not_found` and
`indeterminate` in `packages/verifier/src/verification-decision.ts`.
**Do not replace these states with counterfeit/legitimate binaries.**

- A registered identifier or a QR match does not authenticate a physical item.
- `not_found` is not a counterfeit finding.
- An invalid signature is evidence of a verification failure, not by itself
  proof of a counterfeiting operation or malicious intent.
- A copied identifier on two labels **on the same package** is not evidence
  that two physical units carry a copied unique serial.
- A wholesale package/batch tracking number is not inherently a **per-unit**
  serialized anti-counterfeit identity.
- An issuer signature can attest to what the issuer claimed; it cannot prove
  an irreversible heat seal was correctly applied without physical evidence.
- Consumer photos of an open pouch with an intact-looking tear feature raise
  a **packaging integrity concern**. They cannot reconstruct first-opening
  chronology, original factory condition or unauthorized substitution.

GS1 resources:
- [GS1 Digital Link identifies an item and links data](https://support.gs1.org/support/solutions/articles/43000729075-what-is-gs1-digital-link-)
- [GS1 instance-level identifiers use GTIN + serial](https://support.gs1.org/support/solutions/articles/43000734238-how-does-serialisation-differ-from-unique-identification-in-the-gs1-system-)
- [GS1 digital signatures implementation guideline v1.1, January 2026](https://ref.gs1.org/guidelines/digital-signatures/)

## Threat-intelligence workflow

1. **Acquire privately.** Store original camera files, purchases/receipts,
   unopened sample handling, and lawful source provenance in an access-limited
   case file. Hash originals without editing them. An evidence hash only
   proves byte correspondence.
2. **Classify conservatively.** Use the proposed SealLock intake module from
   draft PR #2304 for an observation class, and
   `scripts/antifraud/evidence-casework.mjs` to consolidate reported signals.
   All facts are **untrusted until independently authenticated**.
3. **Verify identity with the canonical verifier.** Require an issuer-trusted
   signed claim, current lifecycle status, expiry and revocation checks. A
   QR/GS1 Digital Link URI is an address/identifier, not an issuer's signature.
4. **Distinguish potential cloning from normal reuse.** Compare different
   physical product instances only where the actual scheme guarantees unique
   instance identifiers. Verify product/lot context, issue policy and
   signatures. Repeat consumer scans and repeated barcode printing are not
   sufficient for a counterfeit conclusion.
5. **Inspect the physical seal.** Qualified reviewers evaluate controlled
   barrier drawings, lot sealing records, independent first-opening challenge,
   and applicable testing. Reproducible silent first-opening access is a
   package-design/safety finding, **not automatically a counterfeit finding**.
6. **Cross-check original COAs.** Verify the issuer identity and signature
   and compare the actual report bytes/digest; different PDFs or missing
   access are not automatically evidence of falsification.
7. **Prepare private quality review.** A qualified human reviews evidence,
   test limitations, custody, seller response and statutory scope.
8. **Escalate only on authority.** Manufacturer disclosure, retailer
   quarantine, regulatory referrals, legal notices, public advisories,
   enforcement and bounty payouts require separate authorized decisions.
   None are triggered by this module.

## Case severity is for reviewer scheduling only

| Class | Illustration | Immediate permitted step |
| --- | --- | --- |
| INFORMATION_ONLY | Lookup returned no record, or someone reports a signed claim | Verify resolver health, ask issuer for source records |
| TECHNICAL_REVIEW | Reported seal bypass, invalid-credential claim, copied per-unit ID, or COA discrepancy | Preserve evidence, select independent technical check |
| EXPEDITED_HUMAN_REVIEW | Two or more **different** reported risk families | Prioritize qualified review; no presumption that two claims are independent |

The reviewer must assess common-source artifacts and confirm independence.
Two distinct photo hashes do not mean two independent witnesses.

## MCP/A2A design — gated proposal only

`toSafeAgentExchange(triageCounterfeitEvidence(case))` generates a **redacted,
unsigned, untrusted** machine-readable proposal with the signal categories and
technical checks needed. It intentionally excludes actual case identifiers,
product IDs, photo hashes, seller names, links, images and user contact data.
It is not a live A2A Agent Card, MCP tool, JWS credential, signed issuer claim,
or production API.

A future service would require:
- Explicit consent for what a recipient agent may see; per-actor signed Agent
  Passport with scoped `READ_EVIDENCE` / `VERIFY_ATTESTATION`, policy and
  replay/idempotency controls.
- Authorized canonical verifier calls; no guest-submitted `verified=true`
  fields accepted as trust.
- Artifact redaction, access logs, chain-of-custody and retention policy,
  secure transfer and human authorization before identifying a party.
- Independently pinned conformance fixtures and security review, then
  staging; no production enablement while the runner, webhook or economic
  gates are unresolved.

### Offline usage

```js
import {
  triageCounterfeitEvidence,
  toSafeAgentExchange,
} from "./scripts/antifraud/evidence-casework.mjs";

// Synthetic fixtures only: NEVER put real package codes or photos in git.
const caseFile = {
  case_alias: "synthetic-case-001",
  intended_use: "private_internal_triage",
  evidence: [
    {
      ref: "synthetic-evidence-01",
      kind: "intact_tear_feature_open_mouth_reported",
      artifact_sha256: "a".repeat(64),
      source_class: "photo_reference",
    },
    {
      ref: "synthetic-evidence-02",
      kind: "retail_unopened_handoff_reported",
      artifact_sha256: "b".repeat(64),
      source_class: "consumer_report",
    },
  ],
};
const triage = triageCounterfeitEvidence(caseFile);
// Technical review. Not an authenticity, fraud or legal verdict.
const proposal = toSafeAgentExchange(triage);
// proposal contains no case ID, image hashes or enforcement authority.
```

## Neutral official referral path

When facts justify regulatory review in Michigan, the official
[CRA complaint process](https://www.michigan.gov/cra/file-a-complaint)
accepts complaints about licensed marijuana businesses, and allows anonymous
reporting. **Do not automatically file** from a software risk flag. Review
evidence, chain-of-custody, correct entity and reporting rules. CRA
[Field Operations](https://www.michigan.gov/cra/sections/enforcement-division/field-operations-section)
investigates regulated operations and uses Metrc for statewide seed-to-sale
tracking. A Metrc package tag is not interchangeable with an AuthiChain-signed
per-unit certificate.

Keep the private case named in user-provided retail evidence **out of the
public repository**. We have only a reported possibly bypassable first-opening
barrier and matching labels on the pictured material. That is insufficient to
infer a counterfeit operation or intentional wrongdoing.

## Safety acceptance

**Never** issue a counterfeit verdict, legal demand, takedown, public adverse
allegation, payment, bounty settlement, automatic vendor contact, product
release or production write based only on casework output. The proposed
`scripts/antifraud/evidence-casework.test.mjs` covers these negative cases.

Native Node test:
`node --test scripts/antifraud/evidence-casework.test.mjs`.
Do not merge until the exact-head required jobs actually run and independent
review approves this file and the privacy boundaries.
