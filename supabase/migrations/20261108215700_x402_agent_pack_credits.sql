-- Stripe x402 Agent Credits: 120 prepaid verification requests per paid $5 pack.
-- Additive, service-role only, default-deny. Never reuse QR generation quota.
-- The canonical webhook verifies the actual Stripe Checkout line item before
-- inserting a grant. Duplicate sessions cannot add credits a second time.
--
-- Supabase CLI unavailable in this executor; migration is intentionally staged
-- in GitHub and MUST be applied only through the protected migration path.

create table if not exists public.x402_agent_pack_grants (
  checkout_session_id text primary key,
  buyer_email text not null check (length(btrim(buyer_email)) between 3 and 254),
  payment_intent_id text,
  price_id text not null check (price_id = 'price_1UZdq5GqTruSqV8TsaDtFBPF'),
  credits_total integer not null default 120 check (credits_total = 120),
  credits_used integer not null default 0
    check (credits_used >= 0 and credits_used <= credits_total),
  status text not null default 'active'
    check (status in ('active', 'refunded', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists x402_agent_pack_email_active_idx
  on public.x402_agent_pack_grants (lower(buyer_email), created_at)
  where status = 'active';

create table if not exists public.x402_agent_pack_spends (
  -- Opaque historical key ID; do not prevent a customer deleting a compromised API key.
  -- The RPC independently validates the active key before inserting a spend.
  api_key_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  checkout_session_id text not null references public.x402_agent_pack_grants(checkout_session_id),
  seal_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (api_key_id, idempotency_key)
);
create index if not exists x402_agent_pack_spends_grant_idx
  on public.x402_agent_pack_spends(checkout_session_id, created_at);

alter table public.x402_agent_pack_grants enable row level security;
alter table public.x402_agent_pack_spends enable row level security;

-- No public RLS policies: only the service-role webhook and verifier may read/write.
revoke all on public.x402_agent_pack_grants from public, anon, authenticated;
revoke all on public.x402_agent_pack_spends from public, anon, authenticated;
grant select, insert, update on public.x402_agent_pack_grants to service_role;
grant select, insert on public.x402_agent_pack_spends to service_role;

-- A reversal can arrive BEFORE checkout.session.completed. Remember it so
-- late delivery cannot issue credits for a refunded/disputed PaymentIntent.
create table if not exists public.x402_agent_pack_reversals (
  payment_intent_id text primary key,
  status text not null check (status in ('refunded', 'disputed')),
  created_at timestamptz not null default now()
);
create unique index if not exists x402_agent_pack_grants_payment_intent_idx
  on public.x402_agent_pack_grants(payment_intent_id)
  where payment_intent_id is not null;
alter table public.x402_agent_pack_reversals enable row level security;
revoke all on public.x402_agent_pack_reversals from public, anon, authenticated;
grant select, insert, update on public.x402_agent_pack_reversals to service_role;

-- One transaction/lock for duplicate requests and concurrent purchases by the
-- same verified API key owner. A failed DB transaction consumes zero credits.
-- SECURITY INVOKER, never SECURITY DEFINER: only the service role may call.
create or replace function public.consume_x402_agent_pack_credit(
  p_api_key_id uuid,
  p_idempotency_key text,
  p_seal_id uuid,
  p_verified_email text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_email text;
  v_grant public.x402_agent_pack_grants%rowtype;
  v_prior public.x402_agent_pack_spends%rowtype;
  v_remaining integer;
begin
  if p_api_key_id is null or p_seal_id is null or
     p_idempotency_key is null or
     length(p_idempotency_key) not between 16 and 128 or
     p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  end if;

  -- Only the server-side verifier may supply p_verified_email. It first
  -- retrieves the API key owner's confirmed email via Supabase Auth Admin.
  -- Never trust public.profiles.email: authenticated users may edit it.
  v_email := lower(btrim(p_verified_email));
  if v_email is null or length(v_email) not between 3 and 254 or
     position('@' in v_email) <= 1 or not exists (
       select 1 from public.api_keys k
       where k.id = p_api_key_id and k.is_active is true
         and (k.expires_at is null or k.expires_at > now())
         and ('read' = any(k.scopes) or 'verify' = any(k.scopes))
     ) then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'invalid_key_or_identity');
  end if;

  -- Serialize all credits for one buyer, including sessions with multiple packs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));

  select * into v_prior from public.x402_agent_pack_spends
  where api_key_id = p_api_key_id and idempotency_key = p_idempotency_key;
  if found then
    if v_prior.seal_id <> p_seal_id then
      return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'idempotency_conflict');
    end if;
    -- A refund/dispute revokes even a previously redeemed idempotency key:
    -- no refreshed evidence may be served after the purchase was reversed.
    if not exists (
      select 1 from public.x402_agent_pack_grants g
      where g.checkout_session_id = v_prior.checkout_session_id and g.status = 'active'
    ) then
      return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'grant_revoked');
    end if;
    -- The replay is free, but must report the buyer's current balance.
    -- Refund processing takes the same buyer lock; this balance cannot
    -- accidentally count a concurrently revoked purchase.
    select coalesce(sum(credits_total - credits_used), 0)::integer into v_remaining
    from public.x402_agent_pack_grants
    where lower(buyer_email) = v_email and status = 'active';
    return pg_catalog.jsonb_build_object(
      'allowed', true, 'replayed', true,
      'remaining_credits', v_remaining,
      'checkout_session_id', v_prior.checkout_session_id
    );
  end if;

  select * into v_grant from public.x402_agent_pack_grants
  where lower(buyer_email) = v_email and status = 'active'
    and credits_used < credits_total
  order by created_at, checkout_session_id
  limit 1 for update;
  if not found then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'credits_exhausted');
  end if;

  update public.x402_agent_pack_grants
  set credits_used = credits_used + 1, updated_at = now()
  where checkout_session_id = v_grant.checkout_session_id;
  insert into public.x402_agent_pack_spends(
    api_key_id, idempotency_key, checkout_session_id, seal_id
  ) values (
    p_api_key_id, p_idempotency_key, v_grant.checkout_session_id, p_seal_id
  );

  select coalesce(sum(credits_total - credits_used), 0)::integer into v_remaining
  from public.x402_agent_pack_grants
  where lower(buyer_email) = v_email and status = 'active';

  return pg_catalog.jsonb_build_object(
    'allowed', true, 'replayed', false, 'remaining_credits', v_remaining,
    'checkout_session_id', v_grant.checkout_session_id
  );
