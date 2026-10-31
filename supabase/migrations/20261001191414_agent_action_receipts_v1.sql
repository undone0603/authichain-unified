create table public.agent_action_receipts (
  id             bigint generated always as identity primary key,
  bot            text        not null,
  action_type    text        not null,
  target         text,
  verdict        text        not null check (verdict in ('approved','abstained','executed','failed','ungated')),
  parent_id      bigint      references public.agent_action_receipts(id),
  candidates     jsonb       not null default '[]'::jsonb,
  chosen         jsonb,
  checks         jsonb       not null default '{}'::jsonb,
  rationale      text,
  external_ref   text,
  decided_at     timestamptz not null default now(),
  prev_sha256    text,
  receipt_sha256 text        not null unique
);
create index agent_action_receipts_bot_time on public.agent_action_receipts (bot, decided_at desc);
comment on table public.agent_action_receipts is 'Append-only, hash-chained receipts for side-effecting bot actions (Mid-Harness action gate, arXiv:2609.39982). v1 2026-10-01.';

create or replace function public.agent_action_receipt_payload(r public.agent_action_receipts)
returns text language sql immutable set search_path = public as $$
  select jsonb_build_object('bot',r.bot,'action_type',r.action_type,'target',r.target,'verdict',r.verdict,
    'parent_id',r.parent_id,'candidates',r.candidates,'chosen',r.chosen,'checks',r.checks,
    'rationale',r.rationale,'external_ref',r.external_ref,
    'decided_at',to_char(r.decided_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text
$$;

create or replace function public.agent_action_receipts_seal()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('agent_action_receipts_chain'));
  select receipt_sha256 into new.prev_sha256 from public.agent_action_receipts order by id desc limit 1;
  new.prev_sha256 := coalesce(new.prev_sha256, 'GENESIS');
  new.receipt_sha256 := encode(sha256(convert_to(new.prev_sha256 || '|' || public.agent_action_receipt_payload(new), 'UTF8')), 'hex');
  return new;
end $$;

create or replace function public.agent_action_receipts_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'agent_action_receipts is append-only';
end $$;

create trigger agent_action_receipts_seal before insert on public.agent_action_receipts
  for each row execute function public.agent_action_receipts_seal();
create trigger agent_action_receipts_no_mutate before update or delete on public.agent_action_receipts
  for each row execute function public.agent_action_receipts_immutable();

create or replace function public.verify_agent_action_receipts()
returns table(id bigint, problem text) language plpgsql stable set search_path = public as $$
declare r public.agent_action_receipts; prev text := 'GENESIS';
begin
  for r in select * from public.agent_action_receipts order by agent_action_receipts.id loop
    if r.prev_sha256 is distinct from prev then
      id := r.id; problem := 'chain break: prev_sha256 mismatch'; return next;
    end if;
    if r.receipt_sha256 <> encode(sha256(convert_to(r.prev_sha256 || '|' || public.agent_action_receipt_payload(r), 'UTF8')), 'hex') then
      id := r.id; problem := 'hash mismatch: row altered'; return next;
    end if;
    prev := r.receipt_sha256;
  end loop;
end $$;

alter table public.agent_action_receipts enable row level security;
revoke all on public.agent_action_receipts from anon, authenticated;