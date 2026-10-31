drop index if exists public.attestation_status_events_issuer_idempotency_idx;
create unique index attestation_status_events_issuer_idempotency_idx
  on public.attestation_status_events (issuer_id, idempotency_key);
