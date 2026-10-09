-- x402 payment-proof replay guard (PM-330 item 2, CFD-265).
--
-- One row per x402 payment proof that a paid verify call (/api/x402,
-- /api/v1/agent-verify, MCP tool `verify`) accepted for settlement. The
-- PRIMARY KEY on proof_key is the single-use guarantee: the code inserts
-- before settling, and a second insert of the same proof fails with 23505,
-- which the API answers with 409 instead of verifying again.
--
-- proof_key is a SHA-256 hex digest computed in src/lib/x402-replay.ts from
-- the EIP-3009 authorization (network + payer + nonce), else the settlement
-- tx hash, else the raw proof header. No raw proof, signature or email is
-- stored.
--
-- expires_at is the authorization's validBefore when the proof carries one
-- (a proof past validBefore is refused before any claim, so its row can be
-- pruned after that time), else 'infinity' (never prunable).
--
-- Additive only: new table, no existing table or row is changed.
-- Must be applied BEFORE the code PR that writes to it ships, or every paid
-- verify call answers 503 replay_guard_unavailable (fail closed, no payment
-- taken).
-- Rollback: drop table public.x402_payment_proofs; (after reverting the code
-- PR, or paid calls fail closed with 503).

create table if not exists public.x402_payment_proofs (
  proof_key text primary key
    check (proof_key ~ '^[0-9a-f]{64}$'),
  proof_kind text not null
    check (proof_kind in ('eip3009_nonce', 'tx_hash', 'header')),
  network text not null,
  payer text not null,
  resource text,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null default 'infinity'
);

create index if not exists x402_payment_proofs_expires_at_idx
  on public.x402_payment_proofs (expires_at);

alter table public.x402_payment_proofs enable row level security;

-- Server-side only (service role from the edge Workers and the Next route).
-- No anon/authenticated grant and no policy: clients can't read or write it.
revoke all on table public.x402_payment_proofs from anon, authenticated;
grant select, insert, delete on table public.x402_payment_proofs to service_role;
