#!/usr/bin/env bash
# Exact-source prepaid ledger acceptance. No production DB, no published ports,
# no GitHub/CircleCI runner minutes. Requires a disposable Docker Postgres 17.
set -Eeuo pipefail
IFS=$'\n\t'

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repo_root"
migration="$repo_root/supabase/migrations/20261108215700_x402_agent_pack_credits.sql"
fixture="$repo_root/supabase/tests/x402_agent_pack_grants.sql"
[[ -f "$migration" && -f "$fixture" ]] || { echo 'Missing migration or SQL fixture' >&2; exit 2; }
command -v docker >/dev/null || { echo 'Docker unavailable: cannot run actual PostgreSQL' >&2; exit 2; }
command -v python3 >/dev/null || { echo 'python3 unavailable for response assertions' >&2; exit 2; }

# Refuse external database endpoints, credentials, or a host network exposure.
if [[ -n "${DATABASE_URL:-}${SUPABASE_DB_URL:-}${SUPABASE_DATABASE_URL:-}${PGHOST:-}" ]]; then
  echo 'Refusing external database env variables; use isolated Docker only' >&2; exit 2
fi

container="x402-acceptance-$$"
work="$(mktemp -d)"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

# A local-only PostgreSQL instance (no host port, no network), deleted on exit.
# Pull the official free image if the isolated runner has no cached copy.
docker image inspect postgres:17-alpine >/dev/null 2>&1 || docker pull postgres:17-alpine
docker run --rm --detach --name "$container" \
  --network none --pids-limit 200 --memory 768m \
  -e POSTGRES_PASSWORD="local-throwaway-not-production" \
  -v "$migration:/fixtures/migration.sql:ro" \
  -v "$fixture:/fixtures/fixture.sql:ro" \
  postgres:17-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -q -U postgres -d postgres; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -q -U postgres -d postgres || {
  echo 'Disposable PostgreSQL did not start' >&2; exit 1;
}

# Minimal, production-shape subset of authichain's api_keys table for the RPC.
# The real API/owner binding is independently exercised by the Worker tests.
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  name text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] DEFAULT ARRAY['read','generate']::text[],
  is_active boolean DEFAULT true,
  expires_at timestamptz NULL
);
SQL

echo '[x402] applying exact staged migration on disposable PostgreSQL 17'
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /fixtures/migration.sql

echo '[x402] executing rollback-only grant, 120/121 spend, and reversal fixture'
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /fixtures/fixture.sql

# A separate round uses truly concurrent postgres sessions, not sequential mocks.
# `service_role` is the only authorized app principal; the superuser connection
# is restricted to this ephemeral local container.
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.x402_agent_pack_grants', 'SELECT')
     OR has_table_privilege('authenticated', 'public.x402_agent_pack_grants', 'SELECT')
     OR has_table_privilege('anon', 'public.x402_agent_pack_spends', 'SELECT')
     OR has_table_privilege('authenticated', 'public.x402_agent_pack_spends', 'SELECT')
     OR has_table_privilege('anon', 'public.x402_agent_pack_reversals', 'SELECT')
     OR has_table_privilege('authenticated', 'public.x402_agent_pack_reversals', 'SELECT') THEN
    RAISE EXCEPTION 'x402 ledger grants unexpectedly visible to public roles';
  END IF;
  IF has_function_privilege('anon', 'public.consume_x402_agent_pack_credit(uuid,text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.grant_x402_agent_pack(text,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reverse_x402_agent_pack(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'x402 RPC callable by an unauthorized role';
  END IF;
END $$;
INSERT INTO public.api_keys(id,name,key_hash,scopes,is_active)
VALUES ('00000000-0000-4000-8000-000000000999', 'parallel_fixture', repeat('a',64), ARRAY['verify'],true);
SELECT public.grant_x402_agent_pack(
  'cs_live_parallel_acceptance_001', 'pi_parallel_acceptance_001', 'parallel@example.invalid'
);
SQL

echo '[x402] running 140 distinct verification debit requests with up to 12 concurrent clients'
seq -w 1 140 | xargs -P 12 -I '{}' docker exec "$container" \
  psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "SELECT public.consume_x402_agent_pack_credit('00000000-0000-4000-8000-000000000999'::uuid, 'parallel_case_{}_aaaa', '123e4567-e89b-42d3-a456-426614174000'::uuid, 'parallel@example.invalid');" \
  > "$work/debits.jsonl"

python3 - "$work/debits.jsonl" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f:
    rows=[json.loads(line) for line in f if line.strip()]
allowed=sum(r.get('allowed') is True for r in rows)
exhausted=sum(r.get('reason')=='credits_exhausted' for r in rows)
assert len(rows)==140,(len(rows),rows[:3])
assert (allowed,exhausted)==(120,20),(allowed,exhausted,rows[:10])
assert all(r.get('allowed') is True or r.get('reason')=='credits_exhausted' for r in rows)
print(f'[x402] parallel spend passed: requests={len(rows)}, allowed={allowed}, exhausted={exhausted}')
PY

spent="$(docker exec "$container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT credits_used FROM public.x402_agent_pack_grants WHERE payment_intent_id='pi_parallel_acceptance_001';")"
rows="$(docker exec "$container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT count(*) FROM public.x402_agent_pack_spends WHERE api_key_id='00000000-0000-4000-8000-000000000999';")"
[[ "$spent" == '120' && "$rows" == '120' ]] || {
  echo "Atomicity failed: credits_used=$spent, spend_rows=$rows" >&2; exit 1;
}

echo '[x402] refunding exhausted pack; a replay must now be blocked'
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $$
DECLARE j jsonb;
BEGIN
  IF NOT public.reverse_x402_agent_pack('pi_parallel_acceptance_001', 'refunded') THEN
    RAISE EXCEPTION 'refund failed';
  END IF;
  j := public.consume_x402_agent_pack_credit(
    '00000000-0000-4000-8000-000000000999', 'parallel_case_001_aaaa',
    '123e4567-e89b-42d3-a456-426614174000', 'parallel@example.invalid');
  IF j->>'reason' <> 'grant_revoked' THEN
    RAISE EXCEPTION 'refunded grant authorized old receipt: %', j;
  END IF;
END $$;
SQL

echo '[x402] PASS: disposable PG17 migration, SQL fixture, RLS and parallel 120/121 grant/spend/refund checks'
