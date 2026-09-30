# Attestation Trust Registry Contract

This contract is the dependency boundary for durable issuer trust and live attestation status. It deliberately separates three questions:

1. **Cryptographic status** — did the JWS verify against the issuer key?
2. **Claim status** — is the attestation active, revoked, expired, or superseded now?
3. **Issuer status** — is the organization trusted, suspended, or retired for the relevant time window?

## Issuer record

Required fields:

- `issuer_id`
- `organization`
- `issuer_type`
- `jwks_uri`
- `status`
- `valid_from`
- optional `valid_until`
- optional `jurisdiction`
- optional `authority_uri`

The issuer registry must be server-write-only for issuer state changes. Public verification may read the current issuer record but must not expose private onboarding evidence.

## Attestation status

The durable status record is keyed by the signed `attestation_id` and stores the current claim state plus the event that established it. Allowed live states are:

- `active`
- `revoked`
- `expired`
- `superseded`

A missing status record means no external revocation has been recorded; it does **not** override the signed payload's issuance-time status.

## Append-only lifecycle events

The persistence layer must retain:

- `attestation.issued`
- `attestation.revoked`
- `attestation.expired`
- `attestation.superseded`

Each event gets an immutable `event_id`, `attestation_id`, `issuer_id`, and timestamp. Optional subject/evidence hashes are digests only. Do not persist raw PII, private evidence, access tokens, or source-government records in this ledger.

## Next implementation gate

The repository's existing Supabase production baseline contains 123 recorded migration versions and a separate migration-reconciliation lane. Therefore this contract is intentionally storage-neutral. The next PR should add the tables/migration only after the baseline lane confirms the exact migration mechanism and schema-drift expectations. That avoids silently changing production migration history while introducing a security-sensitive trust registry.
