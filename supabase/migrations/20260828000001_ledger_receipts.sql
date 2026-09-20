-- 20260828000001_ledger_receipts.sql
--
-- Off-chain mirror of AuthiChainLedger. Holds NO PII: no email, no name, no
-- card data. buyer_wallet is a public address the buyer opted to supply.

create table if not exists public.ledger_receipts (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique,
  stripe_object_id text not null,
  sku text not null,
  amount_cents int not null,
  currency text not null default 'usd',
  buyer_wallet text,
  stripe_ref_hash text not null,
  source text not null default 'live' check (source in ('live','backfill')),
  status text not null default 'pending' check (status in ('pending','anchored','reversed','failed')),
  tx_hash text,
  sale_id text,
  error text,
  stripe_created_at timestamptz,
  created_at timestamptz default now(),
  anchored_at timestamptz
);

create unique index if not exists ledger_receipts_object_id_idx
  on public.ledger_receipts (stripe_object_id);

-- Receipt page looks up by either the object id or the 0x ref hash.
create index if not exists ledger_receipts_ref_hash_idx
  on public.ledger_receipts (stripe_ref_hash);

-- retry-pending.ts scans this.
create index if not exists ledger_receipts_status_idx
  on public.ledger_receipts (status, created_at);

-- ---------------------------------------------------------------------------
-- RLS: service role only.
-- The service role bypasses RLS entirely, so enabling it with no permissive
-- policy means anon/authenticated clients get nothing. A future receipt page
-- that needs client-side reads can add a narrow select policy then; today the
-- page reads server-side with the service key.
-- ---------------------------------------------------------------------------

alter table public.ledger_receipts enable row level security;

revoke all on public.ledger_receipts from anon, authenticated;

comment on table public.ledger_receipts is
  'Stripe -> Polygon sale anchoring mirror. No PII. Writes are service-role only.';
comment on column public.ledger_receipts.stripe_ref_hash is
  'keccak256(utf8(stripe_object_id)) - the on-chain key into AuthiChainLedger.saleIdByRef';
comment on column public.ledger_receipts.source is
  'live = anchored at payment time; backfill = published later from Stripe records';
