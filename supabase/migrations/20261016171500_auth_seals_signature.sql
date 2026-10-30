-- NICKEL-VERIFY: additive columns for Ed25519-signed AuthiChain seals.
-- Nullable, no defaults rewritten, no existing rows touched.
-- Rollback: alter table public.auth_seals drop column if exists label,
--   drop column if exists signing_kid, drop column if exists signature_jws;
alter table public.auth_seals add column if not exists label text;
alter table public.auth_seals add column if not exists signing_kid text;
alter table public.auth_seals add column if not exists signature_jws text;
comment on column public.auth_seals.signature_jws is 'Compact JWS (EdDSA) of the AuthiChain Attestation v0.1 for this seal; verify against https://authichain.com/protocol/jwks.json';
