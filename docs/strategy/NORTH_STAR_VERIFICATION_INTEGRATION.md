# North-Star Verification Integration

## Canonical trust boundary

The canonical verification authority is the Cloudflare Worker attestation API:

`POST /api/v1/attestation/verify`

The legacy `workers/authichain-api-gateway` demo API is explicitly outside the trust boundary. Its simulated verification responses must not be used as protocol evidence, DPP state, QRON authenticity state, vertical compliance state, or AgentZ authorization input.

## Decision vocabulary

All consumers use the shared `VerificationDecision` contract:

- `verified`
- `warning`
- `blocked`
- `revoked`
- `expired`
- `not_found`
- `risk`
- `indeterminate`

Only `verified` with `valid=true` may be treated as a positive protocol verification result. Registration, identifier resolution, or cryptographic signature validity alone does not produce `verified`.

## Consumer propagation

| Surface | Required source | Required behavior |
|---|---|---|
| DPP | canonical attestation verification | persist/display the shared decision, status, reasons and validity; never infer authenticity from registration |
| QRON | canonical attestation verification | QR scan resolves to an identifier, then consumes the same decision contract |
| StrainChain / regulated verticals | canonical attestation verification | bind product/lot/serial evidence to the same decision; regulatory workflow may add requirements but may not weaken the protocol decision |
| GovChain | canonical attestation verification | use the same decision as evidence input; procurement/compliance policy may add gates but may not convert uncertainty into verification |
| AgentZ / MCP | canonical attestation verification | treat `decision` as machine policy input; `blocked`, `revoked`, `expired`, `risk`, `not_found`, and `indeterminate` are non-positive and must not authorize irreversible actions |

## Machine contract

`packages/verifier/src/verification-decision-response.ts` defines the stable response projection and runtime validator. Consumers should use this shape rather than creating parallel vocabularies such as `authentic`, `suspicious`, `confirmed`, or `invalid`.

## Agent rule

An agent may observe and explain every decision. An agent may not silently upgrade a non-positive decision to `verified`. Any action that depends on physical-world authenticity must fail closed unless the canonical response is `decision=verified` and `overall_valid=true`.

For MCP integrations, authentication/authorization remains an independent boundary. Current MCP authorization guidance requires protected resources to validate bearer tokens and scopes; AuthiChain verification is evidence for an action policy, not a substitute for transport authorization.

## Migration rule

When an existing surface has a legacy decision vocabulary, map it into the shared contract at the boundary. Do not delete historical fields until the consumer migration and compatibility tests are green.
