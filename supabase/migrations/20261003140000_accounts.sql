-- Applied to QRON-v2 (nhdnkzhtadfkkluiulhs) as accounts_one_per_owner on 2026-10-03.
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand text not null default 'authichain'
    check (brand in ('authichain', 'qron', 'govchain', 'strainchain')),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  plan text not null default 'free',
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accounts_one_per_owner
  on public.accounts (owner_user_id);

alter table public.accounts enable row level security;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts
  for insert to authenticated
  with check (owner_user_id = auth.uid());

grant select, insert on public.accounts to authenticated;
grant all on public.accounts to service_role;
