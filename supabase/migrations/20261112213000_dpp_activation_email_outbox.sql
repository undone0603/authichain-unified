-- Durable, independent delivery claim for a verified DPP paid-session activation.
-- Migration intentionally requires protected deployment and disposable PostgreSQL
-- acceptance before the application may call these RPCs in production.
create table if not exists public.dpp_activation_email_delivery (
  stripe_session_id text primary key,
  profile_id text not null,
  state text not null default 'pending'
    check (state in ('pending', 'sending', 'sent', 'failed', 'unknown')),
  claim_token text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.dpp_activation_email_delivery enable row level security;
revoke all on public.dpp_activation_email_delivery from public;
do $roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.dpp_activation_email_delivery from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.dpp_activation_email_delivery from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.dpp_activation_email_delivery to service_role;
  end if;
end
$roles$;

-- Atomic claim prevents concurrent webhook replays sending the same purpose.
-- A process crash while 'sending' is deliberately UNKNOWN: never resend blindly,
-- because an external provider may have accepted the message before the crash.
create or replace function public.claim_dpp_activation_email(
  p_session_id text,
  p_profile_id text,
  p_claim_token text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  delivery public.dpp_activation_email_delivery%rowtype;
begin
  if p_session_id is null or length(p_session_id) < 4
     or p_profile_id is null or length(p_profile_id) < 1
     or p_claim_token is null or length(p_claim_token) < 8 then
    raise exception 'invalid_dpp_activation_claim';
  end if;
  insert into public.dpp_activation_email_delivery(stripe_session_id, profile_id)
    values (p_session_id, p_profile_id)
    on conflict (stripe_session_id) do nothing;
  select * into delivery from public.dpp_activation_email_delivery
    where stripe_session_id = p_session_id for update;
  if delivery.profile_id is distinct from p_profile_id then
    raise exception 'dpp_activation_profile_mismatch';
  end if;
  if delivery.state = 'sent' then return 'sent'; end if;
  if delivery.state in ('sending', 'unknown') then return 'reconcile'; end if;
  update public.dpp_activation_email_delivery
     set state='sending', claim_token=p_claim_token,
         attempt_count=attempt_count+1, updated_at=now()
   where stripe_session_id=p_session_id;
  return 'claimed';
end;
$$;

create or replace function public.finish_dpp_activation_email(
  p_session_id text,
  p_claim_token text,
  p_outcome text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  changed integer;
begin
  if p_outcome not in ('sent', 'failed', 'unknown') then
    raise exception 'invalid_dpp_activation_outcome';
  end if;
  update public.dpp_activation_email_delivery
    set state=p_outcome, claim_token=null, updated_at=now(),
        sent_at=case when p_outcome='sent' then now() else sent_at end
    where stripe_session_id=p_session_id
      and state='sending' and claim_token=p_claim_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_dpp_activation_email(text,text,text) from public;
revoke all on function public.finish_dpp_activation_email(text,text,text) from public;
do $roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.claim_dpp_activation_email(text,text,text) from anon;
    revoke all on function public.finish_dpp_activation_email(text,text,text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.claim_dpp_activation_email(text,text,text) from authenticated;
    revoke all on function public.finish_dpp_activation_email(text,text,text) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_dpp_activation_email(text,text,text) to service_role;
    grant execute on function public.finish_dpp_activation_email(text,text,text) to service_role;
  end if;
end
$roles$;

comment on table public.dpp_activation_email_delivery is
  'Delivery claims are distinct from DPP grant receipts. Unknown sends require reconciliation, never blind retry.';
