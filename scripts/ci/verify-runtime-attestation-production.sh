#!/usr/bin/env bash
# Independent, read-only database attestation bootstrap preflight; no outbox dependency.
set -euo pipefail
: "${AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL:?missing protected DB URL}"
: "${AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF:?missing protected project ref}"
: "${EXPECTED_SUPABASE_REF:?missing dispatch ref}"
: "${RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER:?missing control-plane database fingerprint pin}"
: "${RUNTIME_EXPECTED_DATABASE_NAME:?missing independently pinned database name}"
node --input-type=module <<'NODE'
const ref=process.env.EXPECTED_SUPABASE_REF;
const id=process.env.RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER;
const name=process.env.RUNTIME_EXPECTED_DATABASE_NAME;
if(!/^[a-z0-9]{20}$/.test(ref||'')||ref!==process.env.AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF||
   !/^[1-9][0-9]{15,19}$/.test(id||'')||!/^[a-z][a-z0-9_]{0,62}$/.test(name||'')){
  console.error("::error::independent Supabase identity pins missing or malformed");process.exit(1);
}
const u=new URL(process.env.AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL);
const direct=u.hostname==='db.'+ref+'.supabase.co'&&u.username==='postgres';
const pooler=u.hostname.endsWith('.pooler.supabase.com')&&u.username==='postgres.'+ref;
if(!['postgres:','postgresql:'].includes(u.protocol)||!(direct||pooler)){
  console.error('::error::production DB endpoint mismatches expected protected project');process.exit(1);
}
NODE
command -v psql >/dev/null || { echo "::error::psql unavailable"; exit 1; }
export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=12000"
export PGSSLMODE=require
result="$(psql "$AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
 -v expected_id="$RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER" \
 -v expected_db="$RUNTIME_EXPECTED_DATABASE_NAME" <<'SQL'
SELECT CASE WHEN
  (SELECT count(*)=1 FROM supabase_migrations.schema_migrations WHERE version='20261116153000')
  AND to_regprocedure('public.attest_runtime_database_identity()') IS NOT NULL
  AND has_function_privilege('service_role','public.attest_runtime_database_identity()','EXECUTE')
  AND NOT coalesce(has_function_privilege('anon','public.attest_runtime_database_identity()','EXECUTE'),true)
  AND NOT coalesce(has_function_privilege('authenticated','public.attest_runtime_database_identity()','EXECUTE'),true)
  AND current_database() = :'expected_db'
  AND (SELECT system_identifier::text FROM pg_catalog.pg_control_system()) = :'expected_id'
THEN 'RUNTIME_ATTESTATION_DB_READY' ELSE 'RUNTIME_ATTESTATION_DB_NOT_READY' END;
SQL
)"
test "$result" = "RUNTIME_ATTESTATION_DB_READY" || { echo "::error::protected runtime DB identity/ACL preflight failed"; exit 1; }
echo "RUNTIME_ATTESTATION_DB_READY: independent read-only pins and RPC ACL verified"
