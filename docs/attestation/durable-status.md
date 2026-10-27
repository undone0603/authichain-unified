# Durable Attestation Trust and Revocation

AuthiChain now separates three durable states:

- Cryptographic status — whether the JWS signature verifies.
- Claim status — active, revoked, expired, or superseded.
- Issuer status — trusted, suspended, or retired.

## Storage

The production Supabase migration attestation_trust_registry_and_status creates:
- public.attestation_issuers — issuer trust registry.
- public.attestation_status_events — append-only lifecycle ledger.
- public.attestation_current_status — current effective claim status.

Both tables have RLS enabled and no anon/authenticated table grants. The Worker accesses them only with a server-side privileged Supabase credential. The status view uses security_invoker=true.

Status events cannot be updated or deleted: a database trigger rejects both operations. New lifecycle facts are appended instead.

The initial registry entry is AuthiChain itself: issuer https://authichain.com, JWKS https://authichain.com/protocol/jwks.json, status trusted.

## API

GET /api/v1/attestations/:id/status returns the current effective durable claim status. An attestation with no durable status event is treated as active by the read contract; this does not bypass cryptographic verification.

POST /api/v1/attestations/:id/revoke requires the existing issuer authorization rail (CRON_SECRET or GitHub Actions OIDC) and a signed JWS for the attestation being revoked.

Example body: { "jws": "<compact-jws>", "reason_code": "counterfeit_confirmed" }

The Worker verifies the JWS, requires the URL identifier to match the signed attestation_id, resolves the signed issuer against the trust registry, and appends an attestation.revoked event. No status row is overwritten.

Revocation is terminal. `attestation_current_status` reports `revoked` for any attestation with an effective revocation, whatever is appended after it (migration 20261014120000_attestation_revocation_terminal). A wrongly revoked claim is replaced by issuing a new attestation, not by re-activating the old id.

### Idempotency keys

`Idempotency-Key` (or `idempotency_key`) on revoke and supersede is scoped to the issuer, and every AuthiChain attestation currently shares one issuer. A retry of the same fact (same event type, attestation id and replacement) returns the original `event_id`. A key already used for a different fact returns **409** and writes nothing. Do not use the bare attestation id as the key: QRON already uses it for the `attestation.issued` event.

## Verification behavior

POST /api/v1/attestation/verify and the PUT compatibility endpoint now consult the durable status registry after verifying the JWS.

A current durable status of revoked, expired, or superseded forces valid=false and returns HTTP 409, while preserving the signed decision and attestation payload.

If the durable registry cannot be read, verification fails closed with HTTP 503 rather than silently accepting an attestation whose revocation state is unknown.

## Migration safety

This implementation does not repair, delete, or rewrite historical Supabase migration records. The existing 123-version reconciliation remains untouched. The new migration is additive and has its own remote history entry.
