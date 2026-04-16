-- drizzle/migrations/008_gov_engine_tables.sql
-- Backs scripts/ingest-sam.ts, scripts/score-opportunities.ts, scripts/generate-proposals.ts.
-- Already applied to the Supabase project (nhdnkzhtadfkkluiulhs) via MCP
-- apply_migration("create_gov_engine_tables") on 2026-04-16. This file is the
-- canonical version-controlled copy.

CREATE TABLE IF NOT EXISTS public.gov_opportunities (
  notice_id           TEXT        PRIMARY KEY,
  title               TEXT        NOT NULL,
  agency              TEXT,
  deadline            TEXT,
  naics_code          TEXT,
  description         TEXT,
  sam_url             TEXT,
  govchain_url        TEXT,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT        NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'scored', 'skipped', 'proposal_drafted')),
  fit_score           INTEGER,
  ai_reasoning        TEXT,
  key_requirements    JSONB,
  recommended_action  TEXT
                      CHECK (recommended_action IS NULL OR recommended_action IN ('pursue', 'monitor', 'skip')),
  scored_at           TIMESTAMPTZ,
  govchain_detail_url TEXT
);

CREATE INDEX IF NOT EXISTS gov_opportunities_status_idx
  ON public.gov_opportunities (status);
CREATE INDEX IF NOT EXISTS gov_opportunities_fit_score_idx
  ON public.gov_opportunities (fit_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.gov_proposals (
  notice_id       TEXT        PRIMARY KEY
                  REFERENCES public.gov_opportunities(notice_id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  agency          TEXT,
  fit_score       INTEGER,
  proposal_draft  TEXT        NOT NULL,
  govchain_url    TEXT,
  sam_url         TEXT,
  deadline        TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'reviewed', 'submitted', 'won', 'lost'))
);

CREATE INDEX IF NOT EXISTS gov_proposals_status_idx
  ON public.gov_proposals (status);

-- Service role only (the gov-engine GitHub Action uses service_role).
-- Anon/authenticated get no access. Add a portal-facing read view later if needed.
ALTER TABLE public.gov_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_proposals     ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.gov_opportunities IS
  'SAM.gov opportunity ingestion + AI fit scoring for the gov-engine pipeline';
COMMENT ON TABLE public.gov_proposals IS
  'AI-drafted capability statements / proposals for high-fit gov_opportunities';
