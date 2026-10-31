# GovChain / America.gov Integration Contract

Status: draft v0.1 — repository contract, not a claim of federal certification.

## Purpose

GovChain is the government/contractor trust surface on top of AuthiChain verification primitives. This contract keeps agency systems authoritative and makes GovChain outputs machine-readable, auditable, and independently verifiable.

The September 29, 2026 America.gov executive order calls for participating agencies to expose existing public APIs, dashboards, and digital forms through the platform while preserving agency custody of records and requiring data minimization, secure authentication, auditable authorization, and privacy-preserving integration.

## Current public API inventory

| Method | Path | Owner | Auth | Response | Purpose |
|---|---|---|---|---|---|
| GET | /api/govchain/opportunities | govchain-us Worker | Public | JSON | Public SAM opportunity radar; min_fit, limit, q |
| GET | /api/govchain/stats | govchain-us Worker | Public | JSON | Aggregate opportunity/proposal statistics |
| GET | /api/govchain/grants | canonical app, proxied by govchain-us | Public read | JSON | Grant discovery; contact_email excluded |
| GET/POST | /api/x402 | shared x402 surface | Public discovery / payment for POST | JSON | Paid machine-facing rail |
| GET | /api/x402/health | shared x402 surface | Public | JSON | x402 readiness |
| GET | /api/x402/catalog | shared x402 surface | Public | JSON | Payment-link catalog |
| GET/POST | /api/mcp | shared MCP surface | Public discovery / payment for paid calls | JSON | Agent discovery/tool access |
| GET/POST | /mcp | shared MCP surface | Public discovery / payment for paid calls | JSON | Canonical MCP surface |
| GET | /.well-known/mcp.json | MCP discovery | Public | JSON | MCP discovery metadata |
| GET/HEAD | /api/nft-metadata/:id | govchain-us Worker | Public | JSON | ACPT token metadata |
| GET | /health | govchain-us Worker | Public | JSON | Worker health |

The grants route is explicitly exposed through the Cloudflare service binding to the canonical app handler; business logic is not duplicated in the brand Worker.

## Machine-readable response contract

API responses intended for software consumption must return JSON with stable field names, explicit non-2xx errors, and no marketing HTML fallback. Public responses must exclude private contact information and internal scoring rationale. Public GovChain opportunity/proposal reads use column-scoped Supabase views.

## Signed-claim lifecycle

1. Issue a canonical v0.1 attestation.
2. Sign it with Ed25519 and include a key id (kid).
3. Publish the corresponding public key through JWKS.
4. Verify the JWS against JWKS.
5. Evaluate decision, status, expiration, and optional subject/object binding.
6. Consume the machine-readable verification result.
7. Revoke, supersede, or expire the claim when applicable.

Current verification distinguishes signature validity from claim validity: blocked, warning, revoked, and expired claims remain inspectable but are not valid.

### Issuer authorization gap

The generic `POST /api/v1/attestation` signer must be treated as issuer-only. A public caller must not be able to mint an AuthiChain-signed claim merely by submitting a structurally valid payload.

The next security PR must require the existing issuer authorization mechanism (GitHub Actions OIDC or CRON_SECRET) for signing while keeping verification unauthenticated.

## Revocation/status gap

Current verification understands a signed `status: revoked` value, but there is no durable public revocation registry that can invalidate a previously-issued JWS after issuance.

The next lifecycle extension should add:
- `GET /api/v1/attestations/:id/status`
- issuer-authenticated revocation
- append-only revocation event
- effective timestamp
- reason code
- issuer identity
- immutable audit identifier

Verification should check both the JWS and current status before treating a claim as actionable.

## Audit/event contract

Issuer-side mutations should create append-only events:

```json
{
  "event_id": "urn:authichain:event:v01:...",
  "event_type": "attestation.issued",
  "attestation_id": "urn:authichain:attestation:v01:...",
  "issuer": "https://authichain.com",
  "occurred_at": "2026-09-30T00:00:00Z",
  "actor": "github-actions|cron|service",
  "subject_hash": "sha256:...",
  "evidence_digest": "sha256:..."
}
```

Required mutation events: `attestation.issued`, `attestation.revoked`, `attestation.expired`, and `attestation.superseded`. Verification events may be sampled or aggregated when appropriate.

Do not place raw PII, access tokens, private source payloads, or full government records in audit events.

## Authentication and authorization

Public: discovery, health, aggregate public statistics, public opportunity/grant discovery, signature verification, and public metadata.

Authenticated: issuance, revocation, issuer-owned state changes, private agency/contractor records, and non-public evidence.

Preferred issuer authentication is the existing GitHub Actions OIDC or CRON_SECRET mechanism. Never use the attestation private key itself as an API credential.

For future America.gov/agency integrations, keep authentication, authorization, provenance, and custody as separate controls. GovChain must not become a centralized federal record system.

## Privacy/data minimization

Public endpoints must not expose contact_email, raw SAM/source payloads, internal AI reasoning, private evidence, government case records, access tokens, or unnecessary identity attributes.

Use opaque identifiers and hashes where possible. Keep personally identifying evidence in the originating system unless disclosure is explicitly authorized.

## America.gov integration boundary

GovChain is an interoperability/trust layer, not an America.gov replacement.

```
Agency system
   -> authoritative claim
   -> GovChain adapter
   -> signed attestation
   -> status/revocation registry
   -> AuthiChain verification
   -> America.gov / authorized relying party
```

The originating agency remains authoritative for the underlying record and adjudication.

## Acceptance tests

- documented API paths resolve to JSON rather than landing HTML;
- public endpoints declare JSON content types;
- public views contain no contact_email or raw private fields;
- signing requires issuer authorization;
- verification remains public;
- invalid signatures fail closed;
- blocked/warning/revoked/expired claims are not valid;
- subject/object binding rejects mismatches;
- revocation survives after JWS issuance;
- issuer mutations create append-only audit events;
- audit events use digests rather than unnecessary PII;
- service-bound proxies preserve path, query, method, and forwarded host;
- API failures use stable machine-readable error objects.

## Dependency-ordered implementation plan

1. **P0 API surface:** expose `/api/govchain/grants` through the canonical app service binding and lock it with routing tests.
2. **P0 issuer authorization:** protect generic attestation signing with the existing issuer authorization mechanism and add regression tests.
3. **P1 revocation/status:** add durable status/revocation state and verification-time lookup.
4. **P1 audit ledger:** record append-only issuer mutations and revocation events with minimized evidence.
5. **P1 agency adapter contract:** define issuer metadata, authorization context, source URI, claim type, status endpoint, and evidence digest.
6. **P2 America.gov integration pack:** publish OpenAPI examples, security/data-flow documentation, conformance fixtures, and an agency test harness.

This document is an engineering integration contract, not a claim of America.gov certification or federal endorsement.
