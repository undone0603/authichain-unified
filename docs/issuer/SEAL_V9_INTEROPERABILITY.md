# SealKeeper SEAL Standard v9 interoperability — separate adapter track

**Upstream primary source:** https://sealkeeper.run/seal/standard (retrieved 2026-11-06). The draft says other parties may publish their own JWKS at `https://<issuer-domain>/.well-known/seal.json` and issue SEALs with `iss` equal to that domain. This permission does **not** make AuthiChain a SealKeeper-accepted issuer or certify any AuthiChain service. Do not copy the SealKeeper logo, trademark, score labels or badge shape; use a distinct AuthiChain identity and explain the issuer.

**Precise distinction:** native AuthiChain Evidence Credential (`AC-EVIDENCE+JWS`, `schema=authichain:evidence-credential:v0.1`) is **not** a v9 SEAL. Its subject is an HTTPS URL, whereas SEAL v9 `sub` is an agent/service ID derived according to that standard. Its `iss` is a URL, whereas SEAL v9 `iss` is the issuer's domain string. Its evidence model intentionally has no bronze/silver/gold standing, verified owner status or completed-task counters.

## Full v9 acceptance checklist — NOT implemented in this prototype

1. **Keys:** standalone key pair distinct from AuthiChain product attestation signer. Read-only `/.well-known/seal.json` returns Ed25519 public JWK with nonduplicated `kid`, `use=sig`, `alg=EdDSA`. Evidence of secure handling/rotation and at most 24h SEAL lifespan. Verify that `iss=authichain.com` resolves to the pinned issuer keys; never accept a `jku` from untrusted JWS header.
2. **Subject ID:** independently derive subject key ID and compare `sub` against the expected agent/service ID. Do not use an arbitrary URL as SEAL v9 `sub`.
3. **Payload:** `ver:9`, `iat`/`exp`, `agent_version`, `subject.kind`, `subject.interfaces`, `subject.paid`, `level`, `scores`, `counts`, `counted`, `fingerprint`, `routine_fingerprint`, `state`, `trust`, `top_categories`, `operator`, `identity`, `owner`, `listing` and `evidence` with strict meanings. No invented high score, Bronze or Silver. Validate every required field and schema constraint, including v9 owner proof rules.
4. **Evidence:** for `interfaces:["mcp"]`, implement **real** `mcp_check` observations, canonical definitions/fingerprint, no tool-call claim, hidden-text screening and owner-confirmed definition changes. For x402, use actual `x402_check` unpaid challenge, published-price comparison and wallet provenance; **not** paid settlement tests.
5. **Standing:** independently compute the appropriate MCP or x402 ladder from observed windows and independent ownership proof. Withhold credentials on unresolved risky changes, hidden text, above-declared prices, wallet disputes, unknown trust or missing observation. Do not self-award Silver/Gold because the issuer controls the domain.
6. **External conformance:** run against published CLI/reader fixtures and independent standard implementations; pin immutable official test vectors. If unsupported, say 'AuthiChain Evidence Credential' instead of 'SEAL Standard compliant'.
7. **Badge:** distinguish issuer `AuthiChain` from SealKeeper and show issuer, kind, evidence limitations and current/unknown/withheld states. Verify cryptography and current standing before any third-party consumer displays the badge.

## Why this two-lane approach

Native evidence credentials can faithfully represent product and transaction provenance, while SEAL v9 has a narrower `agent`/`service` vocabulary and scored activity criteria. Conflating the formats or copying an existing issuer's `bronze` standing would undermine the trust layer AuthiChain is trying to build.

**Status:** Design and test gate only. The code in this branch does not produce a v9 credential and does not publish a production issuer key.
