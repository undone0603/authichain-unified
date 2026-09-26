-- authichain-api (workers/authichain-api): make self-serve API keys and leads
-- actually persist, and let the Worker resolve keys without anon table access.
--
-- Why: the Worker uses the anon key. white_label_clients has RLS enabled with
-- NO policies, so anon INSERTs (signup) and SELECTs (key lookup) were both
-- rejected; leads only allows INSERT where assigned_to = auth.uid(), which is
-- NULL for anon. The Worker swallowed those errors, so no key or lead was ever
-- saved (white_label_clients: 0 rows) and every ac_live_ key only worked via a
-- prefix fallback.
--
-- What: three SECURITY DEFINER functions the anon role may EXECUTE. The tables
-- stay closed to anon. Self-serve keys are stored as 'sha256:<hex>' in
-- white_label_clients.api_key (never plaintext); keys created by
-- server/tenant-billing.ts provisionTenant (plaintext api_key) still resolve.
--
-- provisioning_state uses 'PROVISIONED' (server/services/subscription-orchestrator.ts
-- ProvisioningState); self-serve rows have user_id NULL so the orchestrator,
-- which works per user, never picks them up.
--
-- Additive only: new functions + one partial unique index. No data changes.
-- NOT applied to production by this PR — apply manually before merging the
-- Worker change (merge to main auto-deploys authichain-api).

create unique index if not exists white_label_clients_api_key_uniq
  on public.white_label_clients (api_key)
  where api_key is not null;

create or replace function public.authichain_api_create_key(
  p_email text,
  p_api_key text,
  p_name text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_hash text;
  v_id uuid;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_api_key is null or p_api_key !~ '^ac_live_[0-9a-f]{32}$' then
    raise exception 'invalid_api_key_format' using errcode = '22023';
  end if;

  -- Abuse guard: at most 5 active self-serve keys per email.
  if (
    select count(*) from public.white_label_clients
    where metadata->>'source' = 'self_serve'
      and metadata->>'email' = v_email
      and status = 'active'
  ) >= 5 then
    raise exception 'key_limit_reached' using errcode = 'P0001';
  end if;

  v_hash := 'sha256:' || encode(sha256(convert_to(p_api_key, 'UTF8')), 'hex');

  insert into public.white_label_clients (
    name, company_name, api_key, api_key_prefix, status, billing_plan,
    monthly_api_calls, api_call_limit, provisioning_state, metadata
  ) values (
    v_email, v_email, v_hash, left(p_api_key, 12), 'active', 'free',
    0, 3000, 'PROVISIONED',
    jsonb_build_object('source', 'self_serve', 'email', v_email)
  )
  returning id into v_id;

  insert into public.leads (email, source, name)
  values (v_email, 'api_key_signup', nullif(left(trim(coalesce(p_name, '')), 200), ''))
  on conflict (email) do nothing;

  return v_id;
end;
$$;

create or replace function public.authichain_api_resolve_key(p_api_key text)
returns table (
  id uuid,
  billing_plan text,
  company_name text,
  api_call_limit integer,
  user_id integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.id, w.billing_plan, w.company_name::text, w.api_call_limit, w.user_id
  from public.white_label_clients w
  where p_api_key is not null
    and length(p_api_key) between 8 and 200
    and w.status = 'active'
    and w.api_key in (
      p_api_key,
      'sha256:' || encode(sha256(convert_to(p_api_key, 'UTF8')), 'hex')
    )
  limit 1;
$$;

create or replace function public.authichain_api_capture_lead(
  p_email text,
  p_source text default 'api',
  p_name text default null,
  p_company text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  insert into public.leads (email, source, name, company)
  values (
    v_email,
    left(coalesce(nullif(trim(p_source), ''), 'api'), 100),
    nullif(left(trim(coalesce(p_name, '')), 200), ''),
    nullif(left(trim(coalesce(p_company, '')), 200), '')
  )
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.authichain_api_create_key(text, text, text) from public;
revoke all on function public.authichain_api_resolve_key(text) from public;
revoke all on function public.authichain_api_capture_lead(text, text, text, text) from public;

grant execute on function public.authichain_api_create_key(text, text, text) to anon, authenticated, service_role;
grant execute on function public.authichain_api_resolve_key(text) to anon, authenticated, service_role;
grant execute on function public.authichain_api_capture_lead(text, text, text, text) to anon, authenticated, service_role;
