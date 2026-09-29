create table if not exists public.ops_bot_log (
  id bigserial primary key,
  bot text not null,
  run_at timestamptz not null default now(),
  status text not null check (status in ('ok','warn','fail')),
  summary text not null,
  actions_taken jsonb default '[]'::jsonb,
  decisions_needed jsonb default '[]'::jsonb,
  metrics jsonb default '{}'::jsonb
);
create index if not exists ops_bot_log_bot_run_at on public.ops_bot_log (bot, run_at desc);
alter table public.ops_bot_log enable row level security;
comment on table public.ops_bot_log is 'Shared run ledger for Authentic Economy scheduled bots; read by the Chief of Staff bot. Service-role/MCP access only (RLS on, no policies).';