---
title: Digital Product Passport architecture
meta_title: Digital Product Passport Architecture | AuthiChain Docs
meta_description: Identity, data carrier, resolver, signed evidence, verification, and policy. What ESPR requires, what AuthiChain implements today, and what remains outside scope.
canonical: https://authichain.com/docs/dpp-architecture
aliases:
  - /docs/dpp
  - /docs/digital-product-passports
status: ship_wave1
money: dpp_readiness_299
jsonld: TechArticle, BreadcrumbList, FAQPage, Organization
---

# A Digital Product Passport is a machine-verifiable product record, not a PDF behind a QR

Identity names the item. The carrier gets a scanner to a resolver. Attestations bind claims. Evidence is what was observed. Verification is an independent check. Policy is who may see which field.

## What it is

A Digital Product Passport (DPP) is a structured, machine-readable record of a product’s identity and the claims attached to it — materials, origin, repair, carbon, conformity — reachable from a data carrier.

If only a person can read it, purchasing agents and border systems cannot use it. The record has to survive an HTTP client that never loads your marketing page.

## Why it matters

ESPR (Regulation (EU) 2024/1781) phases DPPs in by product group. Batteries are first under Regulation (EU) 2023/1542. Importers, manufacturers, and authorized representatives need a place that answers implementation questions without pretending to be the Commission.

AuthiChain’s job on this page is narrower than “EU DPP software”:

```
identity → carrier → resolver → passport → evidence → verification → policy
```

## What the regulation requires (cite, do not impersonate)

Confirm against the legal texts. This is orientation, not advice.

| Instrument | What it is |
|---|---|
| Regulation (EU) 2024/1781 (ESPR) | Ecodesign framework. DPPs for designated product groups. |
| Regulation (EU) 2023/1542 | Batteries. Certain industrial, EV, and LMT batteries need a passport from 18 February 2027. |
| Implementing Regulation (EU) 2026/1778 | DPP registry rules, adopted 16 July 2026. |
| Commission working plan / delegated acts | Which product groups and which data fields, on which date. |

A resolvable unique product identifier on a data carrier is part of the design. GS1 Digital Link is the common implementation of that identifier. It is not the only one. See [GS1 Digital Link](/docs/gs1-digital-link).

The economic operator — not AuthiChain — registers in the EU DPP registry.

## What the ecosystem commonly implements

1. A QR on pack.
2. A web page that looks like a passport.
3. A PDF of a declaration of conformity.
4. A vendor dashboard.

That stack can satisfy a human. It fails an agent, a customs integration, and any later dispute about who asserted what, when, with which key.

## What AuthiChain implements today

Live and citeable:

- Polygon certificate contract [`0x4da4D2675e52374639C9c954f4f653887A9972BE`](https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE).
- Open verification protocol at [/protocol](/protocol) (v0.1.0 draft).
- Free readiness tool at [/dpp-check](/dpp-check).
- Battery gap map at [/battery-passport](/battery-passport).
- Agent verification at [/x402](/x402) — $0.05 USDC per call on Base. Unpaid `POST /api/x402` returns HTTP 402.
- Human commercial path: EU DPP Readiness, $299 one-time.

EU DPP Readiness opens an AuthiChain workspace, with self-serve activation and 50 generations to publish a first passport. Checkout is on [/pricing](/pricing).

## What is in development

- Per-product passport fields carried as an ERC-721 payload.
- A public certificate registry anyone can query by ID.
- A public scan ledger on a resolver host. Intended origin `id.authichain.com` returned HTTP 522 on 2026-09-27.

Do not treat those as shipped.

## What AuthiChain does not claim

- AuthiChain does not operate the EU DPP registry.
- AuthiChain is not a notified body.
- This page is not legal advice.
- A certificate NFT is not, by itself, an official EU Digital Product Passport.
- AuthiChain does not register the economic operator.
- AuthiChain is not a GS1 Conformant Resolver.
- Sector pages that only restate a regulation are not an implementation.

## Architecture

```
physical item
  → data carrier (QR / NFC / Data Matrix)
  → resolvable URL (often GS1 Digital Link /01/{gtin}/21/{serial})
  → resolver (HTML for humans, JSON for machines)
  → product passport
  → signed attestations + evidence
  → independent verification (protocol + JWKS + optional chain anchor)
  → policy (who may see which field)
```

Worked request that is live today (agent rail, not a DPP registry call):

```bash
curl -sS -i -X POST https://authichain.com/api/x402 \
  -H 'content-type: application/json' \
  -d '{"sealId":"demo"}'
```

Expect HTTP 402 and a payment requirement. That is how a machine starts a verification. It is not a registry filing.

Human path that is live today:

1. [/dpp-check](/dpp-check?utm_source=docs&utm_medium=authority&utm_campaign=dpp-architecture) — score the gaps.
2. [/checkout/dpp_readiness](/checkout/dpp_readiness?utm_source=docs&utm_medium=authority&utm_campaign=dpp-architecture) — $299 if you want the workspace and 50 generations.
3. [/onboard](/onboard?utm_source=docs&utm_medium=authority&utm_campaign=dpp-architecture) — pilot seal, work email, no call.

## Implementation guidance

1. Inventory the product group and the date it is designated. Batteries are not textiles.
2. Decide the identifier before the artwork. GTIN + serial (or lot).
3. Put a URL you actually operate on the carrier.
4. Sign claims. Publish the verification key.
5. Keep scan endpoints and read endpoints apart.
6. Do not tell a scanner that a loaded webpage equals authenticity.
7. File the registry record as the economic operator. AuthiChain can hold signed records you may use. It cannot file for you.

## Failure cases

| Shortcut | Failure |
|---|---|
| PDF behind a QR | Agents and border systems cannot query it |
| QR present, no signature | Anyone can reprint the carrier |
| Signature, no published JWKS | Third parties cannot verify offline |
| “Certificate NFT = official DPP” | False capability |
| Thin sector landing with no fixture | Crawl budget spent, no citation |

## Security considerations

- Public keys only in JWKS. Never paste issuance secrets into docs.
- Multi-tenant queries stay tenant-scoped.
- Free public demo is lookup-only. GPT-4V is metered.
- Cannabis, medical, and government claims need licensed review. This page is not that review.

## Related

- [GS1 Digital Link](/docs/gs1-digital-link)
- [Verification states](/docs/verification)
- [Open Verification Protocol](/protocol)
- [x402](/x402)
- [Existing commercial DPP page](/digital-product-passport) — marketing + timeline; this page is the architecture reference
- [What is a Digital Product Passport?](/what-is-a-digital-product-passport)

## FAQ

**Does AuthiChain register my product in the EU DPP registry?**
No. The economic operator registers. AuthiChain can hold signed records the operator may use.

**When is a battery passport mandatory?**
Certain batteries from 18 February 2027 under Regulation (EU) 2023/1542. Confirm against the regulation and any later amendment.

**Is a QR enough?**
No. A QR is a carrier. The passport is the record behind it, plus the ability to verify who signed which claim.

**Is the $299 an official certification?**
No. It opens an AuthiChain workspace with self-serve activation and 50 workspace generations. Not legal advice. Not a notified-body certification. Not an EU registry filing.
