create extension if not exists pgcrypto;

create table if not exists public.claimpilot_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null,
  url text not null unique,
  last_checked_at timestamptz,
  trust_level text not null default 'discovery' check (trust_level in ('official','verified','discovery')),
  created_at timestamptz not null default now()
);

create table if not exists public.claimpilot_settlements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  defendant text,
  case_number text,
  court text,
  class_definition text,
  jurisdiction text,
  status text not null default 'open' check (status in ('discovered','verifying','open','closed','expired')),
  official_url text,
  claim_url text,
  administrator text,
  proof_requirement text not null default 'unknown' check (proof_requirement in ('none','self_attestation','low','receipt','substantial','unknown')),
  estimated_min numeric,
  estimated_max numeric,
  claim_deadline timestamptz,
  objection_deadline timestamptz,
  final_approval_date timestamptz,
  last_verified_at timestamptz,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claimpilot_sources_settlements (
  source_id uuid references public.claimpilot_sources(id) on delete cascade,
  settlement_id uuid references public.claimpilot_settlements(id) on delete cascade,
  source_url text not null,
  captured_at timestamptz not null default now(),
  primary key (source_id, settlement_id)
);

create table if not exists public.claimpilot_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  state text,
  states_lived text[] not null default '{}',
  companies_used text[] not null default '{}',
  products_owned text[] not null default '{}',
  subscriptions text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claimpilot_profile_facts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.claimpilot_profiles(id) on delete cascade,
  fact_type text not null,
  fact_value text not null,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  source text,
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.claimpilot_eligibility_checks (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.claimpilot_settlements(id) on delete cascade,
  profile_id uuid not null references public.claimpilot_profiles(id) on delete cascade,
  score numeric not null default 0 check (score between 0 and 100),
  eligibility_status text not null default 'possible' check (eligibility_status in ('eligible','possible','unlikely','ineligible','needs_review')),
  reasons jsonb not null default '[]'::jsonb,
  missing_facts jsonb not null default '[]'::jsonb,
  proof_burden integer not null default 4 check (proof_burden between 0 and 4),
  checked_at timestamptz not null default now(),
  unique(settlement_id, profile_id)
);

create table if not exists public.claimpilot_claims (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.claimpilot_settlements(id) on delete cascade,
  profile_id uuid not null references public.claimpilot_profiles(id) on delete cascade,
  eligibility_check_id uuid references public.claimpilot_eligibility_checks(id),
  status text not null default 'candidate' check (status in ('candidate','ready','review','submitted','processing','paid','rejected','expired')),
  claim_answers jsonb not null default '{}'::jsonb,
  confirmation_number text,
  submitted_at timestamptz,
  paid_at timestamptz,
  payout_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(settlement_id, profile_id)
);

create table if not exists public.claimpilot_deadlines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.claimpilot_settlements(id) on delete cascade,
  claim_id uuid references public.claimpilot_claims(id) on delete cascade,
  kind text not null check (kind in ('claim','objection','final_approval','payment')),
  due_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists claimpilot_settlements_deadline_idx on public.claimpilot_settlements(claim_deadline);
create index if not exists claimpilot_eligibility_score_idx on public.claimpilot_eligibility_checks(score desc);
create index if not exists claimpilot_deadlines_due_idx on public.claimpilot_deadlines(due_at);

alter table public.claimpilot_sources enable row level security;
alter table public.claimpilot_settlements enable row level security;
alter table public.claimpilot_sources_settlements enable row level security;
alter table public.claimpilot_profiles enable row level security;
alter table public.claimpilot_profile_facts enable row level security;
alter table public.claimpilot_eligibility_checks enable row level security;
alter table public.claimpilot_claims enable row level security;
alter table public.claimpilot_deadlines enable row level security;

create policy "public can read settlement sources" on public.claimpilot_sources for select using (true);
create policy "public can read settlements" on public.claimpilot_settlements for select using (true);
create policy "users own profile" on public.claimpilot_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own profile facts" on public.claimpilot_profile_facts for all using (exists (select 1 from public.claimpilot_profiles p where p.id = profile_id and p.user_id = auth.uid())) with check (exists (select 1 from public.claimpilot_profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "users own eligibility" on public.claimpilot_eligibility_checks for all using (exists (select 1 from public.claimpilot_profiles p where p.id = profile_id and p.user_id = auth.uid())) with check (exists (select 1 from public.claimpilot_profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "users own claims" on public.claimpilot_claims for all using (exists (select 1 from public.claimpilot_profiles p where p.id = profile_id and p.user_id = auth.uid())) with check (exists (select 1 from public.claimpilot_profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "users own deadlines" on public.claimpilot_deadlines for all using (exists (select 1 from public.claimpilot_claims c join public.claimpilot_profiles p on p.id = c.profile_id where c.id = claim_id and p.user_id = auth.uid())) with check (exists (select 1 from public.claimpilot_claims c join public.claimpilot_profiles p on p.id = c.profile_id where c.id = claim_id and p.user_id = auth.uid()));
