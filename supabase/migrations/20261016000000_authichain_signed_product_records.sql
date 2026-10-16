-- Publishable AuthiChain product attestations.
-- Stores the complete signed v0.1 JWS next to the existing auth_seals entry.
-- Public readers can see published attestations only; issuance uses the
-- authenticated issuer rail and the server-side Supabase service credential.

begin;

create table if not exists public.authichain_attestation_records (
  attestation_id text primary key,
  seal_id uuid not null references public.auth_seals(id) on delete restrict,
  product_id text not null,
  batch_id text,
  brand text not null,
  object_id text not null,
  product_class text,
  gtin text,
  serial text,
  lot text,
  issuer_id text not null references public.attestation_issuers(issuer_id),
  issuer_kid text not null,
  decision text not null check (decision in ('verified', 'warning', 'blocked')),
  payload jsonb not null,
  jws text not null,
  record_hash text not null check (record_hash ~ '^sha256:[0-9a-f]{64}$'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check ((published = false and published_at is null) or (published = true and published_at is not null))
);

create index if not exists authichain_attestation_records_seal_idx
  on public.authichain_attestation_records (seal_id, created_at desc);
create index if not exists authichain_attestation_records_product_idx
  on public.authichain_attestation_records (product_id, created_at desc);
create index if not exists authichain_attestation_records_object_idx
  on public.authichain_attestation_records (object_id, created_at desc);
create index if not exists authichain_attestation_records_gtin_idx
  on public.authichain_attestation_records (gtin) where gtin is not null;
create index if not exists authichain_attestation_records_serial_idx
  on public.authichain_attestation_records (serial) where serial is not null;

alter table public.authichain_attestation_records enable row level security;
grant select on table public.authichain_attestation_records to anon, authenticated;
revoke insert, update, delete on table public.authichain_attestation_records from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'authichain_attestation_records'
      and policyname = 'Public can read published AuthiChain attestations'
  ) then
    create policy "Public can read published AuthiChain attestations"
      on public.authichain_attestation_records
      for select to anon, authenticated
      using (published = true);
  end if;
end $$;

comment on table public.authichain_attestation_records is
  'Published AuthiChain v0.1 signed product attestations, linked to an auth_seals row. A published signed record proves issuer-signed claims, not physical authenticity by itself.';
comment on column public.authichain_attestation_records.jws is
  'Compact EdDSA/Ed25519 JWS over canonical AuthiChainAttestationV01 payload; public only after publication.';
comment on column public.authichain_attestation_records.record_hash is
  'SHA-256 digest of the exact compact JWS, prefixed sha256:.';
comment on column public.authichain_attestation_records.published is
  'Only published=true rows are visible through anon/authenticated SELECT; the publisher flips this only after durable attestation.issued status is recorded.';

commit;
