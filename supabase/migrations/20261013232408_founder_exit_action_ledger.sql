-- Operational continuity for agent actions. Not an economic ledger.
-- Cash stays in Stripe and classifyRevenue. Entitlements stay on profiles.
-- anon and authenticated receive no privileges. service_role may insert
-- and update actions, and may insert side-effect keys. Deletes are rejected.
-- History is append-only for an ordinary update.

create table if not exists public.founder_exit_actions (
  action_id text primary key,
  idempotency_key text not null,
  action_type text not null,
  agent_id text not null,
  agent_identity_version text not null,
  parent_action_id text,
  delegation_chain jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  started_at timestamptz,
  updated_at timestamptz not null,
  completed_at timestamptz,
  state text not null,
  authorization_decision text not null,
  policy_version text not null,
  input_evidence_refs jsonb not null default '[]'::jsonb,
  output_evidence_refs jsonb not null default '[]'::jsonb,
  economic_event_refs jsonb not null default '[]'::jsonb,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  error_class text,
  error_detail_redacted text,
  recovery_instruction text,
  measurement_definition text not null,
  measurement_result text,
  verification_status text not null,
  supersedes_action_id text,
  correlation_id text not null,
  trace_id text,
  request_submitted boolean not null default false,
  request_accepted boolean not null default false,
  external_completed boolean not null default false,
  result_independently_verified boolean not null default false,
  result_reconciled boolean not null default false,
  history jsonb not null,
  constraint founder_exit_actions_retry_count_check check (retry_count >= 0),
  constraint founder_exit_actions_state_check check (
    state in (
      'queued',
      'authorized',
      'running',
      'awaiting_external_result',
      'succeeded',
      'retryable_failure',
      'permanent_failure',
      'blocked',
      'cancelled',
      'denied',
      'reconciliation_required'
    )
  ),
  constraint founder_exit_actions_decision_check check (
    authorization_decision in ('permitted', 'denied', 'awaiting_approval')
  ),
  constraint founder_exit_actions_evidence_check check (
    verification_status in (
      'verified',
      'observed_unverified',
      'estimated',
      'simulated',
      'blocked',
      'unknown'
    )
  ),
  constraint founder_exit_actions_history_check check (jsonb_typeof(history) = 'array')
);

create unique index if not exists founder_exit_actions_idempotency_key_idx
  on public.founder_exit_actions (idempotency_key);

create index if not exists founder_exit_actions_open_lease_idx
  on public.founder_exit_actions (lease_expires_at)
  where state in ('running', 'awaiting_external_result');

create table if not exists public.founder_exit_side_effects (
  idempotency_key text primary key,
  recorded_at timestamptz not null default now()
);

create or replace function public.founder_exit_actions_guard()
returns trigger
language plpgsql
as $$
declare
  i integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'delete_forbidden' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.action_id is distinct from old.action_id
       or new.idempotency_key is distinct from old.idempotency_key then
      raise exception 'identity_immutable' using errcode = '23514';
    end if;
    if jsonb_typeof(new.history) <> 'array'
       or jsonb_typeof(old.history) <> 'array' then
      raise exception 'history_must_be_array' using errcode = '23514';
    end if;
    if jsonb_array_length(new.history) < jsonb_array_length(old.history) then
      raise exception 'history_shortened' using errcode = '23514';
    end if;
    for i in 0 .. jsonb_array_length(old.history) - 1 loop
      if (new.history -> i) is distinct from (old.history -> i) then
        raise exception 'history_rewritten' using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists founder_exit_actions_guard on public.founder_exit_actions;
create trigger founder_exit_actions_guard
  before update on public.founder_exit_actions
  for each row
  execute function public.founder_exit_actions_guard();

drop trigger if exists founder_exit_actions_no_delete on public.founder_exit_actions;
create trigger founder_exit_actions_no_delete
  before delete on public.founder_exit_actions
  for each row
  execute function public.founder_exit_actions_guard();

drop trigger if exists founder_exit_side_effects_no_delete on public.founder_exit_side_effects;
create trigger founder_exit_side_effects_no_delete
  before delete on public.founder_exit_side_effects
  for each row
  execute function public.founder_exit_actions_guard();

alter table public.founder_exit_actions enable row level security;
alter table public.founder_exit_side_effects enable row level security;

revoke all on table public.founder_exit_actions from public;
revoke all on table public.founder_exit_side_effects from public;
revoke all on function public.founder_exit_actions_guard() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.founder_exit_actions from anon;
    revoke all on table public.founder_exit_side_effects from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.founder_exit_actions from authenticated;
    revoke all on table public.founder_exit_side_effects from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on table public.founder_exit_actions from service_role;
    revoke all on table public.founder_exit_side_effects from service_role;
    grant select, insert, update on table public.founder_exit_actions to service_role;
    grant select, insert on table public.founder_exit_side_effects to service_role;
  end if;
end;
$$;

comment on table public.founder_exit_actions is
  'Agent continuity ledger. Not revenue, not entitlements, not a price catalogue.';
comment on table public.founder_exit_side_effects is
  'Idempotency keys for side effects already applied. Insert once.';
