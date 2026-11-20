#!/usr/bin/env bash
# Read-only protected release gate for the CURRENT #2482 DPP activation outbox.
# Do not apply SQL, replay payments, send email, or infer deployed Worker identity.
set -euo pipefail

: "$AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL"
: "$AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF"
: "$EXPECTED_SUPABASE_REF"
if [[ ! "$EXPECTED_SUPABASE_REF" =~ ^[a-z0-9]{20}$ ]] ||
   [[ "$EXPECTED_SUPABASE_REF" != "$AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF" ]]; then
  echo "::error::Protected Supabase target identity mismatch" >&2
  exit 1
fi

# The approved URL must identify the independently pinned project. Never log it.
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

# #2648 replaced the obsolete 20261112213000 email-delivery table/RPC contract.
# The current migration intentionally forbids even service_role direct table access;
# only service_role may EXECUTE the five SECURITY DEFINER outbox RPCs.
result="$(psql "$AUTHICHAIN_PRODUCTION_SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 <<'SQL'
select case when
  exists (select 1 from supabase_migrations.schema_migrations where version='20261119133000')
  and to_regclass('public.dpp_activation_outbox') is not null
  and to_regclass('public.founder_exit_side_effects') is not null
  and to_regprocedure('public.dpp_activation_prepare(text)') is not null
  and to_regprocedure('public.dpp_activation_enqueue(text,text,boolean)') is not null
  and to_regprocedure('public.dpp_activation_claim(text,text)') is not null
  and to_regprocedure('public.dpp_activation_begin_send(text,uuid)') is not null
  and to_regprocedure('public.dpp_activation_finish_send(text,uuid,boolean,text,integer,text)') is not null
  and (select relrowsecurity from pg_class where oid=to_regclass('public.dpp_activation_outbox')) is true
  and not coalesce(has_table_privilege('service_role',to_regclass('public.dpp_activation_outbox'),'SELECT, INSERT, UPDATE, DELETE'),false)
  and not coalesce(has_table_privilege('anon',to_regclass('public.dpp_activation_outbox'),'SELECT, INSERT, UPDATE, DELETE'),false)
  and not coalesce(has_table_privilege('authenticated',to_regclass('public.dpp_activation_outbox'),'SELECT, INSERT, UPDATE, DELETE'),false)
  and coalesce(has_function_privilege('service_role',to_regprocedure('public.dpp_activation_prepare(text)'),'EXECUTE'),false)
  and coalesce(has_function_privilege('service_role',to_regprocedure('public.dpp_activation_enqueue(text,text,boolean)'),'EXECUTE'),false)
  and coalesce(has_function_privilege('service_role',to_regprocedure('public.dpp_activation_claim(text,text)'),'EXECUTE'),false)
  and coalesce(has_function_privilege('service_role',to_regprocedure('public.dpp_activation_begin_send(text,uuid)'),'EXECUTE'),false)
  and coalesce(has_function_privilege('service_role',to_regprocedure('public.dpp_activation_finish_send(text,uuid,boolean,text,integer,text)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('anon',to_regprocedure('public.dpp_activation_prepare(text)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('anon',to_regprocedure('public.dpp_activation_enqueue(text,text,boolean)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('anon',to_regprocedure('public.dpp_activation_claim(text,text)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('anon',to_regprocedure('public.dpp_activation_begin_send(text,uuid)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('anon',to_regprocedure('public.dpp_activation_finish_send(text,uuid,boolean,text,integer,text)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.dpp_activation_prepare(text)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.dpp_activation_enqueue(text,text,boolean)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.dpp_activation_claim(text,text)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.dpp_activation_begin_send(text,uuid)'),'EXECUTE'),false)
  and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.dpp_activation_finish_send(text,uuid,boolean,text,integer,text)'),'EXECUTE'),false)
then 'DPP_ACTIVATION_DB_READY' else 'DPP_ACTIVATION_DB_NOT_READY' end;
SQL
)"
if [[ "$result" != "DPP_ACTIVATION_DB_READY" ]]; then
  echo "::error::DPP schema/privileges not ready; fail-closed without publishing Worker" >&2
  exit 1
fi
echo "DPP_ACTIVATION_DB_READY: read-only #2482 schema/privilege attestation passed"
