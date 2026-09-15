# AuthiChain Evidence-Backed Standards Architecture Matrix

**Status:** architecture baseline / implementation mapping  
**Scope:** AuthiChain verification layer, attestation contract, physical-digital binding, evidence, identity, and product-facing adapters  
**Last reviewed:** 2026-09-15

## Purpose

This document maps AuthiChain's current v0.1 architecture to external standards and authoritative reference systems. It is intentionally a **conformance map**, not a claim of certification or formal compliance.

The governing design principle is:

> AuthiChain provides a reusable verification and trust-decision layer; QRON, Nightstamp, StrainChain, GovChain, and future products are distribution/domain surfaces around that layer.

The repository already defines a signed attestation connecting a provider-scoped `object_id` to a physical product identifier where available, separates evidence/decision/status/issuer/subject, uses Ed25519 compact JWS, publishes a JWKS, and exposes a consumer verification contract. See `docs/attestation/v0.1.md`.

## Status vocabulary

- **Conforms:** AuthiChain implements the relevant concept/requirement in a way that is materially aligned with the referenced specification. This does not imply certification.
- **Extends:** AuthiChain adopts the external model and adds a stronger/domain-specific capability.
- **Partial / target:** the architecture is aligned, but an explicit interoperability implementation or test is still required.
- **Deliberate difference:** AuthiChain intentionally does not adopt a referenced mechanism because it solves a different layer of the trust problem.
- **Not applicable:** the source is useful as an architectural analogue but does not define a requirement AuthiChain is intended to satisfy.

## Matrix

