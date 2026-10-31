create schema if not exists private;

create table if not exists public.attestation_issuers (
  issuer_id text primary key,
  organization text not null,
  jurisdiction text,
  issuer_type text not null check (issuer_type in ('government','manufacturer','brand','laboratory','service')),
  jwks_uri text not null,
  status text not null check (status in ('trusted','suspended','retired')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  authority_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from)
);

create index if not exists attestation_issuers_status_window_idx
  on public.attestation_issuers (status, valid_from, valid_until);

alter table public.attestation_issuers enable row level security;
revoke all on table public.attestation_issuers from anon, authenticated;

create table if not exists public.attestation_status_events (
  event_id text primary key default ('urn:authichain:event:v01:' || gen_random_uuid()::text),
  event_type text not null check (event_type in (
    'attestation.issued',
    'attestation.revoked',
    'attestation.expired',
    'attestation.superseded'
  )),
  attestation_id text not null,
  issuer_id text not null references public.attestation_issuers(issuer_id),
  occurred_at timestamptz not null default now(),
  effective_at timestamptz not null default now(),
  reason_code text,
  subject_hash text check (subject_hash is null or subject_hash ~ '^sha256:[0-9a-f]{64}$'),
  evidence_digest text check (evidence_digest is null or evidence_digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists attestation_status_events_lookup_idx
  on public.attestation_status_events (attestation_id, effective_at desc, occurred_at desc);
create index if not exists attestation_status_events_issuer_idx
  on public.attestation_status_events (issuer_id, occurred_at desc);

alter table public.attestation_status_events enable row level security;
revoke all on table public.attestation_status_events from anon, authenticated;

create or replace view public.attestation_current_status
with (security_invoker = true)
as
select distinct on (attestation_id)
  attestation_id,
  case event_type
    when 'attestation.revoked' then 'revoked'
    when 'attestation.expired' then 'expired'
    when 'attestation.superseded' then 'superseded'
    else 'active'
  end as claim_status,
  effective_at,
  reason_code,
  issuer_id,
  event_id,
  occurred_at
from public.attestation_status_events
where effective_at <= now()
order by attestation_id, effective_at desc, occurred_at desc, event_id desc;

revoke all on table public.attestation_current_status from anon, authenticated;

create or replace function private.prevent_attestation_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'attestation_status_events is append-only';
end;
$$;

revoke execute on function private.prevent_attestation_event_mutation() from public, anon, authenticated;

drop trigger if exists attestation_status_events_immutable on public.attestation_status_events;
create trigger attestation_status_events_immutable
before update or delete on public.attestation_status_events
for each row execute function private.prevent_attestation_event_mutation();

insert into public.attestation_issuers (
  issuer_id, organization, issuer_type, jwks_uri, status, valid_from, authority_uri
)
values (
  'https://authichain.com',
  'AuthiChain',
  'service',
  'https://authichain.com/protocol/jwks.json',
  'trusted',
  now(),
  'https://authichain.com/protocol/issuer.json'
)
on conflict (issuer_id) do update set
  organization = excluded.organization,
  issuer_type = excluded.issuer_type,
  jwks_uri = excluded.jwks_uri,
  status = excluded.status,
  authority_uri = excluded.authority_uri,
  updated_at = now();

comment on table public.attestation_issuers is
  'Durable issuer trust registry. Public API access is mediated by AuthiChain server routes; anon/authenticated have no table grants.';
comment on table public.attestation_status_events is
  'Append-only durable attestation lifecycle events. Revocation/status is derived from the latest effective event.';
comment on view public.attestation_current_status is
  'Current claim status derived from effective attestation lifecycle events; future-dated events are ignored.';
