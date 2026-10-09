---
title: AuthiChain documentation
meta_title: AuthiChain Docs — verification infrastructure for the physical world
meta_description: How product identity, signed claims, evidence, and verification fit together. What AuthiChain implements today, and where it stops.
canonical: https://authichain.com/docs
status: ship_wave1
jsonld: TechArticle, BreadcrumbList, Organization
---

# AuthiChain documentation

Verification infrastructure for the physical world.

These pages explain how product identity, signed claims, evidence, and verification fit together — and where AuthiChain stops.

A QR names an item. A signature binds a claim to a key. An anchor binds a hash to a chain. None of those, alone, proves a physical object is genuine. The documentation exists so developers, manufacturers, regulators, and agents can see the difference.

## Start here

- [GS1 Digital Link](/docs/gs1-digital-link) — identifier syntax, not a proof of authenticity.
- [Verification states](/docs/verification) — protocol verdicts vs product decisions. An anomaly is evidence, not a conviction.
- [Digital Product Passport architecture](/docs/dpp-architecture) — identity, carrier, resolver, evidence, verification, policy.
- [Battery passport example](/battery-passport) — e-bike and other LMT batteries. A passport is required from 18 February 2027.
- [Examples and fixtures](/docs/examples) — signed records you can check against the published JWKS.
- [Open Verification Protocol](/protocol) — run `verifier.mjs` on your own machine. v0.1.0 draft.
- [x402 agent pay](/x402) — $0.05 USDC per verification call on Base.

## What is live

Cite these. Do not infer the rest.

| Surface | What it is |
|---|---|
| [JWKS](https://authichain.com/.well-known/jwks.json) | Ed25519 public key, kid `lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE` |
| [/protocol](/protocol) | Open verifier. Verdicts: `verified`, `valid-unanchored`, `invalid` |
| [/x402](/x402) | Agent micropayments. Unpaid `POST /api/x402` returns HTTP 402 |
| [/dpp-check](/dpp-check?utm_source=docs&utm_medium=authority&utm_campaign=docs-hub) | Free EU DPP readiness check |
| [/battery-passport](/battery-passport) | E-bike / LMT gap map. Battery passport from 18 February 2027. |
| [/anchor](/anchor) | Public product-anchor UI |
| [/openapi.json](https://authichain.com/openapi.json) | Machine description of public HTTP |

## What AuthiChain does not claim

- It does not operate the EU DPP registry.
- It is not a GS1 Conformant Resolver.
- It is not a notified body and this is not legal advice.
- A valid signature does not independently prove the physical item matches the attested subject.
- An anomalous or clone-suspected scan pattern is investigation evidence, not automatic proof of a counterfeit.

## Do something

- [Verify a record](/verify)
- [Map DPP gaps](/dpp-check?utm_source=docs&utm_medium=authority&utm_campaign=docs-hub) — free
- [Onboard a pilot](/onboard?utm_source=docs&utm_medium=authority&utm_campaign=docs-hub) — work email, no call
