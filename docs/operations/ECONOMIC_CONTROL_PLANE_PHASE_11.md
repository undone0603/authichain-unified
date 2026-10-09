# Economic Control Plane — Phase 11 Domain Contracts

## Status

**Domain contracts and pure policy evaluation added; distributed control plane is not connected.**

This phase establishes what an autonomous agent may request and what evidence a policy decision must consider. It intentionally does not execute economic actions, write a live budget, or claim atomic reservation is implemented.

## Added modules

- `workers/authichain-verify-worker/src/economic-action.ts`
  - Strict runtime parser for `TRANSFER`, `DEDUCT`, and `MINT` proposals.
  - Exact field allowlist; unknown fields reject rather than disappear from signature input.
  - Positive safe-integer amounts in an asset's smallest indivisible unit (no floating-point money).
  - Canonical UTC timestamps, expiry ordering, per-action account-shape constraints, unique bounded evidence references.
  - `AuthorizationDecision` explicitly models `DENY` or `RESERVATION_REQUIRED`, and always carries `execution_status: NOT_EXECUTED`.

- `workers/authichain-verify-worker/src/crypto-message.ts`
  - Domain-separated signed control-plane envelope.
  - Strict parsing of envelope and action, identity/policy binding, canonical signing bytes, bounded message lifetime, expiry/future-date checks, and ECDSA P-256 verification.
  - The caller must supply a public key resolved through the trusted Agent Trust issuer/attestation path; this module does not itself establish that trust.

- `workers/authichain-verify-worker/src/policy-engine.ts`
  - Pure, fail-closed authorization evaluation.
  - Checks message verification, active/revocation state, identity/organization/attestation binding, proposal capability, policy version, action and asset allowlists, per-action amount limit, expiry, budget scope and available balance including reservations, evidence verification and organization binding, and idempotency lookup state.
  - A passing result is **only a request to reserve**, with an expected budget revision. It does not reserve or commit funds.

- `workers/authichain-verify-worker/src/adversarial-gate.test.ts`
  - Adversarial coverage for malformed fields and amounts, signatures, expiry, identity binding, capabilities, revocation, policy constraints, evidence, budget boundaries, idempotency conflicts, and the no-execution-before-reservation invariant.

The Agent Trust capability list now includes `PROPOSE_TRANSFER`, `PROPOSE_DEDUCT`, and `PROPOSE_MINT`. These are proposal permissions only; they do not grant execution privileges.

## Control flow contract

```
Untrusted input
  -> strict economic-action parse
  -> trusted Agent Trust identity / issuer resolution
  -> signed control-plane message verification
  -> policy-engine evaluation
  -> ATOMIC RESERVATION (not implemented in this phase)
  -> execution adapter (not implemented in this phase)
  -> atomic commit / release (not implemented in this phase)
  -> durable, signed audit record (not implemented in this phase)
```

No handler should infer that `RESERVATION_REQUIRED` means `ALLOW`. The reservation operation must claim the idempotency key and reserve budget atomically before any external effect.

## Remaining blocking work

1. **Atomic reservation store:** Implement a durable budget/reservation schema and transaction boundary. The mutation must verify the expected budget revision, enforce `committed + reserved + requested <= limit`, and atomically claim a unique idempotency key. Concurrent competing requests must yield at most one reservation.
2. **Reservation lifecycle:** Add persisted states and unique action/idempotency bindings. Define safe handling of same-action retries, conflicting key reuse, expiry, release, commit, and ambiguous downstream outcomes.
3. **Execution isolation:** Only a persisted reservation may be passed to a narrowly-scoped adapter. No arbitrary tool, workflow, or HTTP endpoint should execute `TRANSFER`, `DEDUCT`, or `MINT` by bypassing the control path.
4. **Audit atomicity:** Persist the authorization/reservation decision and append-only audit/outbox event as part of the same transaction where feasible. Sign the final event with a separately controlled audit identity; do not log secrets or raw sensitive payloads.
5. **Real concurrency evidence:** Run competing requests against the selected target runtime (Durable Object storage transaction or deployed/test D1, depending on the chosen design). The current Node SQLite nonce test is not evidence of economic budget reservation atomicity.
6. **Route integration:** Add a single authenticated proposal endpoint that runs the complete identity → signature → policy → atomic reservation flow. Keep execution disabled until all preceding gates and adversarial tests pass.

## Explicit non-claims

- No economic route is exposed by this phase.
- No production D1 migration has been applied.
- No transfer, deduction, mint, or external execution is performed.
- No atomic budget reservation or commit is implemented yet.
- Pure policy tests do not demonstrate concurrency safety; that claim requires integration tests at the actual reservation layer.
