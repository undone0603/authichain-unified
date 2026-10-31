-- Revocation is terminal in the derived current status.
--
-- attestation_current_status took the latest effective event, so an
-- `attestation.issued` row appended after an `attestation.revoked` one turned a
-- revoked attestation back into `active`. Nothing writes that sequence today
-- (QRON writes `issued` once, keyed by attestation_id), but the trust decision
-- must not depend on every future writer remembering it. A revoked claim is
-- replaced by issuing a NEW attestation (or superseding), never by resurrecting
-- the old id.
--
-- Additive: same columns, same order and types as 20260930152032, so
-- CREATE OR REPLACE VIEW is valid and no grants change. Events stay
-- append-only; nothing is rewritten.

create or replace view public.attestation_current_status
with (security_invoker = true)
as
select distinct on (attestation_id)
  attestation_id,
  case event_type
    when 'attestation.revoked' then 'revoked'
    when 'attestation.expired' then 'expired'
    when 'attestation.superseded' then 'superseded'
    else 'active'
  end as claim_status,
  effective_at,
  reason_code,
  issuer_id,
  event_id,
  occurred_at
from public.attestation_status_events
where effective_at <= now()
order by
  attestation_id,
  (event_type = 'attestation.revoked') desc,
  effective_at desc,
  occurred_at desc,
  event_id desc;

revoke all on table public.attestation_current_status from anon, authenticated;

comment on view public.attestation_current_status is
  'Current claim status derived from effective attestation lifecycle events; future-dated events are ignored and an effective revocation is terminal.';
