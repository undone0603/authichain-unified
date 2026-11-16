# Protected runtime database identity attestation

This endpoint is **not** a public health check. It is a read-only, authenticated
check of two independently executed database connections:

- `DATABASE_URL` through the Next application’s `src/db/index.ts#getDb`
  postgres-js connection (including its existing transaction-pooler setting).
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` through the
  **same cached client factory** used by the Stripe checkout webhook.

The migration `20261116153000_runtime_database_identity_attestation.sql`
exposes `public.attest_runtime_database_identity()` only to `service_role`
and the function owner. It reads the PostgreSQL cluster system identifier **and current database name**
from `pg_catalog.pg_control_system()` and `current_database()`. The operator confirms the expected value
**independently** via a read-only Supabase management-plane SQL query:

```sql
SELECT system_identifier::text, current_database()
FROM pg_catalog.pg_control_system();
```

Do not attempt to identify this project via `auth.instances`: the connected
Supabase project returned **zero instance rows** during preflight on
2026-11-16. A cluster system identifier combined with the database name is useful for detecting a wrong
physical database; it is *not* a cryptographic credential and may persist in
physical database clones. Treat it as one independent identity check, not proof
of settled Stripe payments or overall release readiness.

## Protected runtime configuration

Install these values only through the existing protected release configuration,
never in public source, logs, URL query strings, or frontend variables:

| Variable | Meaning |
| --- | --- |
| `RUNTIME_ATTESTATION_KEY` | Dedicated randomly generated operator Bearer secret, minimum 32 characters |
| `RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER` | Out-of-band management-plane `system_identifier::text` (19 decimal digits on the checked project) |
| `RUNTIME_EXPECTED_DATABASE_NAME` | Independently verified PostgreSQL database name (`postgres` on the checked project) |
| `RUNTIME_EXPECTED_SUPABASE_PROJECT_REF` | Independently verified 20-character Supabase project ref |
| `AUTHICHAIN_DEPLOYED_SHA` | Exact protected-deployment Git commit SHA (40 hex); Vercel SHA is fallback |

The endpoint also requires the application's existing `DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. **Do not
configure new credentials by copying values out of the request or from the
potentially wrong `DATABASE_URL`.**

## Validation and fail-closed behavior

1. Validate the migration and all tests on the **same PR head**. This does
   not authorize a deployment or production migration.
2. Obtain the independent cluster identifier, database name and project ref via the authorized
   Supabase control plane. Protect the expected values and operator secret.
3. Under separate release approval, run the protected migration and release
   the endpoint with the effective runtime bindings and deployed SHA.
4. Request `GET /api/internal/runtime-db-attestation` over HTTPS with
   `Authorization: Bearer <operator-key>`. Do not put keys in query strings.
5. Verify HTTP 200, `verified: true`, the exact deployed SHA, and two matching
   `sha256:` fingerprints for the `postgres-js:getDb` and
   `stripe-webhook:supabase-js` paths. Record the result and timestamp,
   **never** the operator key, connection string or service-role credential.
6. Verify 401 without auth and 503 for missing/mismatched identity in isolated
   tests; do not intentionally break live bindings for a negative production
   test. The endpoint disables origin and CDN caching.

Any unconfigured pin, missing migration, invalid identity, failed SQL or RPC,
unknown deployed version, or unexpected Supabase URL results in 503 with a
generic error and **no** underlying credentials, raw identity or SQL errors.
Unauthorized requests return 401 without opening a database connection.

This attestation **does not modify payment or entitlement records**, prove
settled funds, deploy application code, or grant merge eligibility. The DPP
paid-settlement checks and protected CI remain separate requirements.
