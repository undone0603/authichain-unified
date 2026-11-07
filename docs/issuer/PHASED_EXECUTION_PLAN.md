# AuthiChain — five-phase issuance and adoption execution plan

**Created:** 2026-11-06 (America/Detroit). **Approach:** build a verifiable issuer, not a self-awarded safety certificate. **Cost:** $0 development path; no paid third-party promotion or new cloud resources. This is an executable project plan with explicit evidence criteria, not a claim that every phase has shipped.

## Milestone and status matrix

| Phase | Scope | Work delivered in this source branch | Release-blocking acceptance |
|---|---|---|---|
| 1. Issuer identity & policy | Format, issuer/JWKS separation, clear semantics | Draft AuthiChain Evidence Credential v0.1, strict schema, key/issuer/subject pinning, public policy and key separation document | New independent signing key on isolated host; separate JWKS at `/.well-known/seal.json`; external review; safe rotation/compromise plan; LIVE readback |
| 2. Reproducible credential | Deterministic JWS, offline verifier, negative test vectors | Test-only stable fixture, Node offline CLI, tests, SHA-256 evidence digest, 24-hour expiry and fail-closed revocation parameter | Actual independently reproducible read-only observation; signed record under **new** AuthiChain issuer key; observer/subject separation; live verification, durable lifecycle, no unsupported claims |
| 3. QRON/consumer proof | Evidence page and scannable mark | Local read-only HTML evidence page, SVG status mark, localhost-only HTTP preview, content sanitization & no-certification states | Reviewed read-only Worker route; registered QRON URL on `authichain.com` with real source and issued credential; smartphone + print rescans; cache/expiry/revocation safeguards |
| 4. External acceptance | Blind reproducibility and independent trust | Third-party review instructions and explicit 36-case local Node suite | A non-author reproduces at pinned commit and key/fixture hash; independently inspects evidence, flags false positives, accepts scope; independent security reviewer approves before release |
| 5. Customer/revenue | Free evidence lookup; paid receipt + entitlement | Commercial product map, release gates, free-first revenue funnel, no side-effect interfaces | Genuine externally paid positive-dollar buyer, signed settlement receipt, idempotent entitlement/activation, real Stripe/Supabase evidence; protected CI/deployment; human holds preserved until reviewed policy change |

## Phase 1 — Establish an issuer (P0; key boundaries)

1. Keep production product issuer key and future Service SEAL key **separate**; never reuse `AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64`.
2. Pin issuer identifier to `https://authichain.com` only when domain ownership and new key custody have been proven. For SEAL Standard v9, `iss` must instead be the domain string `authichain.com`; this native AEC v0.1 is **not** v9-compatible.
3. Design public **read-only** `GET /.well-known/seal.json` for newly generated public Ed25519 keys. Never repurpose or overwrite current `/.well-known/jwks.json`. Publish `Cache-Control` consistent with bounded key withdrawal; record `kid`, rotation, compromise actions.
4. Require an approved key-custody path, separate signer permissions, no self-hosted PR execution with secrets, and independent security review. No signing endpoint exposed to arbitrary requests.
5. Publish an issuer-policy page separating cryptographic validity, observed evidence, issuer independence, subject ownership and physical truth. Include revocation, expiry, appeals and error states.

**Exit:** Independent reviewer demonstrates: (a) key isolation and JWKS pin; (b) revoked/expired/unknown key fails closed; (c) source evidence and owner claims do not imply safety/compliance; (d) no payment settings touched.

## Phase 2 — Reproducible evidence issuance (P0; a narrow true claim)

1. Capture a read-only MCP discovery observation with exact URL, response headers, hashed raw payload, UTC time, method and tool inventory. Do not execute unsafe tool calls or x402 settlement.
2. Make it publicly retrievable at a stable versioned read URL with SHA-256 digest. Where the observation is self-collected, mark `collector=issuer` and `issuer_relationship=self` explicitly.
3. Issue a JWS with bounded `exp-iat<=86400`, a pinned subject and issuer, evidence digest, source URL and scope caveats. Test-only reproducible key/capture remains clearly separated from live issuance.
4. Independently verify with a *pinned* JWKS file, not blindly trusted HTTP metadata. Reject wrong issuer, wrong subject, tampering, stale observation, duplicate IDs, unknown key, key mismatch, unsupported policy, overlong validity and unproven independence.
5. Reserve genuine buyer-transaction and product-authenticity assertions until the separate financial, item-binding and security gates are met.

