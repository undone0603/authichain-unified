-- Nightstamp / QRON art storage. Safe for an existing qr_arts table and safe to run twice.
create table if not exists qr_arts (
  id text primary key,
  preset text,
  event_at timestamptz,
  lat double precision,
  lon double precision,
  tz text,
  place_label text,
  catalog_hash text,
  sku text,
  qr_data text,
  dedication text,
  style text,
  tenant text,
  stripe_session_id text,
  customer_email text,
  scan_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table qr_arts add column if not exists preset text;
alter table qr_arts add column if not exists event_at timestamptz;
alter table qr_arts add column if not exists lat double precision;
alter table qr_arts add column if not exists lon double precision;
alter table qr_arts add column if not exists tz text;
alter table qr_arts add column if not exists place_label text;
alter table qr_arts add column if not exists catalog_hash text;
alter table qr_arts add column if not exists sku text;
alter table qr_arts add column if not exists qr_data text;
alter table qr_arts add column if not exists dedication text;
alter table qr_arts add column if not exists style text;
alter table qr_arts add column if not exists tenant text;
alter table qr_arts add column if not exists stripe_session_id text;
alter table qr_arts add column if not exists customer_email text;
alter table qr_arts add column if not exists scan_count integer not null default 0;
alter table qr_arts add column if not exists created_at timestamptz not null default now();

create index if not exists qr_arts_preset_idx on qr_arts(preset);
create index if not exists qr_arts_catalog_hash_idx on qr_arts(catalog_hash);
create index if not exists qr_arts_stripe_session_idx on qr_arts(stripe_session_id);
