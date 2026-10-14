# NSF SBIR Project Pitch — Offline-Verifiable Digital Product Passports

**Applicant (SAM legal entity):** ZACHARY KIETZMAN — UEI R34XKWRJY9A5, CAGE 1PUJ6 (Active through 2027-04-20). AuthiChain is a brand, not a corporation; see `docs/project/SAM_PREP.md`.
**Program:** NSF SBIR Phase I (solicitation 26-510, up to $305,000).
**Target deadline:** 2027-03-04. The pitch must be invited first, and NSF says a response takes about 1–2 months, so the pitch should go in by mid-December 2026. The 2026-11-04 deadline is not reachable.
**Topic:** confirm the best-fit topic on seedfund.nsf.gov before submitting (candidates: Cybersecurity and Authentication; Distributed Ledger; Advanced Manufacturing).

Each section below is pasted into the portal as plain text. The character limits are NSF's.

**Truth rule:** every claim below is backed by code in this repository or a public regulation. No customer, partner, pilot result or market figure appears unless it can be cited. Do not add any before submitting.

---

## 1. Technology Innovation (≤ 3,500 characters)

Product-compliance rules such as the EU Battery Regulation's battery passport (Regulation (EU) 2023/1542, applying from February 2027) and the Ecodesign for Sustainable Products Regulation require that a scan of a physical product returns trustworthy claims about it: origin, materials, carbon footprint, due diligence. Today those claims are usually served as web pages from the manufacturer's database. A verifier must trust that server, must be online, and receives either everything or nothing.

We propose a passport format and verification protocol in which each product claim is an independently verifiable, cryptographically signed statement bound to the evidence that supports it, and which a verifier can check without contacting the issuer.

Our current implementation, built and tested, already provides: deterministic canonicalization of passport data; a SHA-256 evidence-manifest hash that binds each claim to its supporting documents; Ed25519 issuer signatures; issuer key publication via JWKS; revocation and supersession status for attestations; and resolution of product identifiers through a GS1 Digital Link resolver.

The innovation this project will research is the combination of three properties no deployed passport system we know of offers together:

1. Offline verification with bounded staleness. A verifier at a port, warehouse or recycling facility can verify a passport with no network, and the protocol states explicitly how stale the revocation information may be and what verdict is returned when that bound is exceeded.
2. Tiered selective disclosure. The Battery Regulation defines different access for the public, for persons with a legitimate interest, and for authorities. We will let one signed passport disclose only the claims a verifier's tier permits, without the issuer re-signing per audience.
3. Evidence-linked verdicts. Instead of "valid / invalid", the verifier returns which claims are supported, by which evidence hash, under which signing key, and with what status freshness, so that an auditor can reproduce the result.

## 2. Technical Objectives and Challenges (≤ 3,500 characters)

Objective 1 — Bounded-staleness revocation for offline verifiers. Challenge: revocation normally needs a live status check. We will design and evaluate compact signed status snapshots (for example, bitstring status lists with signed timestamps) that a verifier caches, and define a verdict model that degrades predictably as the snapshot ages. Success: a formal specification, an implementation, and measurements of snapshot size and verification time at catalogue sizes from 10^3 to 10^7 passports.

Objective 2 — Selective disclosure across access tiers. Challenge: Ed25519 signs a whole document, so withholding a field breaks the signature. We will evaluate salted-hash disclosure (as in SD-JWT) against BBS+ style signatures for passport-sized documents, measuring payload size, verification cost on low-end mobile devices, and unlinkability between scans. Success: a chosen scheme with published trade-off data and an implementation that passes our existing passport test suite.

Objective 3 — Key lifecycle without trust in the platform. Challenge: if the issuer's key is rotated or compromised, previously issued passports must stay verifiable or be clearly invalidated. We will specify key rotation, compromise handling and historical verification, and test them adversarially (replayed passports, reused idempotency keys, revoked-then-resurrected claims).

Objective 4 — Validation. We will build a reference offline verifier and run it against battery-passport-shaped test data mapped to the Annex XIII data categories, reporting false-accept and false-reject rates for each adversarial scenario.

Key risks are payload size for selective-disclosure schemes on QR-encoded identifiers, and verifier performance on low-end hardware. Both are measurable in Phase I.

## 3. Market Opportunity (≤ 1,750 characters)

The EU Battery Regulation makes a digital battery passport mandatory for EV, industrial (over 2 kWh) and light-means-of-transport batteries placed on the EU market from February 2027, and the ESPR extends digital product passports to further product groups through delegated acts. US manufacturers and importers selling into the EU must comply.

Our first customers are small and mid-size manufacturers and importers that need a compliant passport without building signing, key management and verification infrastructure themselves. A second segment is auditors and market-surveillance bodies, who need verification that works without trusting each manufacturer's server.

AuthiChain already sells a self-serve DPP readiness product with live Stripe checkout and automated provisioning. Phase I research becomes the verification core of that product.

[Owner: add verified revenue, paying customers or signed letters of support here only if they exist; leave this note out otherwise.]

## 4. Company and Team (≤ 1,750 characters)

AuthiChain is operated by Zachary Kietzman as a sole proprietorship (SAM UEI R34XKWRJY9A5). Zachary designed and built the platform: the signed-passport and attestation services, issuer key publication, revocation status, the GS1 Digital Link resolver, the Cloudflare Workers edge stack, and the Stripe checkout and provisioning flow.

[Owner: add relevant education, prior roles and publications.]

For Phase I we plan to engage a university collaborator in applied cryptography for the selective-disclosure and revocation analysis (Objectives 1–2). [Owner: name them only after they agree.]

---

## Before submitting — owner checklist

- [ ] Confirm the applicant is eligible as a for-profit small business concern (sole proprietorships can qualify; check the current NSF solicitation's eligibility section and the SBIR.gov company registry).
- [ ] Register on SBIR.gov and in Research.gov if not done.
- [ ] Fill in the bracketed owner notes or delete them.
- [ ] Check each section is under its character limit.
- [ ] Submit the pitch by mid-December 2026 so an invitation can arrive before 2027-03-04.