| Reference | What the external source establishes | AuthiChain alignment | Status | Exact gap / next proof |
|---|---|---|---|---|
| **NIST IR 8536 — Supply Chain Traceability: Manufacturing Meta-Framework** | A technology-neutral framework for identification, traceability, provenance, linking/querying records, interoperability, selective disclosure, and independent verification across distributed manufacturing ecosystems. NIST's 2026 finalization emphasizes cryptographically verifiable links without requiring a centralized repository. | AuthiChain already separates object identity, issuer, evidence, status, and decision; its attestation binds a provider-scoped object to GTIN + serial/lot where available; signed attestations and verification provide independently checkable integrity. | **Extends** | Map AuthiChain event/evidence records explicitly to the NIST traceability concepts and publish a crosswalk plus reference test vector. Do not claim NIST conformance until that crosswalk is tested. |
| **GS1 Digital Link** | Standardized representation of GS1 identification keys in Web addresses, including identifiers such as GTIN and serial/lot-related attributes, to connect products with online information and services. | AuthiChain's v0.1 contract explicitly accepts GTIN and serial/lot and uses a provider-scoped `object_id`. This is compatible with GS1 identifiers as product identity inputs. | **Partial / target** | Implement a documented GS1 Digital Link URI mapping and test resolution from a GS1 identifier to AuthiChain verification. |
| **GS1-Conformant Resolver** | A resolver model for discovering multiple information resources associated with a GS1 identifier. | AuthiChain's architecture can expose verification, evidence, DPP, recall, certificate, or consumer resources behind the same product identity. | **Partial / target** | Build a conformant resolver profile or document AuthiChain as a resolver target/resource rather than claiming to be a conformant resolver today. |
| **W3C Verifiable Credentials Data Model 2.0** | A machine-verifiable credential model with cryptographic security, privacy considerations, extensibility, and issuer/holder/verifier roles. | AuthiChain uses signed, machine-verifiable attestations with explicit issuer, subject, status, decision, and verification endpoints. | **Extends / interoperable target** | Publish a mapping from the AuthiChain attestation model to VC 2.0 concepts and decide whether to expose a VC representation in addition to the compact JWS-native representation. |
| **ISO 22383:2020 — Authentication solutions for material goods** | Guidance for validating authenticity and integrity of material goods using authentication elements/solutions across the supply chain; relevant to anti-counterfeiting, product fraud, and diversion. | AuthiChain directly targets authenticity/integrity decisions for physical goods and explicitly states that a valid signature alone does not prove physical-item correspondence. This is a strong architectural match. | **Conforms conceptually; extends** | Build an ISO 22383-oriented authentication-element evaluation record and test copied-code, transferred-label, and subject-mismatch scenarios. Formal ISO conformity/certification is not claimed. |
| **EU Digital Product Passport (DPP) / ESPR ecosystem** | DPP architecture connects regulated product data with identifiers and market/compliance workflows; the EU is establishing registry infrastructure rather than requiring all detailed product data to live in one central database. | AuthiChain's provider-scoped object identity, evidence, attestations, verification API, and DPP-oriented StrainChain/GovChain surfaces fit a decentralized evidence + verification model. | **Extends** | Define an explicit DPP adapter: identifier mapping, required metadata, evidence references, access policy, and verification result semantics. |
| **EU DPP Registry implementing framework (2026)** | The EU framework establishes implementation arrangements for the DPP registry under Regulation (EU) 2024/1781. | AuthiChain can act as a verification/evidence service adjacent to registry infrastructure rather than attempting to replace the registry itself. | **Deliberate difference / complementary** | Document the boundary: EU registry/index functions remain external; AuthiChain supplies trust evidence and verification. Add interoperability tests when the applicable registry interfaces are stable. |
| **FDA DSCSA product tracing / verification** | DSCSA establishes product-identifier and transaction-tracing requirements for covered prescription drugs and verification workflows for suspect/illegitimate products. | AuthiChain's identity + evidence + status + decision model maps naturally to regulated product verification, and the repository already treats pharmaceutical/medical traceability as a target domain. | **Extends / domain adapter** | Create a DSCSA-specific adapter/crosswalk. Do not represent generic AuthiChain verification as DSCSA compliance; compliance depends on the customer's complete operational and regulatory implementation. |
| **AAMVA mDL Digital Trust Service** | A trusted service distributes verified issuer public keys to relying parties so credentials can be cryptographically verified against legitimate issuing authorities. | AuthiChain publishes issuer verification keys through JWKS and uses `kid`/issuer identity for signed attestations. | **Conforms architecturally; extends to products** | Define issuer onboarding, key lifecycle, revocation, rotation, and trust-list governance. A public JWKS alone is not equivalent to AAMVA's governance model. |

## Cross-standard architecture

```text
                         AUTHICHAIN TRUST LAYER

   GS1 identity          W3C credentials        Issuer trust
       │                       │                     │
       └──────────────┬────────┴──────────────┬──────┘
                      ▼                       ▼
                Object / Subject        JWKS + key status
                      │                       │
                      └──────────┬────────────┘
                                 ▼
                       Signed Attestation
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
              Evidence       Provenance      Product data
                 │               │               │
                 └───────────────┼───────────────┘
                                 ▼
                    Physical ↔ Digital Binding
                                 │
                                 ▼
                        AUTHICHAIN VERIFY
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
                  ALLOW        REVIEW       BLOCK
                    │            │            │
                    └────────────┼────────────┘
                                 ▼
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
              Nightstamp       QRON       StrainChain
                  │              │              │
                  └──────────────┼──────────────┘
                                 ▼
                              GovChain
```

## AuthiChain's deliberate architectural boundaries

### 1. Verification is the core product

Commercial surfaces should call the same verification contract rather than implement independent authenticity logic.

```text
commercial surface
       ↓
AuthiChain SDK / API
       ↓
attestation + evidence + identity + binding
       ↓
ALLOW / REVIEW / BLOCK
```

### 2. A signature is necessary but not sufficient

The v0.1 contract deliberately states that a valid signature proves integrity and issuer control of the attestation, **not** that the physical item matches the attested subject. The verifier therefore evaluates subject mapping, evidence continuity, freshness, revocation, and policy.

