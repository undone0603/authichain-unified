# Economic Control Plane — Phase 11 Domain Baseline

## Status

This change establishes domain contracts and a pure pre-reservation policy decision. It does **not** connect economic execution to a Worker route.

The existing Agent Trust Phase 2 code verifies a signed agent message, issuer/attestation trust, lifecycle, capabilities, and replay. This phase defines what an authenticated agent may *propose* economically.

## Control flow

```
SignedAgentMessage<EconomicAction>
        |
        v
verifyAgentMessage(...)
        |
        v
authorizeEconomicAction(message, verification, policy)
        |
        +---- DENY ------------------> signed audit payload may be recorded
        |
        +---- ELIGIBLE_FOR_RESERVATION
                       |
                       v
             (NOT IMPLEMENTED HERE)
             atomic budget reservation
                       |
                       v
             (NOT IMPLEMENTED HERE)
             execution adapter
                       |
                       v
             (NOT IMPLEMENTED HERE)
             committed result + durable audit chain
```

The current function can return only `ELIGIBLE_FOR_RESERVATION` or `DENY`. Even an eligible proposal has `execution_permitted: false`. No transfer, deduction, mint, or budget reservation is performed.

## Contracts added

- `economic-action.ts`: strict runtime schema, stable identifiers, operation types, account bindings, exact decimal minor units, and explicit authorization/audit result shapes.
- `policy-engine.ts`: fail-closed checks for verifier result binding, exact signed-envelope digest, identity, operation-specific capabilities, organization and policy version, asset allowlist, action limit, evidence, timestamp/TTL, and operation/account consistency.
- `crypto-message.ts`: canonical action digest and ECDSA P-256 signed audit payloads. Verification receives an already trusted `CryptoKey`; key resolution and revocation are external.
- `adversarial-gate.test.ts`: signature fixture plus positive-path and negative-path tests for verification failure, post-verification mutation, unknown envelope fields, insufficient capabilities, amount and policy limits, evidence, timestamps, and audit tampering.

Economic capabilities are distinct:
- `PROPOSE_ECONOMIC_ACTION` is required for any economic proposal.
- `TRANSFER_VALUE`, `DEDUCT_VALUE`, or `MINT_VALUE` is additionally required for that exact operation.

Existing attestations do not acquire these new capabilities automatically; issuers must explicitly grant them.

## Trust and atomicity boundaries

1. A valid signature authenticates the bytes, not the economic legitimacy of the request.
2. Policy eligibility is not balance availability and is not a reservation.
3. The D1 nonce table prevents duplicate signed-message presentation, but does not reserve budget or make the economic side effect atomic.
4. The signed audit helper detects payload/signature tampering, but does not itself provide durable storage, an append-only log, key revocation, prior-record chaining, or a commit proof.
5. No HTTP route is added. The production `/verify` route and its response contract remain unchanged.
6. No D1 migration is applied. The current `schema/agent-trust.sql` is a schema artifact; it is not evidence of a deployed economic ledger.

## Next gates before any execution adapter

1. Persist policy versions and budget snapshots with tenant-scoped constraints.
2. Introduce one atomic D1 reservation keyed by idempotency key that binds the action digest, policy version, and budget row/version in the same transaction boundary or a serialized Durable Object.
3. Add reservation conflict, concurrent over-budget, retry, expiration, and recovery tests on the actual target runtime (not SQLite-only evidence).
4. Make execution consume a valid reservation token exactly once and record a deterministic result.
5. Sign and persist an append-only audit event for deny, reserve, execute, fail, and compensate outcomes; test recovery and duplicate delivery.
6. Add routes only after these invariants and migration/deployment plan pass review.

Until those gates exist, the control plane is a policy-evaluation library and testable domain model—not an economic execution system.
