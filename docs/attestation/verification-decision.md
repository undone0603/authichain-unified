# AuthiChain Verification Decision Contract

This is the North-Star MVP-0 decision vocabulary for human, API, and agent consumers.

| Decision | `valid` | Meaning |
|---|---:|---|
| `verified` | `true` | Signature is valid, issuer is currently trusted, claim is active, unexpired, and issuer decision is `verified`. |
| `warning` | `false` | Signature/lifecycle may be valid, but the issuer explicitly published a warning decision. |
| `blocked` | `false` | Signature/lifecycle may be valid, but the issuer explicitly blocked the claim. |
| `revoked` | `false` | A durable lifecycle event revoked the previously issued claim. |
| `expired` | `false` | The claim is past its expiry or has an explicit durable expired status. |
| `not_found` | `false` | The requested identifier or attestation could not be found. This is **not** a counterfeit verdict. |
| `risk` | `false` | The claim may be cryptographically valid, but physical-world or lifecycle signals make it unsafe to treat as verified. |
| `indeterminate` | `false` | Verification cannot establish trust because cryptographic verification, issuer trust, or required lifecycle state is unavailable/invalid. |

## Trust rule

Only `verified` with `valid=true` is a positive verification result. Registration, resolution, a valid signature, or a matching identifier alone is insufficient.

## Ordering

The decision resolver evaluates in this order:

1. object/attestation existence;
2. cryptographic validity;
3. current issuer trust;
4. durable lifecycle status;
5. expiry;
6. physical-world risk signals;
7. signed issuer decision;
8. `verified`.

This ordering is deliberately conservative. A verifier must never convert missing evidence or infrastructure uncertainty into a positive authenticity claim.

## Implementation

The shared pure decision function is `packages/verifier/src/verification-decision.ts`. It has unit coverage in `packages/verifier/src/verification-decision.test.ts`.

The existing attestation API remains backward compatible: its HTTP contract continues to expose cryptographic status, claim status, issuer status, reasons, and `valid`. Consumers can adopt the normalized decision vocabulary incrementally.
