# AuthiChain High-Value Asset Passport

This reference module extends the AuthiChain trust kernel to physical assets where identity, evidence, inspection and lifecycle state must remain distinct.

It is intentionally asset-class neutral. Precious metals are the first fixture because a sealed assay package provides a compact example of:

- individual identity (serial/certificate identifier);
- product identity (metal, weight and fineness);
- issuer claims;
- evidence objects;
- physical inspection observations; and
- independent verification.

## Trust boundary

A valid signature proves integrity and issuer control of a claim. It does not independently prove that the physical object in front of a verifier matches the attested object.

The passport therefore separates:

1. Identity — what object is being addressed.
2. Claims — what an issuer says about it.
3. Evidence — what documents, measurements or observations support a claim.
4. Inspection — what a person or instrument observed.
5. Lifecycle — custody, status, revocation and supersession.
6. Verification — the evidence-backed result returned to a consumer.

A passport may be verified even when physical inspection has not occurred. That state must remain explicit.

## Identity rules

The module supports:

- GS1-style gtin + serial when available;
- issuer_namespace + serial for non-GS1 assets;
- certificate identifiers for legacy or issuer-native records; and
- composite identity for a product plus its container/package.

A GTIN identifies a product class. A serial identifies an individual instance. Do not manufacture a GTIN when one is not present.

## Precious-metal fixture

examples/precious-metals/valcambi-2.5g.json is a synthetic protocol fixture based on the product format visible in the pilot photographs. It deliberately does not assert that the photographed item is authentic and does not contain a private person's ownership information.

The fixture records the visible product claims as issuer-asserted data:

- asset class: precious metal bar;
- metal: platinum;
- fineness: 999.5;
- nominal weight: 2.5 g;
- packaging: sealed assay;
- serial/certificate identifier: redacted placeholder.

Replace placeholders only after an authorized inspection or issuer lookup.

## Verification states

The module uses independent dimensions instead of an overloaded "authentic" badge:

| Dimension | Examples |
|---|---|
| identifier | matched / mismatch / unavailable |
| issuer | trusted / untrusted / unknown |
| claim signature | valid / invalid |
| evidence | intact / altered / unavailable |
| physical inspection | passed / anomaly / not performed |
| lifecycle | active / revoked / superseded / unknown |
| custody | continuous / incomplete / undisclosed |

The final AuthiChain decision remains scoped to the policy and evidence actually evaluated.
