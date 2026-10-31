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

# Agent rail. A non-UUID sealId is HTTP 400 before payment.
# An empty body is the unpaid HTTP 402 challenge, not a product verdict.
curl -sS -i -X POST https://authichain.com/api/x402 \
  -H 'content-type: application/json' \
  -d '{}'

# Living QR scan. This host verifies the signature.
# The object id form is qron:url: plus 8 hex characters.
# A missing id is HTTP 404 presentation_not_found.
# qron.space, strainchain.io, and govchain.us each proxy that GET.
# Each host does not verify the signature.
curl -sS -H 'accept: application/json' \
  "https://authichain.com/qron/r/{object_id}"

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

JWKS kid in production (RFC 7638 thumbprint, corrected 2026-10-17): `T3AL7c4wZVoXk1IXvpaaHGUmoZHZ3k1mTommJu9wToQ`.

## Published demonstration record

`polygon-anchor-1` is one Ed25519 signed record. It is a demonstration, not a customer product, and not a physical inspection. Physical binding was not inspected. It is not a battery passport.

```bash
curl -sS "https://authichain.com/api/verify?id=polygon-anchor-1"
```

- [JSON verdict](/api/verify?id=polygon-anchor-1). This is the check that reports whether the anchor transaction carries the record hash.
- [Human page](/verify?id=polygon-anchor-1). It shows the verdict. It does not itself read the anchor transaction.
- [Record JSON](/protocol/examples/polygon-anchor-1.record.json) and [anchor JSON](/protocol/examples/polygon-anchor-1.anchor.json).

The same files ship in the npm package as `examples/polygon-anchor-1.record.json` and `examples/polygon-anchor-1.anchor.json`.

## Published demonstration record

`polygon-anchor-1` is one Ed25519 signed record. It is a demonstration, not a customer product, and not a physical inspection. Physical binding was not inspected. It is not a battery passport.

```bash
curl -sS "https://authichain.com/api/verify?id=polygon-anchor-1"
```

- [JSON verdict](/api/verify?id=polygon-anchor-1). This is the check that reports whether the anchor transaction carries the record hash.
- [Human page](/verify?id=polygon-anchor-1). It shows the verdict. It does not itself read the anchor transaction.
- [Record JSON](/protocol/examples/polygon-anchor-1.record.json) and [anchor JSON](/protocol/examples/polygon-anchor-1.anchor.json).

The same files ship in the npm package as `examples/polygon-anchor-1.record.json` and `examples/polygon-anchor-1.anchor.json`.

## Repo fixtures

In `undone0603/authichain-unified`:

| File                                     | Purpose                                                |
| ---------------------------------------- | ------------------------------------------------------ |
| `fixtures/attestation-v0.1-valid.json`   | Canonical payload                                      |
| `fixtures/attestation-v0.1-valid.jws`    | Valid Ed25519 compact JWS                              |
| `fixtures/attestation-v0.1-tampered.jws` | Decision flipped, signature not recomputed — must fail |
| `fixtures/attestation-v0.1-jwks.json`    | Fixture public key only                                |

These fixtures contain no production secrets.

## What is not published here

The published demonstration record above is the one public example on this page. Other repository demo identifiers are not listed here. An unknown resolver id returns `status: "not_found"` with `reason: "unknown_seal"`. That is not a working product scan and is not a counterfeit finding.

Cite the well-known file, JWKS, protocol verifier, the published demonstration record, the empty-body unpaid x402 402, the Living QR scan, and the repo fixtures. Do not treat a resolver 404 as a live demo. A Living QR id with no stored presentation is HTTP 404 with `decision: "indeterminate"` and `error: "presentation_not_found"`. That is not a verdict and not a counterfeit finding.

## Human path

[/verify](/verify) — lookup. No GPT-4V on the free public demo.

## Related

- [Verification states](/docs/verification)
- [GS1 Digital Link](/docs/gs1-digital-link)
- [Open Verification Protocol](/protocol)
