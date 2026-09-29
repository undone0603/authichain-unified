-- Growth loop instrumentation store for the first-dollar loops.
--
-- Why: docs/growth/2026-09-28-first-dollar-loops.md defines an instrumentation
-- contract and three kill criteria, all phrased in terms of NON-founder events
-- ("0 purchase_starter_succeeded from a non-founder email AND generate_view >= 200").
-- The event names existed only as a TypeScript union in src/lib/growth/loops.ts
-- and in the doc; nothing fired them and nothing stored them, so no loop could
-- be evaluated or killed on schedule.
--
-- What: one append-only table. Writes come from POST /api/growth, which runs
-- with SUPABASE_SERVICE_ROLE_KEY (same rail as /api/funnel), so RLS is enabled
-- with NO policies — anon and authenticated get nothing. There is deliberately
-- no UPDATE or DELETE path: conversion history is evidence.
--
-- Privacy: email_hash is a SHA-256 hex digest produced by src/lib/growth/emit.ts.
-- Raw addresses are never sent or stored. A hash is enough to correlate an
-- abandoned checkout with its later purchase, which is all the loops need.
--
-- The CHECK constraints intentionally pin the frozen vocabulary. If a loop adds
-- an event, this list changes in the same PR as loops.ts — that coupling is the
-- point, so the store cannot silently drift from the contract.
--
-- Additive only: one new table, no data changes.

create table if not exists public.growth_loop_events (
  id bigint generated always as identity primary key,

  event text not null check (event in (
    'generate_view',
    'generate_submit_anon',
    'free_gen_granted',
    'free_gen_exhausted',
    'checkout_starter_view',
    'checkout_email_captured',
    'checkout_session_started',
    'checkout_abandoned',
    'purchase_starter_succeeded',
    'dpp_check_view',
    'dpp_check_completed',
    'dpp_check_email_captured',
    'checkout_dpp_view',
    'purchase_dpp_succeeded',
    'genetics_view',
    'passport_qr_scan',
    'checkout_passport_view',
    'purchase_passport_succeeded'
  )),

  loop text not null check (loop in (
    'loop_03_qron_starter',
    'loop_02_dpp_check',
    'loop_01_passport_scan'
  )),

  -- Must stay inside PUBLIC_PLAN_IDS (src/lib/plans.ts). 'free' has no loop.
  sku text not null check (sku in (
    'starter',
    'dpp_readiness',
    'strainchain_passport'
  )),

  -- SHA-256 hex of the lowercased, trimmed email. NULL for anonymous events.
  email_hash text check (email_hash is null or email_hash ~ '^[0-9a-f]{64}$'),

  -- Founder traffic is excluded from conversion math, never deleted.
  founder boolean not null default false,

  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

comment on table public.growth_loop_events is
  'Append-only first-dollar loop events. Contract: docs/growth/2026-09-28-first-dollar-loops.md. Service role writes only.';
comment on column public.growth_loop_events.founder is
  'True when the billing email is a FOUNDER_EMAILS address. Exclude from conversion math.';
comment on column public.growth_loop_events.email_hash is
  'SHA-256 hex only. Raw email is never stored.';

-- Kill-criteria queries filter by loop + event over a window, excluding founders.
create index if not exists growth_loop_events_loop_event_time_idx
  on public.growth_loop_events (loop, event, occurred_at desc);

-- The non-founder conversion count is the number every kill decision reads.
create index if not exists growth_loop_events_stranger_idx
  on public.growth_loop_events (event, occurred_at desc)
  where founder = false;

-- Correlating an abandoned checkout with a later purchase.
create index if not exists growth_loop_events_email_hash_idx
  on public.growth_loop_events (email_hash)
  where email_hash is not null;

alter table public.growth_loop_events enable row level security;
-- No policies on purpose: only the service role may read or write.
