-- Made-in-USA Compliance Engine & Claim Passports Migration
-- Author: AuthiChain Autonomous Engineering
-- Standard: FTC 16 CFR Part 323 ("all or virtually all"), California, and Federal Customs
-- Additive only: creates compliance tables with proper constraints, indexes, RLS, and audit logs.

create table if not exists public.compliance_ruleset_versions (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null default 'FEDERAL_FTC', -- FEDERAL_FTC, FEDERAL_CUSTOMS, CALIFORNIA
  authority text not null default 'Federal Trade Commission',
  citation text not null default '16 CFR Part 323',
  version text not null unique,
  effective_from timestamp with time zone not null,
  effective_to timestamp with time zone,
  rule_type text not null default 'ALL_OR_VIRTUALLY_ALL',
  parameters jsonb not null default '{}'::jsonb,
  source_url text not null,
  source_hash text not null,
  retrieved_at timestamp with time zone not null default now(),
  status text not null default 'ACTIVE', -- ACTIVE, DEPRECATED, PROPOSED
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_compliance_ruleset_jurisdiction_version 
  on public.compliance_ruleset_versions (jurisdiction, version);

create table if not exists public.compliance_boms (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  version text not null default 'v1.0',
  total_declared_cost numeric(12, 4) not null default 0,
  currency text not null default 'USD',
  status text not null default 'DRAFT', -- DRAFT, VALIDATED, CALCULATED, BLOCKED
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.compliance_bom_components (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.compliance_boms(id) on delete cascade,
  component_id text not null,
  component_name text not null,
  quantity numeric(12, 4) not null default 1,
  unit_cost numeric(12, 4) not null default 0,
  currency text not null default 'USD',
  supplier_id text,
  supplier_name text,
  supplier_country text not null default 'USA',
  manufacturing_country text not null default 'USA',
  labor_cost numeric(12, 4) not null default 0,
  material_cost numeric(12, 4) not null default 0,
  overhead_cost numeric(12, 4) not null default 0,
  freight_cost numeric(12, 4) not null default 0,
  hts_code text,
  country_of_origin text not null default 'USA',
  final_transformation_country text not null default 'USA',
  documentation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_compliance_bom_components_bom_id 
  on public.compliance_bom_components (bom_id);

create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null,
  document_type text not null, -- AFFIDAVIT, CERTIFICATE_OF_ORIGIN, INVOICE, COST_CERTIFICATION
  file_url text not null,
  document_hash text not null unique,
  ocr_status text not null default 'PENDING', -- PENDING, COMPLETED, FAILED
  ocr_confidence numeric(5, 4) not null default 0,
  extracted_fields jsonb not null default '{}'::jsonb,
  signature_status text not null default 'SIGNATURE_NOT_DETECTED', -- SIGNATURE_PRESENT, SIGNATURE_VERIFIED, SIGNATURE_UNVERIFIED, SIGNATURE_INVALID, SIGNATURE_NOT_DETECTED
  verification_status text not null default 'PENDING', -- PENDING, VERIFIED, REJECTED, REVIEW_REQUIRED
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.cost_calculations (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.compliance_boms(id) on delete cascade,
  ruleset_id uuid not null references public.compliance_ruleset_versions(id),
  total_manufacturing_cost numeric(12, 4) not null,
  us_manufacturing_cost numeric(12, 4) not null,
  foreign_manufacturing_cost numeric(12, 4) not null,
  us_content_percentage numeric(7, 4) not null,
  foreign_content_percentage numeric(7, 4) not null,
  qualifying_costs jsonb not null default '{}'::jsonb,
  excluded_costs jsonb not null default '{}'::jsonb,
  calculation_details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.origin_determinations (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.compliance_boms(id) on delete cascade,
  component_id text, -- null if product-level
  hts_code text,
  manufacturing_process text,
  processing_steps jsonb not null default '[]'::jsonb,
  final_transformation_country text not null default 'USA',
  substantial_transformation_status text not null default 'SUBSTANTIAL_TRANSFORMATION_UNKNOWN', -- CONFIRMED, SUPPORTED, UNKNOWN, NOT_SUPPORTED
  confidence numeric(5, 4) not null default 0,
  reasoning text,
  evidence_manifest jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.claim_determinations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  bom_id uuid not null references public.compliance_boms(id) on delete cascade,
  ruleset_id uuid not null references public.compliance_ruleset_versions(id),
  decision text not null, -- UNQUALIFIED_ALLOWED, QUALIFIED_ALLOWED, SPECIFIC_PROCESS_CLAIM_ONLY, REVIEW_REQUIRED, BLOCKED, INSUFFICIENT_EVIDENCE
  claim_text text not null default 'Made in USA',
  confidence numeric(5, 4) not null default 0,
  evidence_vector jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  review_required boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.claim_passports (
  id uuid primary key default gen_random_uuid(),
  passport_id text not null unique,
  product_id uuid not null,
  determination_id uuid not null references public.claim_determinations(id),
  issuer text not null default 'AuthiChain Compliance Engine',
  client text,
  status text not null default 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED, SUPERSEDED, SUSPENDED, REVIEW_REQUIRED
  document_hash text not null,
  evidence_manifest_hash text not null,
  passport_hash text not null unique,
  signature text not null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_claim_passports_product_id 
  on public.claim_passports (product_id);

create table if not exists public.compliance_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'system',
  event_type text not null, -- BOM_RECEIVED, OCR_COMPLETED, COST_CALCULATED, RULE_EVALUATED, PASSPORT_ISSUED, etc.
  object_id uuid not null,
  previous_state text,
  new_state text,
  source text not null default 'api',
  metadata_hash text not null,
  correlation_id uuid default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_compliance_audit_events_object_id 
  on public.compliance_audit_events (object_id);

create table if not exists public.rule_change_events (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid references public.compliance_ruleset_versions(id),
  source_url text not null,
  old_source_hash text,
  new_source_hash text not null,
  detected_at timestamp with time zone not null default now(),
  classification text not null, -- MINOR, SUBSTANTIAL_REGULATORY_CHANGE
  impact_report jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING_REVIEW' -- PENDING_REVIEW, PROPOSED, PROMOTED, DISMISSED
);

do $$
declare
  table_name text;
  compliance_tables text[] := array[
    'compliance_ruleset_versions',
    'compliance_boms',
    'compliance_bom_components',
    'supplier_documents',
    'cost_calculations',
    'origin_determinations',
    'claim_determinations',
    'claim_passports',
    'compliance_audit_events',
    'rule_change_events'
  ];
begin
  foreach table_name in array compliance_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all privileges on table public.%I to service_role', table_name);
    execute format('drop policy if exists compliance_service_role_only on public.%I', table_name);
    execute format(
      'create policy compliance_service_role_only on public.%I for all using (auth.jwt() ->> ''role'' = ''service_role'') with check (auth.jwt() ->> ''role'' = ''service_role'')',
      table_name
    );
  end loop;
end $$;
