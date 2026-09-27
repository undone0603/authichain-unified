# GS1 Digital Link is an identifier syntax, not a proof of authenticity

A QR that encodes `/01/{GTIN}/21/{serial}` names the item. Signed attestations and independent verification are what make the name trustworthy.

## What AuthiChain implements

- Protocol identity uses GS1 Digital Link as the item identifier. See [/protocol](/protocol).
- Repo worker `workers/gs1-resolver` parses `/01/{gtin}/21/{serial}` and `/cert/{id}`.
- Scan GETs record a scan. `GET /v1/passport/{id}` is read-only.

## What AuthiChain does not claim

- Not a GS1 Conformant Resolver (`gs1ConformantResolver` is false).
- A valid Digital Link QR does not prove authenticity.
- `id.authichain.com` and `AC-DEMO-001` are not live while that host returns 5xx.

CTA: [Examples](/docs/examples) · [Protocol](/protocol) · [DPP check](/dpp-check)
No price on this page.
