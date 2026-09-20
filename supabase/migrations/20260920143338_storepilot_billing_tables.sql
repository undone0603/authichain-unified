-- Already applied on QRON-v2 (nhdnkzhtadfkkluiulhs) as version 20260920143338.
-- Reconstructed verbatim from supabase_migrations.schema_migrations.statements
-- so local history matches remote. Do not invent a second storepilot migration.

create extension if not exists pgcrypto;

create table if not exists storepilot_merchants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'pro',
  billing_status text not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storepilot_stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
