---
title: Examples and fixtures
meta_title: Verification examples and fixtures | AuthiChain Docs
meta_description: Signed attestation fixtures and the live endpoints you can use to verify them. Unknown resolver identifiers return JSON 404 not_found.
canonical: https://authichain.com/docs/examples
status: ship_wave1
money: false
---

# Examples you can verify yourself

A marketing claim is not an artifact. These are.

## Live endpoints

```bash
# Protocol page + offline verifier
# https://authichain.com/protocol
node verifier.mjs record.json anchor.json

# Agent rail — unpaid. Expect HTTP 402, not a product verdict.
curl -sS -i -X POST https://authichain.com/api/x402 \
  -H 'content-type: application/json' \
  -d '{"sealId":"demo"}'

# Health of the agent rail
curl -sS https://authichain.com/api/x402/health

# Resolver is routed. Description file is live and honest.
curl -sS https://id.authichain.com/health
curl -sS https://id.authichain.com/.well-known/gs1resolver
# Expect gs1ConformantResolver: false

# Unknown identifier. Expect HTTP 404 JSON status not_found.
# Absence is not proof of counterfeit.
curl -sS -i -H 'Accept: application/json' \
  https://id.authichain.com/v1/passport/UNKNOWN-ID
```

JWKS kid in production on 2026-09-27: `lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE`.

## Repo fixtures

In `undone0603/authichain-unified`:

| File | Purpose |
|---|---|
| `fixtures/attestation-v0.1-valid.json` | Canonical payload |
| `fixtures/attestation-v0.1-valid.jws` | Valid Ed25519 compact JWS |
| `fixtures/attestation-v0.1-tampered.jws` | Decision flipped, signature not recomputed — must fail |
| `fixtures/attestation-v0.1-jwks.json` | Fixture public key only |

These fixtures contain no production secrets.

## What is not published here

Repository demo identifiers are not listed on this page. An unknown resolver id returns `status: "not_found"` with `reason: "unknown_seal"`. That is not a working product scan and is not a counterfeit finding.

Cite the well-known file, JWKS, protocol verifier, unpaid x402 402, and the repo fixtures. Do not treat a 404 as a live demo.

## Human path

[/verify](/verify) — lookup. No GPT-4V on the free public demo.

## Related

- [Verification states](/docs/verification)
- [GS1 Digital Link](/docs/gs1-digital-link)
- [Open Verification Protocol](/protocol)
