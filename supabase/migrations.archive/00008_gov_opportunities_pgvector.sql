-- GovChain autonomous lead-gen: federal opportunity store with pgvector semantic search.
-- Requires pg_vector extension (enabled by default on Supabase).

create extension if not exists vector;

create table if not exists gov_opportunities (
  notice_id        text primary key,
  title            text not null,
  agency           text,
  naics_code       text,
  description      text,
  source           text default 'sam.gov',
  contact_email    text,
  estimated_value  numeric,
  due_date         timestamptz,
  raw              jsonb default '{}',
  embedding        vector(384),
  embedding_model  text,
  embedded_at      timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists gov_opportunities_embedding_idx
  on gov_opportunities using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists gov_opportunities_agency_idx on gov_opportunities (agency);
create index if not exists gov_opportunities_source_idx on gov_opportunities (source);

-- Semantic similarity search RPC used by government-lead-gen-v2.ts
create or replace function match_gov_opportunities(
  query_embedding  vector(384),
  match_count      int     default 8,
  min_score        float   default 0.5
)
returns table (
  notice_id       text,
  title           text,
  agency          text,
  naics_code      text,
  description     text,
  contact_email   text,
  estimated_value numeric,
  due_date        timestamptz,
  similarity      float
)
language plpgsql
as $$
begin
  return query
  select
    g.notice_id,
    g.title,
    g.agency,
    g.naics_code,
    g.description,
    g.contact_email,
    g.estimated_value,
    g.due_date,
    1 - (g.embedding <=> query_embedding) as similarity
  from gov_opportunities g
  where g.embedding is not null
    and 1 - (g.embedding <=> query_embedding) >= min_score
  order by g.embedding <=> query_embedding
  limit match_count;
end;
$$;