**Exit:** External implementer can verify a real (not fixture) credential without AuthiChain's website and independently reproduce the bounded underlying observation. A successful signature **never** claims tool execution or paid response.

## Phase 3 — QRON presentation & domain-resolved record (P1)

1. Keep a QRON marker as a **pointer to a live verifier URL and evidence**, not the proof itself. The initial `/evidence/...` UI says issuer-signed, self-reported and actual verification status.
2. Show explicit statuses: signature valid but evidence not independently reproduced; invalid; expired; revoked; unknown; unavailable. A missing record must never become `authentic` or `counterfeit` by default.
3. Add a safe `/evidence/:id` read handler only after isolated, protected Worker CI. Ensure no read route exposes production credentials, customer PII or unsigned drafts.
4. Require printed and smartphone QRON recan acceptance: multiple phones, paper sizes, indoor light and low contrast. Capture scanner result and timestamp with an independently reviewable artifact manifest.
5. Preserve immutable historical evidence while serving dynamic current lifecycle state. Cache freshness must not preserve `valid` after expiry or revocation.

**Exit:** Scanned URL resolves reliably to an externally checkable signed record with dynamic, true status and no third-party endorsement confusion. Local preview **does not satisfy this**.

## Phase 4 — Independent review & interoperability (P0)

1. Publish an exact commit and evidence manifest with checksums; ask a non-author to run Node tests offline and inspect a fresh public observation.
2. Include negative tests against forged issuer, subject substitution, unknown/retired kid, tampered byte, wrong algorithm, expired/lapsed claim and forged score.
3. Distinguish SealKeeper v9 compatibility from this native AEC v0.1. If a v9 adapter is added, implement its **complete** required schema, proof-of-ownership, evidence consistency and actual thresholds before using its Service SEAL wording. Set `iss=authichain.com` and serve separately keyed `/.well-known/seal.json` only after review.
4. Invite Cedr, SealKeeper or independent A2A/MCP maintainers **without claiming their endorsement**. Use async GitHub public technical challenge; never assign a review to the user's alternate account as independent.
5. Include an abuse/appeal process and a public disclaimer: external evidence acceptance is per verifier policy, not universal authority.

**Exit:** Independent party reproduces cryptographic signature and evidence retrieval at immutable SHA, records a verified report with timestamp, hash and identity; eligible security reviewer approves deployable implementation.

## Phase 5 — Free-first commercial workflow (P1/P2)

1. **Free:** verification of published records, issuer keys, proof pages, QRON resolution, and read-only MCP discovery without account or payment.
2. **Paid:** create *optional* issuance and evidence-refresh products on the existing Stripe/catalog architecture, but DO NOT create prices, subscriptions or enable checkout solely for a prototype. Start with existing $29 Starter/$299 DPP human workflows after their real release gates.
3. **Qualifying transaction:** independently owned customer pays a positive dollar amount through actual Stripe checkout; webhook verified from raw Stripe signature, idempotent receipt recorded, entitlement granted exactly once, activation confirmed. Reconcile with canonical Supabase data. A $0 demonstration is not revenue.
4. **Proof of fulfillment:** issue a receipt referring to actual transaction evidence only once settlement, grant and activation have been verified by independent reviewer. Signed payment assertions require a new, separately reviewed schema and privacy policy; rejected by native v0.1 code.
5. **Distribution:** open technical test vectors, MCP directory/profile wording, public issuer and verifier documentation. Avoid reciprocal backlink schemes, imitation of SealKeeper badges, sweeping authenticity claims and paid promotion until genuine buyer acceptance.

**Exit:** One qualifying independently verified end-to-end transaction plus a customer using at least one credential; then assess sustainable ongoing revenue, not inferred MRR.

## Cross-cutting controls

- **Always:** `humanHold=true` and `production_send=false` unchanged, no production merges/deploys without exact-head native tests and eligible independent security review, no changing branch protections, no PR code on credential-bearing self-hosted runner, no hidden charges.
- **Hold if unknown:** missing/stale evidence, canceled CI, demo key, missing JWKS, unreproduced observation, unverified buyer, ambiguous product, unknown lifecycle and unsupported third-party wording.
- **Review artifacts:** exact SHA, test logs, source/evidence digest, signing-public-JWKS SHA, issued JWS digest, runtime deployment version and rollback route, recipient/observer identities with privacy redaction.
- **Owner split:** implementation can be completed by agent on isolated branch; trusted key activation and release require authorized operator + genuinely independent reviewer; paid activation remains a separate economic release.
