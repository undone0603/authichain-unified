#!/usr/bin/env bash
# Read-only attestation: application deployment NEVER applies database changes.
set -euo pipefail
: "${AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL:?Missing production-supabase DB URL}"
: "${AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF:?Missing protected project reference}"
: "${EXPECTED_SUPABASE_REF:?Missing expected project reference}"
if [[ ! "$EXPECTED_SUPABASE_REF" =~ ^[a-z0-9]{20}$ ]] || [[ "$EXPECTED_SUPABASE_REF" != "$AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF" ]]; then
  echo "::error::Protected Supabase target identity mismatch" >&2
  exit 1
fi
node --input-type=module - <<'NODE'
const u=new URL(process.env.AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL);
const ref=process.env.EXPECTED_SUPABASE_REF;
const direct=u.hostname==="db."+ref+".supabase.co"&&u.username==="postgres";
const pooler=u.hostname.endsWith(".pooler.supabase.com")&&u.username==="postgres."+ref;
if(!["postgres:","postgresql:"].includes(u.protocol)||!(direct||pooler)){
  console.error("::error::Unexpected Supabase connection endpoint or project identity");
  process.exit(1);
}
NODE
command -v psql >/dev/null || { echo "::error::Missing read-only PostgreSQL client" >&2; exit 1; }
export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=12000"
export PGSSLMODE=require
result="$(psql "$AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 <<'SQL'
select case when
  (select count(*)=1 from supabase_migrations.schema_migrations where version='20261112213000')
  and to_regclass('public.dpp_activation_email_delivery') is not null
  and to_regprocedure('public.claim_dpp_activation_email(text,text,text)') is not null
  and to_regprocedure('public.finish_dpp_activation_email(text,text,text)') is not null
  and (select relrowsecurity from pg_class where oid=to_regclass('public.dpp_activation_email_delivery')) is true
  and has_table_privilege('service_role','public.dpp_activation_email_delivery','SELECT')
  and has_table_privilege('service_role','public.dpp_activation_email_delivery','INSERT')
  and has_table_privilege('service_role','public.dpp_activation_email_delivery','UPDATE')
  and not coalesce(has_table_privilege('anon','public.dpp_activation_email_delivery','SELECT, INSERT, UPDATE, DELETE'),false)
  and not coalesce(has_table_privilege('authenticated','public.dpp_activation_email_delivery','SELECT, INSERT, UPDATE, DELETE'),false)
  and has_function_privilege('service_role','public.claim_dpp_activation_email(text,text,text)','EXECUTE')
  and has_function_privilege('service_role','public.finish_dpp_activation_email(text,text,text)','EXECUTE')
  and not coalesce(has_function_privilege('anon','public.claim_dpp_activation_email(text,text,text)','EXECUTE'),false)
  and not coalesce(has_function_privilege('anon','public.finish_dpp_activation_email(text,text,text)','EXECUTE'),false)
  and not coalesce(has_function_privilege('authenticated','public.claim_dpp_activation_email(text,text,text)','EXECUTE'),false)
  and not coalesce(has_function_privilege('authenticated','public.finish_dpp_activation_email(text,text,text)','EXECUTE'),false)
then 'DPP_ACTIVATION_DB_READY' else 'DPP_ACTIVATION_DB_NOT_READY' end;
SQL
)"
if [[ "$result" != "DPP_ACTIVATION_DB_READY" ]]; then
  echo "::error::DPP schema/permissions not ready; fail-closed without publishing Worker" >&2
  exit 1
fi
echo "DPP_ACTIVATION_DB_READY: read-only attestation passed"
