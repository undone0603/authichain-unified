-- Email send ledger (PM-338 c, CFD-274).
--
-- Once-only guard for transactional emails that carry an idempotency key
-- (today: Stripe-webhook emails keyed event_id + template). Resend honours
-- the Idempotency-Key header itself, but the Gmail SMTP / OAuth fallbacks
-- have no equivalent, and a Resend outage followed by a recovered retry could
-- send the same email through two providers. The send paths insert here
-- BEFORE sending; a second insert of the same key fails with 23505 (409 over
-- PostgREST) and the send is skipped. A claim is deleted again if every
-- provider failed, so a later retry can still send.
--
-- key_hash is the SHA-256 hex of the idempotency key, so nothing readable
-- (no event id, no address) is stored.
--
-- Additive only: new table, no existing table or row is changed.
-- Rollback: drop table public.email_send_ledger; (sends then behave as before
-- the code PR for Resend; Gmail fallback sends with a key are skipped while
-- the ledger is unavailable, so revert the code PR first).

create table if not exists public.email_send_ledger (
  key_hash text primary key
    check (key_hash ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz not null default now()
);

create index if not exists email_send_ledger_claimed_at_idx
  on public.email_send_ledger (claimed_at);

alter table public.email_send_ledger enable row level security;

-- Server-side only (service role). No anon/authenticated grant, no policy.
revoke all on table public.email_send_ledger from anon, authenticated;
grant select, insert, delete on table public.email_send_ledger to service_role;
