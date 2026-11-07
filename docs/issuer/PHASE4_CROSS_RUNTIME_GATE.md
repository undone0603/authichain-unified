# Phase 4 — Cross-runtime review gate (Python, Node and independent non-author)

**Status:** review-only; local cross-language checks passed but no eligible external reviewer has signed off. This is a native AuthiChain Evidence Credential (AEC) v0.1, **not** a SealKeeper SEAL v9, a security certification, product-authenticity certificate, or proof of paid settlement.

## Independent challenge already reproducible from this branch

For a pristine checkout of the exact commit linked in issue #2392, a Node 22 verifier needs no external packages:

```sh
node --test protocol/evidence-seal.test.mjs protocol/third-party-service-seal.test.mjs scripts/evidence-seal-demo-server.test.mjs
node protocol/evidence-seal-cli.mjs demo /tmp/aec-peer
node protocol/evidence-seal-cli.mjs verify /tmp/aec-peer/test-only.jws /tmp/aec-peer/test-only-jwks.json https://issuer.example https://service.example/mcp 1794000001
node protocol/evidence-seal-cli.mjs verify /tmp/aec-peer/test-only.jws /tmp/aec-peer/test-only-jwks.json https://issuer.example https://service.example/mcp
```

The historical-time fixture must pass; verifying at present time must refuse the expired test credential. The deterministic Ed25519 signing seed is **public test material** and may not be used for deployment. `issuer_relationship=self` and `evidence_verification:not_performed` are mandatory disclosures.

## Additional local cross-runtime reproduction (2026-11-07 UTC)

A separately written, offline Python `cryptography` verifier checked the *same Node-issued fixture* and separately validated the Ed25519 signature, pinned JWKS, exact issuer/subject, receipt expiry/revocation and optional evidence byte digest. **22/22 Python tests PASS**, plus **50/50 existing Node tests PASS**, on Python 3.11+ / cryptography 46.0.4 and Node 22.16.0; this does **not** count as review by a different person.

Exact checksums of the locally tested additions:
- `protocol/evidence-seal-verify.py` SHA-256: `1cb04898a9bde39d727c7f925399ed6a62d096ddb9720b12c4a0b7ae61f59934`.
- `protocol/evidence-seal-verify.test.py` SHA-256: `adc65acded27884a5a245a408c4457d3f0d050a3235e0a8e94ace884223e98ea`.
- Unsigned test-only JWS `demo-output/test-only.jws` SHA-256: `0985db677b46531b9e080c329a8fcc1c08d014c89257f71c3432cacc9ca57296`.
- Pinned public demo JWKS `demo-output/test-only-jwks.json` SHA-256: `d1d11d0b071c34cc3eed90f3b3e8f7b48f361a5408e0a6ca67f957f264b722f2`.
- Local raw fixture observation SHA-256: `77a5635ee1edbe651b34b01328aae0f83605db6d4b43dc53f5eab366f7c48a9a`.

**Publishing state:** Python source/test files have not been added to this GitHub branch in this commit; the downloadable reviewed handoff ZIP lives in the generating ChatGPT conversation. Do not claim public source-exact Python CI until those exact SHA-256 files are published and reproduced. Existing Node source on the pinned branch remains the public independent-review target.

## Requested non-author peer review

1. Run tests from exact SHA in fresh, credential-free Node environment. Capture real logs, test runtime and source hash.
2. Probe tampered token, unknown `kid`, wrong public key, wrong identity, noncanonical JSON, expired lifetime, stale evidence, revoked ID, fabricated independence and fake paid or Gold claims.
3. Review QRON evidence renderer for XSS, expired/rescinded state and truthful `self-issued` text.
4. Confirm no production signing key, payment setting, self-hosted secret-bearing runner, production deployment or badged endorsement was involved.
5. Return signed or publicly attributable reproducibility report and qualified security review before any release.

**Financial/prod boundaries:** Keep `humanHold=true`, `production_send=false`, and no pricing/checkout changes. Do not open PRs that could execute untrusted same-repository code on credential-bearing self-hosted runners before execution isolation is independently proven.
