# Open independent verification challenge (no payment, no signing keys)

**Scope:** an independent maintainer can validate the **draft native AuthiChain Evidence Credential v0.1** without buying anything, trusting a webpage, handling private credentials or executing production code. This is **not** SealKeeper v9 conformance and **not** a request for endorsement.

## Reproduction steps

1. Check out the GitHub commit pinned in the review request. Use Node 22; no npm install, Stripe, Cloudflare credentials or root secrets.
2. Run `node --test protocol/evidence-seal.test.mjs scripts/evidence-seal-demo-server.test.mjs`; record all results and test exact HEAD SHA.
3. Run `node protocol/evidence-seal-cli.mjs demo /tmp/aec-peer`, then `node protocol/evidence-seal-cli.mjs verify /tmp/aec-peer/test-only.jws /tmp/aec-peer/test-only-jwks.json https://issuer.example https://service.example/mcp 1794000001` — should pass only at pinned historical time.
4. Change a JWS byte, the expected subject or issuer, remove its public `kid`, alter the public key, pass an expired time, and insert the demo ID into `revokedIds`; all must fail.
5. Read `test-only-observation.json`, hash it with the CLI and compare with the JWS `evidence.sha256`; check it says **TEST FIXTURE** and does not claim a real HTTP call or real product.
6. Run local preview: `node scripts/evidence-seal-demo-server.mjs`. Inspect `/evidence/demo`, `/evidence/demo/badge.svg`, `/.well-known/seal.json`, `/evidence/demo.json`; POST any route and expect HTTP 405. Confirm no raw private key or approval/paid button is rendered.
7. Inspect all claims of independence and note any false positives. A cryptographically valid JWS must still say `evidence_verification:not_performed` and `issuer_relationship:self`.

## Challenge questions

- Can you make the verifier return `valid=true` after tampering, expiry, revocation, wrong issuer, wrong subject, or key substitution?
- Can a hidden JSON field assert `level:gold`, or a paid receipt claim be inserted without rejection?
- Does the presentation leak HTML or mislead a customer that a physical item is authentic?
- Can the preview accept any write/paid request? Does an unsupported external signer accidentally acquire authorization?
- What would need to change before the schema could represent independently verified transaction and product evidence?

## Required independently checkable report

Pin the exact Git commit, Node version, test command, UTC timestamp, pass/fail logs, unsigned evidence SHA-256, public key `kid` and hash, failure reproduction and reviewer identity. Include a note that the fixture uses a publicly known test signing seed and DOES NOT authenticate AuthiChain's production issuer or any customer. An issue or PR review that merely says 'looks good' is not a successful independent reproduction.

**No live payments, no access to private repositories, no invitation for API keys and no other company's endorsement implied.**
