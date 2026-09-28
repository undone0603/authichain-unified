---
title: Product verification states
meta_title: Product Verification States | AuthiChain Docs
meta_description: Protocol verdicts versus product decisions. An anomalous scan is evidence for investigation, not automatic proof that a physical product is counterfeit.
canonical: https://authichain.com/docs/verification
status: ship_wave1
money: x402
jsonld: TechArticle, BreadcrumbList, FAQPage, SoftwareApplication
---

# A verifier returns a verdict. A product record has a status. Do not collapse them.

The open protocol tells you whether a signed record is well-formed and anchored. Higher layers interpret scan graphs, expiry, and revocation. Neither layer certifies that a physical object is genuine by QR presence alone.

## What it is

Verification is an independent check of a claim.

AuthiChain splits that check into layers so a web page, an agent, and a human investigator do not have to pretend they are looking at the same object.

```
Claim
  → canonical payload
  → Ed25519 signature
  → published JWKS
  → protocol verdict
  → product decision / status
```

## Why it matters

Most “verified authentic” badges resolve to a vendor server saying *trust me*. That relocates the trust problem.

A usable reference has to answer four different questions:

1. Was this payload signed by the key that claims to have signed it?
2. Does the hash match what was anchored on-chain?
3. Is the attestation still active, or has it expired / been revoked?
4. Does the scan graph look like one physical item, or like a copied carrier?

Those are not the same question. Mixing them produces false confidence and false accusations.

## Protocol verdicts (live)

Published at [/protocol](/protocol). Reference verifier: `verifier.mjs` (Node builtins only, Apache-2.0, v0.1.0 draft).

| Verdict | Meaning |
|---|---|
| `verified` | Signature valid; anchor present, well formed, mainnet; hash matches |
| `valid-unanchored` | Signature valid; no anchor supplied |
| `invalid` | Any required check failed |

There is no score in this layer. A score is a product feature. A verdict is what a verifier owes you.

Two rules the protocol is built on:

1. A signature proves who asserted something, not that it is true.
2. v0.1 has no revocation list. A record signed by a compromised key stays cryptographically valid.

## Trust kernel decisions (live in code)

`workers/authichain-verify-worker/src/evaluate.ts` — `TrustDecision`:

```
verified | anomaly | blocked | expired | invalid | not_found
```

Check-vector states:

```
verified | failed | partial | clear | unknown | not_supplied | anomalous
```

Anomalous scan reasons in that worker include `impossible_travel` and `cloned_identity_pattern`. Those flags are investigation evidence. They are not a finding that the physical product is counterfeit.

`REVIEW` is **not** a kernel state. Do not publish it.

## Attestation v0.1 (repo contract)

Documented in `docs/attestation/v0.1.md`.

| Axis | Values |
|---|---|
| Decision | `verified` \| `warning` \| `blocked` |
| Status | `active` \| `revoked` \| `unknown` |

Representation: compact JWS, protected header `typ=AC-ATTESTATION+JWS`, algorithm Ed25519 / EdDSA. Verify against the public JWKS.

```
GET https://authichain.com/.well-known/jwks.json
```

kid `lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE`, `kty=OKP`, `crv=Ed25519`, `alg=EdDSA`.

v0.1 has no live status list. The status in the signed payload is the status at issuance.

Interoperability rules from that contract:

1. `object_id` is provider-scoped. It is not globally unique without the issuer.
2. `gtin` names a class. `serial` names an item. `lot` names a production lot.
3. A copied QR is not proven authentic by a valid signature alone.
4. `warning` and `blocked` are explicit trust decisions, not signature failures.
5. A valid signature proves integrity and issuer control of the key. It does not prove the physical item matches the subject.

## GS1 seal lifecycle (repo worker only)

`workers/gs1-resolver`, intended host `id.authichain.com`. That host returned HTTP 522 on 2026-09-27. Do not treat the following as a live public API until health is 200:

```
issued → active → clone_suspected → cloned
```

First scan moves `issued → active`. Multi-region bursts move `active → clone_suspected → cloned`. Geo is Cloudflare country plus optional colo, not GPS.

## What AuthiChain does not claim

- Protocol `verified` does not mean the physical product is authentic. A false statement from a valid key still verifies.
- `anomaly` / `clone_suspected` is not a counterfeit conviction.
- AuthiChain does not publish a `REVIEW` state.
- Unpaid `POST /api/x402` returning 402 is a payment challenge, not a product verdict.

## How a developer verifies

```bash
# Offline, no network call to AuthiChain
node verifier.mjs record.json anchor.json

# Published key
curl -sS https://authichain.com/.well-known/jwks.json

# Agent rail — unpaid challenge. Expect HTTP 402.
curl -sS -i -X POST https://authichain.com/api/x402 \
  -H 'content-type: application/json' \
  -d '{"sealId":"demo"}'
```

Human lookup: [/verify](/verify).
Agent pay rail: [/x402](/x402?utm_source=docs&utm_medium=authority&utm_campaign=verification) — $0.05 USDC on Base. Do not send private keys.

Negative fixtures live in the repo:

- `fixtures/attestation-v0.1-valid.json`
- `fixtures/attestation-v0.1-valid.jws`
- `fixtures/attestation-v0.1-tampered.jws` (must fail)
- `fixtures/attestation-v0.1-jwks.json`

See [examples](/docs/examples).

## Failure cases

| Input | Expected |
|---|---|
| Tampered payload, original signature | protocol `invalid` / HTTP 400 on attestation verify |
| Expired `expires_at` | trust `expired` or attestation `valid=false` with status `expired` |
| Revoked status in payload | `valid=false`, cryptographically inspectable |
| Unknown object | `not_found` |
| Scan graph burst | `anomaly` (kernel) or `clone_suspected` (resolver, when live) |

## Security considerations

- Verify against the published JWKS, not against HTML.
- Do not collapse cryptographic validity into physical authenticity.
- Do not put GPT-4V on the free public demo. Vision is metered.
- x402 settlement happens in the agent wallet. AuthiChain never receives a private key.

## Regulatory context

Customs officers, market-surveillance authorities, and importers will eventually query passports at the border. A precise verdict vocabulary is the difference between a usable system and a liability. AuthiChain’s public language matches the code. It does not impersonate an official EU verification service.

## Related

- [GS1 Digital Link](/docs/gs1-digital-link)
- [DPP architecture](/docs/dpp-architecture)
- [Open Verification Protocol](/protocol)
- [x402 agent pay](/x402)
- [Examples](/docs/examples)

## FAQ

**If the verdict is `verified`, is the product authentic?**
The statement was signed by that key and the hash matches the anchor. A false statement from a valid key still verifies.

**What does `clone_suspected` mean?**
A scan-graph anomaly (repo resolver). Investigate. Do not treat it as a counterfeit conviction.

**Can an agent verify without an API key?**
Yes. `POST https://authichain.com/api/x402` without payment returns HTTP 402 with the Base USDC requirement. Health: `GET /api/x402/health`.
