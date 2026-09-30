alter table public.attestation_status_events
  add column if not exists idempotency_key text,
  add column if not exists supersedes_attestation_id text;

create unique index if not exists attestation_status_events_issuer_idempotency_idx
  on public.attestation_status_events (issuer_id, idempotency_key);

alter table public.attestation_status_events
  add constraint attestation_status_events_supersedes_not_self
  check (supersedes_attestation_id is null or supersedes_attestation_id <> attestation_id);

comment on column public.attestation_status_events.idempotency_key is
  'Issuer-scoped retry key for idempotent lifecycle writes; nullable for legacy events.';
comment on column public.attestation_status_events.supersedes_attestation_id is
  'Replacement relationship for attestation.superseded events; points to the attestation that replaces this one.';
