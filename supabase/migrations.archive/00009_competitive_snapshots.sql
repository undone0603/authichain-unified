-- Competitive intelligence snapshots for monitoring Scantrust, VeChain, Circularise, etc.
create table if not exists competitive_snapshots (
  id            bigserial primary key,
  competitor    text not null,
  url           text not null,
  content_hash  text not null,
  excerpt       text,
  changes       jsonb default '{}',
  detected_at   timestamptz default now()
);

create index if not exists competitive_snapshots_competitor_idx on competitive_snapshots (competitor);
create index if not exists competitive_snapshots_detected_at_idx on competitive_snapshots (detected_at desc);
create index if not exists competitive_snapshots_hash_idx on competitive_snapshots (competitor, content_hash);
