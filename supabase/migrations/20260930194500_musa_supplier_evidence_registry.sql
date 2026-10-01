-- MUSA Supplier Evidence Registry
-- Applied to Supabase project nhdnkzhtadfkkluiulhs on 2026-09-30.
-- Tenant boundary is auth.uid(); service-role/server routes remain available for
-- automated ingestion and supplier workflows. No existing migration history is rewritten.

create table if not exists public.musa_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id) on delete cascade,
  supplier_name text not null,
  supplier_external_ref text,
  country_code text,
  address jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','review_required','blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists musa_suppliers_tenant_external_ref_idx
  on public.musa_suppliers(tenant_id, supplier_external_ref)
  where supplier_external_ref is not null;

create table if not exists public.musa_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid not null references public.musa_suppliers(id) on delete cascade,
  evidence_type text not null,
  title text not null,
  description text,
  document_hash text not null,
  hash_algorithm text not null default 'sha256',
  storage_path text,
  mime_type text,
  issued_at timestamptz,
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','valid','expired','rejected','superseded','review_required')),
  issuer_name text,
  issuer_ref text,
  origin_country_code text,
  extracted_claims jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists musa_evidence_supplier_idx on public.musa_evidence(tenant_id, supplier_id);
create index if not exists musa_evidence_expiry_idx on public.musa_evidence(tenant_id, expires_at);
create unique index if not exists musa_evidence_hash_idx on public.musa_evidence(tenant_id, document_hash);

create table if not exists public.musa_supplier_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid not null references public.musa_suppliers(id) on delete cascade,
  product_ref text not null,
  component_ref text,
  relationship text not null default 'supplier' check (relationship in ('supplier','component_supplier','manufacturer','processor','certifier')),
  evidence_id uuid references public.musa_evidence(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists musa_supplier_products_lookup_idx
  on public.musa_supplier_products(tenant_id, product_ref, component_ref);

create table if not exists public.musa_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid not null references public.musa_suppliers(id) on delete cascade,
  evidence_type text not null,
  requested_by uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','submitted','accepted','rejected','cancelled')),
  request_token text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists musa_evidence_requests_token_idx
  on public.musa_evidence_requests(request_token);

create table if not exists public.musa_audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists musa_audit_events_entity_idx
  on public.musa_audit_events(tenant_id, entity_type, entity_id, created_at desc);

alter table public.musa_suppliers enable row level security;
alter table public.musa_evidence enable row level security;
alter table public.musa_supplier_products enable row level security;
alter table public.musa_evidence_requests enable row level security;
alter table public.musa_audit_events enable row level security;

create policy "musa_suppliers_owner_select" on public.musa_suppliers for select to authenticated using ((select auth.uid()) = tenant_id);
create policy "musa_suppliers_owner_insert" on public.musa_suppliers for insert to authenticated with check ((select auth.uid()) = tenant_id);
create policy "musa_suppliers_owner_update" on public.musa_suppliers for update to authenticated using ((select auth.uid()) = tenant_id) with check ((select auth.uid()) = tenant_id);
create policy "musa_suppliers_owner_delete" on public.musa_suppliers for delete to authenticated using ((select auth.uid()) = tenant_id);

create policy "musa_evidence_owner_select" on public.musa_evidence for select to authenticated using ((select auth.uid()) = tenant_id);
create policy "musa_evidence_owner_insert" on public.musa_evidence for insert to authenticated with check ((select auth.uid()) = tenant_id);
create policy "musa_evidence_owner_update" on public.musa_evidence for update to authenticated using ((select auth.uid()) = tenant_id) with check ((select auth.uid()) = tenant_id);
create policy "musa_evidence_owner_delete" on public.musa_evidence for delete to authenticated using ((select auth.uid()) = tenant_id);

create policy "musa_supplier_products_owner_select" on public.musa_supplier_products for select to authenticated using ((select auth.uid()) = tenant_id);
create policy "musa_supplier_products_owner_insert" on public.musa_supplier_products for insert to authenticated with check ((select auth.uid()) = tenant_id);
create policy "musa_supplier_products_owner_update" on public.musa_supplier_products for update to authenticated using ((select auth.uid()) = tenant_id) with check ((select auth.uid()) = tenant_id);
create policy "musa_supplier_products_owner_delete" on public.musa_supplier_products for delete to authenticated using ((select auth.uid()) = tenant_id);

create policy "musa_evidence_requests_owner_select" on public.musa_evidence_requests for select to authenticated using ((select auth.uid()) = tenant_id);
create policy "musa_evidence_requests_owner_insert" on public.musa_evidence_requests for insert to authenticated with check ((select auth.uid()) = tenant_id);
create policy "musa_evidence_requests_owner_update" on public.musa_evidence_requests for update to authenticated using ((select auth.uid()) = tenant_id) with check ((select auth.uid()) = tenant_id);
create policy "musa_evidence_requests_owner_delete" on public.musa_evidence_requests for delete to authenticated using ((select auth.uid()) = tenant_id);

create policy "musa_audit_events_owner_select" on public.musa_audit_events for select to authenticated using ((select auth.uid()) = tenant_id);

comment on table public.musa_suppliers is 'MUSA supplier registry; tenant-scoped and service-mediated for automated workflows.';
comment on table public.musa_evidence is 'MUSA supplier-origin evidence with content hash, issuer, validity and extracted claims.';
comment on table public.musa_supplier_products is 'Associates supplier/evidence records with product and component references.';
comment on table public.musa_evidence_requests is 'Evidence request workflow state for supplier collection.';
comment on table public.musa_audit_events is 'Append-only audit trail for MUSA evidence operations.';
