---
title: GS1 Digital Link for Digital Product Passports
meta_title: GS1 Digital Link for Digital Product Passports | AuthiChain Docs
meta_description: How /01/{GTIN}/21/{serial} names a serialized physical product. What GS1 requires, what resolvers commonly do, what AuthiChain implements, and what we do not claim.
canonical: https://authichain.com/docs/gs1-digital-link
status: ship_wave1
money: false
jsonld: TechArticle, BreadcrumbList, FAQPage
---

# GS1 Digital Link is an identifier syntax, not a proof of authenticity

A QR that encodes `/01/{GTIN}/21/{serial}` names the item. Signed attestations and independent verification are what make the name trustworthy.

## What it is

GS1 Digital Link is a URI pattern that embeds GS1 application identifiers — most commonly GTIN (`01`) and serial (`21`) — in a resolvable HTTPS URL.

Example shape:

```
https://id.example.com/01/00012345678905/21/UNIT-9
```

The string is an identifier. Resolution is a separate behavior. Conformance as a GS1 Conformant Resolver is a third thing, with its own test suite.

## Why it matters

EU Digital Product Passport rules require a unique, resolvable product URL on a data carrier. GS1 Digital Link is the common implementation path for that requirement. It is not the only legal option, and encoding a Digital Link in a QR does not satisfy authenticity, due-diligence, or registry obligations by itself.

Manufacturers, importers, and developers search for “GS1 Digital Link resolver” because they need to know:

1. How to form the identifier.
2. What a resolver is supposed to return.
3. What a verifier should still check after the URL resolves.

## What the standard requires

Cite GS1. Do not treat this page as the standard.

- A Digital Link URI that can be resolved to product information.
- A **Conformant Resolver** additionally implements `linkType` (including `linkType=all`), a linkset (`application/linkset+json`), the HTTP `Link` header, and `307` redirects to the linked resource.
- A Resolver Description File at `/.well-known/gs1resolver` that validates against the published GS1 schema.

Primary references:

- [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link)
- [GS1 resolver standard](https://ref.gs1.org/standards/resolver/)
- [GS1 and the EU Digital Product Passport](https://gs1.eu/activities/digital-product-passport/)

## What the ecosystem commonly implements

Typical production shape:

```
QR → GS1 Digital Link URL → resolver → HTML product page or JSON
```

Many services that call themselves resolvers only parse `/01/{gtin}/21/{serial}` and render a page. That is identifier handling. It is not GS1 resolver conformance.

A second common shortcut: treat “the QR resolved” as “the product is authentic.” That collapses identity into attestation. They are different layers.

## What AuthiChain implements

Live and citeable today:

- The [open verification protocol](/protocol) uses GS1 Digital Link as the item-identity convention, alongside W3C Verifiable Credentials 2.0, CAIP-2 chain identifiers, and RFC 8785 canonicalization.

Present in the repo, **not** a live public demo:

- `workers/gs1-resolver` parses `/01/{gtin}/21/{serial}` and `/cert/{id}`.
- Content negotiation: browsers are intended to receive HTML; `Accept: application/json` is intended to receive a machine passport.
- Two GET kinds are not interchangeable:
  - A Digital Link path or `/cert/{id}` is a **scan**. It can record a scan row and advance seal state.
  - `GET /v1/passport/{id}` is a **read**. It must not be used by dashboards or previews, or those renders will be counted as scans.
- Seal lifecycle in that worker: `issued → active → clone_suspected → cloned`.
- Intended public origin: `id.authichain.com`. On 2026-09-27 that host returned HTTP 522. Do not publish a scan QR against it until `GET https://id.authichain.com/health` returns 200.

## What AuthiChain does not claim

- AuthiChain is **not** a GS1 Conformant Resolver. The worker declaration is `gs1ConformantResolver: false`. It does not implement `linkType`, linkset, `Link` headers, or 307 redirects.
- A valid Digital Link QR does not prove the physical item is authentic.
- AuthiChain does not define GS1, ESPR, EN 18219, or EN 18220.
- AuthiChain does not operate the EU DPP registry.
- `AC-DEMO-001` is a repository fixture. It is not a live public scan target while the resolver host is down.

## How a developer verifies

```bash
# 1. Offline protocol verifier (no AuthiChain network call)
node verifier.mjs record.json anchor.json

# 2. Published verification key
curl -sS https://authichain.com/.well-known/jwks.json

# 3. Do not call the GS1 host as live until this is 200
curl -sS -i https://id.authichain.com/health
```

See [examples](/docs/examples) for fixture files and [verification states](/docs/verification) for what a verdict means.

## Failure cases

| Observation | What it means | What it does not mean |
|---|---|---|
| Path parses, no record | `not_found` (trust kernel) or HTTP 404 | The product is counterfeit |
| Signature valid, no anchor | protocol `valid-unanchored` | The claim is true |
| Multi-region scan burst | `clone_suspected` / `cloned` in the repo state machine | Automatic counterfeit conviction |
| Dashboard preview used the scan GET | False scan graph | A real physical clone |
| Resolver host 5xx | The service is down | The identifier is invalid |

## Security considerations

- Geo on the repo worker is Cloudflare country plus optional colo, not GPS.
- A copied QR is detected by scan graph, not by chemistry of the ink.
- Signature validity proves issuer control of a key and integrity of a payload. It does not prove physical-digital binding.
- Publishing a 5xx demo URL teaches crawlers and agents a dead artifact. Do not do it.

## Regulatory context

ESPR (Regulation (EU) 2024/1781) requires a machine-readable product passport for designated product groups. A resolvable unique identifier on a data carrier is part of that design. GS1 Digital Link is how many operators will implement the carrier. Registry filing, economic-operator obligations, and sector data requirements sit outside this page and outside AuthiChain’s current public scope. See [DPP architecture](/docs/dpp-architecture).

## Implementation guidance

1. Form identifiers with GTIN + serial (or lot) before designing artwork.
2. Point the QR at a host you actually operate and monitor.
3. Separate scan GETs from read GETs so your own website does not trip clone detection.
4. Verify signatures against a published JWKS, not against “the page loaded.”
5. Treat clone / anomaly states as tickets, not marketing copy.

## Related

- [Verification states](/docs/verification)
- [DPP architecture](/docs/dpp-architecture)
- [Open Verification Protocol](/protocol)
- [Examples](/docs/examples)
- [Free DPP readiness check](/dpp-check?utm_source=docs&utm_medium=authority&utm_campaign=gs1-digital-link)

## FAQ

**Is GS1 Digital Link mandatory for an EU Digital Product Passport?**
No. A resolvable unique URL is required. GS1 Digital Link is the common implementation, not the only one.

**Does a GS1 QR prove authenticity?**
No. It names the item. Authenticity is a later verification question.

**Is AuthiChain a GS1 Conformant Resolver?**
No. `gs1ConformantResolver` is false. The repo worker parses Digital Link paths and answers a verification question. It does not implement linkset / `linkType` / 307 behavior.