This distinction is central to AuthiChain's differentiation from a QR-code-only authentication product.

### 3. AuthiChain is not a replacement for GS1, W3C, NIST, ISO, FDA, or EU infrastructure

The intended strategy is interoperability and specialization:

- GS1 supplies globally recognized product/organization identifiers and resolver conventions.
- W3C supplies interoperable credential semantics.
- NIST supplies traceability principles and cross-ecosystem architecture.
- ISO supplies authentication-system guidance.
- FDA supplies regulated-domain requirements.
- EU DPP infrastructure supplies regulatory registry/interoperability requirements.
- AuthiChain supplies an implementation-focused trust decision layer connecting these inputs to evidence and physical-digital binding.

## Required proof artifacts

The following should become part of the AuthiChain conformance package before making external claims:

1. **NIST crosswalk** — each relevant IR 8536 concept mapped to an AuthiChain object/event/evidence field.
2. **GS1 Digital Link fixture** — GTIN + serial/lot → resolver → AuthiChain verification resource.
3. **VC 2.0 mapping** — issuer/credentialSubject/proof/status semantics mapped to AuthiChain attestation fields.
4. **ISO 22383 scenario pack** — copied identifier, transferred label, counterfeit object, genuine object, revoked issuer/key, and subject mismatch.
5. **DPP adapter fixture** — product identifier + required DPP data/evidence references + AuthiChain verification result.
6. **DSCSA domain profile** — explicit boundary between AuthiChain cryptographic verification and customer regulatory compliance.
7. **Issuer trust fixture** — JWKS rotation/revocation/unknown-key behavior with deterministic verifier results.
8. **Interoperability test suite** — machine-readable fixtures suitable for independent third-party execution.

## Evidence sources

### NIST

- NIST IR 8536: https://csrc.nist.gov/pubs/ir/8536/final
- NIST NCCoE publication notice: https://www.nccoe.nist.gov/projects/supply-chain-traceability

### GS1

- GS1 Digital Link: https://www.gs1.org/standards/gs1-digital-link
- GS1 Digital Link specification: https://ref.gs1.org/standards/digital-link/
- GS1-Conformant Resolver: https://ref.gs1.org/standards/resolver/

### W3C

- Verifiable Credentials Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/
- W3C VC 2.0 publication: https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/

### ISO / anti-counterfeiting

- ISO 22383:2020 overview: https://euipo.europa.eu/anti-counterfeiting-and-anti-piracy-technology-guide/iso-223832020

### European Union

- EU DPP registry implementing regulation: https://op.europa.eu/en/publication-detail/-/publication/f3abfafa-43d7-11f1-8095-01aa75ed71a1/language-en

### FDA

- DSCSA product tracing FAQ: https://www.fda.gov/drugs/drug-supply-chain-security-act-dscsa/drug-supply-chain-security-act-product-tracing-requirements-frequently-asked-questions
- FDA DSCSA product identifiers: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/product-identifiers-under-drug-supply-chain-security-act-questions-and-answers
- FDA DSCSA verification systems: https://www.fda.gov/media/117950/download

### AAMVA

- Mobile Driver License Digital Trust Service: https://www.aamva.org/identity/mobile-driver-license-digital-trust-service
- DTS relying parties: https://www.aamva.org/identity/mobile-driver-license-digital-trust-service/for-relying-parties

## Claim discipline

This document intentionally uses **conforms / extends / partial / deliberate difference** instead of saying AuthiChain is "compliant" with a standard. Formal certification, regulatory compliance, or GS1/W3C/ISO/NIST conformance should only be claimed after the relevant external test or assessment has actually been completed.

The strongest current claim is architectural:

> **AuthiChain is designed as an interoperable verification and trust-decision layer that can bind signed product claims and evidence to provider-scoped physical-object identities while remaining compatible with established identity, credential, traceability, and regulatory ecosystems.**
