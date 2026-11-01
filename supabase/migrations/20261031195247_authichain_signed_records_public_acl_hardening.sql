-- Production hotfix already applied and verified on 2026-10-31.
-- RLS does not protect TRUNCATE or TRIGGER and REFERENCES are unnecessary
-- for public lookup. Keep reads of published attestations under RLS;
-- service_role / trusted issuer write grants are unchanged.
-- Applied migration ID in QRON-v2: 20261031195247.
revoke truncate, references, trigger on table public.authichain_attestation_records from anon, authenticated;