end
$$;

revoke all on function public.consume_x402_agent_pack_credit(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_x402_agent_pack_credit(uuid, text, uuid, text)
  to service_role;


-- Grant and reversal MUST take the same transaction-scoped lock. Stripe
-- delivery is asynchronous and cannot guarantee payment/refund event order.
create or replace function public.grant_x402_agent_pack(
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_buyer_email text
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_buyer_email));
  v_existing public.x402_agent_pack_grants%rowtype;
begin
  if p_checkout_session_id is null or p_checkout_session_id !~ '^cs_live_' or
     p_payment_intent_id is null or p_payment_intent_id !~ '^pi_' or
     v_email is null or length(v_email) not between 3 and 254 or
     position('@' in v_email) <= 1 then
    raise exception 'invalid_x402_pack_grant_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_payment_intent_id, 0)
  );
  if exists (
    select 1 from public.x402_agent_pack_reversals
    where payment_intent_id = p_payment_intent_id
  ) then
    return 'reversed';
  end if;

  insert into public.x402_agent_pack_grants(
    checkout_session_id, buyer_email, payment_intent_id,
    price_id, credits_total, credits_used, status
  ) values (
    p_checkout_session_id, v_email, p_payment_intent_id,
    'price_1UZdq5GqTruSqV8TsaDtFBPF', 120, 0, 'active'
  ) on conflict (checkout_session_id) do nothing;

  if found then return 'granted'; end if;

  select * into v_existing from public.x402_agent_pack_grants
    where checkout_session_id = p_checkout_session_id;
  if not found or v_existing.payment_intent_id is distinct from p_payment_intent_id
     or lower(v_existing.buyer_email) <> v_email then
    raise exception 'x402_pack_conflicting_session';
  end if;
  if v_existing.status <> 'active' then return 'reversed'; end if;
  return 'existing';
end
$$;

create or replace function public.reverse_x402_agent_pack(
  p_payment_intent_id text,
  p_status text
) returns boolean
language plpgsql security invoker set search_path = ''
as $
declare
  v_buyer_email text;
begin
  if p_payment_intent_id is null or p_payment_intent_id !~ '^pi_' or
     p_status not in ('refunded', 'disputed') then
    raise exception 'invalid_x402_pack_reversal_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_payment_intent_id, 0)
  );
  -- Debit and replay hold an email-scoped advisory lock. A reversal must
  -- take the same lock to make payment revocation linearizable with a
  -- concurrent verification. Always lock PaymentIntent first, then email;
  -- the grant RPC takes only the PaymentIntent lock.
  select lower(buyer_email) into v_buyer_email
  from public.x402_agent_pack_grants
  where payment_intent_id = p_payment_intent_id;
  if v_buyer_email is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_buyer_email, 0)
    );
  end if;
  insert into public.x402_agent_pack_reversals(payment_intent_id, status)
    values (p_payment_intent_id, p_status)
    on conflict(payment_intent_id) do update set status = excluded.status;
  update public.x402_agent_pack_grants
    set status = p_status, updated_at = now()
    where payment_intent_id = p_payment_intent_id and status = 'active';
  return true;
end
$$;

revoke all on function public.grant_x402_agent_pack(text, text, text)
  from public, anon, authenticated;
revoke all on function public.reverse_x402_agent_pack(text, text)
  from public, anon, authenticated;
grant execute on function public.grant_x402_agent_pack(text, text, text) to service_role;
grant execute on function public.reverse_x402_agent_pack(text, text) to service_role;
