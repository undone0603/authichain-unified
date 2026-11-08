-- x402 prepaid credit pack ledger
-- payer is the Base wallet address (lowercased) that buys the $5 / 120-call pack.

create table if not exists public.x402_credits (
  payer text primary key,
  remaining integer not null default 0 check (remaining >= 0),
  updated_at timestamptz not null default now()
);

-- Atomic decrement. Returns new remaining, or -1 if insufficient / missing.
create or replace function public.decrement_x402_credit(p_payer text)
returns integer
language plpgsql
security definer
as $$
declare
  new_remaining integer;
begin
  update public.x402_credits
  set remaining = remaining - 1,
      updated_at = now()
  where payer = lower(p_payer) and remaining > 0
  returning remaining into new_remaining;

  return coalesce(new_remaining, -1);
end;
$$;

-- Atomic increment for webhook grants.
create or replace function public.grant_x402_credits(p_payer text, p_amount integer)
returns integer
language plpgsql
security definer
as $$
declare
  new_remaining integer;
begin
  insert into public.x402_credits (payer, remaining)
  values (lower(p_payer), p_amount)
  on conflict (payer) do update
    set remaining = public.x402_credits.remaining + excluded.remaining,
        updated_at = now()
  returning remaining into new_remaining;

  return new_remaining;
end;
$$;

grant execute on function public.decrement_x402_credit(text) to service_role;
grant execute on function public.grant_x402_credits(text, integer) to service_role;
