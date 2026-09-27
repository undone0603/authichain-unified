# AuthiChain documentation

Verification infrastructure for the physical world. These pages explain how product identity, signed claims, evidence, and verification fit together — and where AuthiChain stops.

## Live reference

- [Open Verification Protocol](/protocol) — v0.1.0 draft
- [GS1 Digital Link](/docs/gs1-digital-link) — identifier syntax, not authenticity
- [Verification states](/docs/verification) — verdict vs decision vs seal lifecycle
- [DPP architecture](/docs/dpp-architecture) — identity, carrier, evidence, verification
- [Examples](/docs/examples) — JWKS + verifier.mjs + repo fixtures
- [x402 agent pay](/docs/x402) — $0.05 USDC on Base

## What is live

- JWKS: `https://authichain.com/.well-known/jwks.json` (Ed25519)
- Polygon certificate contract: `0x4da4D2675e52374639C9c954f4f653887A9972BE`
- Free tools: [/verify](/verify), [/dpp-check](/dpp-check), [/onboard](/onboard)

## What is not live

- `id.authichain.com` resolver (5xx)
- GS1 Conformant Resolver (explicitly false)
- Public AC-DEMO-001 scan QR
- AuthiChain as the EU DPP registry

Do not treat a QR as proof of authenticity.
