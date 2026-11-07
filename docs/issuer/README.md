# AuthiChain Evidence Issuer — review-only prototype

**Status: IMPLEMENTED LOCALLY / NO PRODUCTION RELEASE.** This is a proposed AuthiChain-owned evidence credential and verification interface. Nothing in this directory is a certification, a SealKeeper-issued SEAL, a validated customer record, a paid x402 transaction, or a deployed signer. Signed demo receipts use a **publicly known, non-secret TEST KEY** with fictional issuer `https://issuer.example` and fictional subject `https://service.example/mcp`.

## What has actually been implemented

* `protocol/evidence-seal.mjs`: standalone Ed25519 compact-JWS issuer/verifier with **explicit public key pinning**, signed subject/issuer binding, max 24-hour lifetime, evidence digest references, reject-by-default schema, issuer relationship and caveats. Cryptographic integrity is separate from evidence truth.
* `protocol/evidence-seal-cli.mjs`: deterministic **test-only** fixture generation, offline verification with pinned keys and exact issuer/subject, SHA-256 hashing.
* `protocol/evidence-seal-view.mjs`: fail-closed HTML evidence page and a distinct, explicitly non-certifying SVG evidence badge. Renders expired/revoked/invalid claims without success indicators; escapes untrusted data.
* `scripts/evidence-seal-demo-server.mjs`: localhost-only read-only preview showing a credential, its test keys, source digest and badge. `POST` and financial endpoints return 405/404; never binds a production secret.
* Node built-in tests: positive, negative and adverse paths for tampering, missing proof, stale evidence, future/expired, issuer/subject mismatch, key compromise/rotation, disallowed claims, unsafe URLs, escaping and network endpoint behavior.

**Important:** `https://authichain.com/.well-known/jwks.json` is for **existing product attestation keys**. A prospective `https://authichain.com/.well-known/seal.json` must serve **new, separately controlled issuance keys** after independent review. Do not copy the product private key or use the deliberately public demo key for production. This preview does **not** install `.well-known/seal.json` in production.

## Reproduce offline (Node 22)

```bash
node --test protocol/evidence-seal.test.mjs scripts/evidence-seal-demo-server.test.mjs
node protocol/evidence-seal-cli.mjs demo /tmp/aec-example
node protocol/evidence-seal-cli.mjs verify \
  /tmp/aec-example/test-only.jws /tmp/aec-example/test-only-jwks.json \
  https://issuer.example https://service.example/mcp 1794000001
node protocol/evidence-seal-cli.mjs hash /tmp/aec-example/test-only-observation.json
node scripts/evidence-seal-demo-server.mjs
# Test-only local preview: http://127.0.0.1:37880/evidence/demo
```

The pinned test timestamp is **2026-11-06T21:20:00Z**; verify at that time (`1794000001`) because the example is deliberately short lived and is expired at later times. Offline verification requires the caller to provide **an independently trusted** JWKS and the expected issuer and subject; never accept key URLs supplied inside an unverified claim as a trust anchor.

### Supported (draft) evidence scope

Only read-only source references for `mcp_discovery`, `x402_unpaid_challenge`, and `signed_record_check`. All are recorded as **issuer-collected**, with a digest, timestamp and public evidence URL. Verification reports `evidence_verification: not_performed`; a digest is not evidence validation. The program refuses any attempt to assert external independence, premium standing, paid settlement, fulfilled entitlement, physical authenticity or regulatory certification.

The preview badge deliberately says **SIGNATURE VALID · NOT CERTIFICATION**, not `AuthiChain VERIFIED` or a SealKeeper-issued Service SEAL. It is an evidence view, not a marketing endorsement.

## Status and next gates

See [full five-phase plan](PHASED_EXECUTION_PLAN.md), [release gates](RELEASE_SAFETY.md), [SEAL Standard v9 interoperability](SEAL_V9_INTEROPERABILITY.md), [external reproduction kit](PEER_REPRODUCTION.md), and [commercial plan](GO_TO_MARKET.md). Do not merge/publish until the current commit has native repository CI, isolated execution and eligible independent security review. Do not trigger payments or lift existing `humanHold=true` / `production_send=false` or finance/production controls.

### QRON preview pointer (test-only)

[`QRON_SOURCE_PREVIEW.svg`](QRON_SOURCE_PREVIEW.svg) contains a real, optically decoded QR code whose URL resolves to **this source-review directory**, not an issued customer credential. It is generated deterministically by `scripts/make-qron-preview.py`, with a plain disclaimer visible in the mark. Local OpenCV QR decoding succeeded on a rasterization of the SVG. That is not a substitute for real smartphone/print acceptance or a production credential resolution route.
