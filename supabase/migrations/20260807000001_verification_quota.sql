-- Verification quota: per-API-key rate limits and spend caps.
--
-- Step 1 of docs/superpowers/plans/2026-08-07-x402-agent-verification.md. This
-- must exist before /api/verify can accept payment: an agent-payable endpoint
-- without a hard ceiling is an unbounded liability, because a looping agent, a
-- bug, or a funded attacker can spend without limit.
--
-- Additive only: creates two new tables and one function, alters nothing.

-- Per-key limits. A key with no row here is denied (fail closed) — quota must be
-- granted explicitly, never inherited by default.
create table if not exists public.verification_quota (
  api_key_id      uuid primary key references public.api_keys(id) on delete cascade,
  -- Requests allowed in any rolling 60 seconds.
  rate_per_minute integer not null default 60 check (rate_per_minute >= 0),
  -- Requests allowed in any rolling 24 hours.
  daily_limit     integer not null default 10000 check (daily_limit >= 0),
  -- Hard cumulative ceiling. Once spent_cents reaches this, the key stops.
  -- Nothing here raises it automatically; that is deliberate.
  spend_cap_cents integer not null default 0 check (spend_cap_cents >= 0),
  spent_cents     integer not null default 0 check (spent_cents >= 0),
  -- Operator kill switch for a single key.
  disabled        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Append-only usage ledger. Also the source of truth for the rolling windows,
-- so the rate limit cannot be reset by editing a counter.
create table if not exists public.verification_usage (
  id          bigserial primary key,
  api_key_id  uuid not null references public.api_keys(id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  occurred_at timestamptz not null default now()
);

create index if not exists verification_usage_key_time_idx
  on public.verification_usage (api_key_id, occurred_at desc);

-- Atomically decide and record in one statement.
--
-- Checking and then writing from application code races: two concurrent
-- requests both read spent_cents below the cap and both proceed, so the cap is
-- exceeded. The row lock taken by UPDATE ... WHERE serialises that, and the
-- ledger insert happens in the same transaction as the counter increment.
--
-- Returns (allowed, reason, remaining_cents). Reason is stable, machine-readable
-- text so the route can map it to the right status code.
create or replace function public.consume_verification_quota(
  p_api_key_id uuid,
  p_price_cents integer
)
returns table (allowed boolean, reason text, remaining_cents integer)
language plpgsql
as $$
declare
  v_quota   public.verification_quota%rowtype;
  v_minute  integer;
  v_day     integer;
begin
  -- Lock the quota row for the duration of the transaction. Concurrent callers
  -- for the same key queue here rather than racing.
  select * into v_quota
  from public.verification_quota
  where api_key_id = p_api_key_id
  for update;

  -- No quota row: fail closed. A key must be granted quota explicitly.
  if not found then
    return query select false, 'no_quota'::text, 0;
    return;
  end if;

  if v_quota.disabled then
    return query select false, 'key_disabled'::text, 0;
    return;
  end if;

  if v_quota.spent_cents + p_price_cents > v_quota.spend_cap_cents then
    return query
      select false,
             'spend_cap_reached'::text,
             greatest(v_quota.spend_cap_cents - v_quota.spent_cents, 0);
    return;
  end if;

  select count(*) into v_minute
  from public.verification_usage
  where api_key_id = p_api_key_id
    and occurred_at > now() - interval '1 minute';

  if v_minute >= v_quota.rate_per_minute then
    return query
      select false,
             'rate_limited'::text,
             greatest(v_quota.spend_cap_cents - v_quota.spent_cents, 0);
    return;
  end if;

  select count(*) into v_day
  from public.verification_usage
  where api_key_id = p_api_key_id
    and occurred_at > now() - interval '1 day';

  if v_day >= v_quota.daily_limit then
    return query
      select false,
             'daily_limit_reached'::text,
             greatest(v_quota.spend_cap_cents - v_quota.spent_cents, 0);
    return;
  end if;

  -- Allowed: record the spend and the ledger entry together.
  update public.verification_quota
  set spent_cents = spent_cents + p_price_cents,
      updated_at = now()
  where api_key_id = p_api_key_id;

  insert into public.verification_usage (api_key_id, price_cents)
  values (p_api_key_id, p_price_cents);

  return query
    select true,
           'ok'::text,
           greatest(v_quota.spend_cap_cents - v_quota.spent_cents - p_price_cents, 0);
end;
$$;

-- Service-role only. These tables carry billing state; no anon/authenticated
-- access, and RLS with no policy denies everything but the service role.
alter table public.verification_quota enable row level security;
alter table public.verification_usage enable row level security;
