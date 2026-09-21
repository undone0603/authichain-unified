-- 00007_funnel_events.sql
-- Conversion funnel tracking table
-- Tracks prospect drop-off at each stage: proposal sent → email opened → link clicked → visit → checkout → paid

CREATE TYPE funnel_stage AS ENUM (
  'proposal_sent',
  'email_opened',
  'link_clicked',
  'visit_landing_page',
  'start_checkout',
  'complete_checkout',
  'subscribe'
);

CREATE TYPE funnel_source AS ENUM (
  'gov_engine',
  'linkedin_post',
  'reddit_post',
  'seo',
  'direct',
  'email',
  'affiliate'
);

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id    text        NOT NULL,
  stage          funnel_stage NOT NULL,
  source         funnel_source NOT NULL,
  event_type     text,
  metadata       jsonb       DEFAULT '{}',
  timestamp      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_funnel_events_prospect
  ON public.funnel_events (prospect_id);

CREATE INDEX IF NOT EXISTS idx_funnel_events_stage_source
  ON public.funnel_events (stage, source);

CREATE INDEX IF NOT EXISTS idx_funnel_events_timestamp
  ON public.funnel_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_funnel_events_source_timestamp
  ON public.funnel_events (source, timestamp DESC);

-- RLS: Service-role writes events, analytics queries allowed via RLS
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read funnel events (for analytics dashboards)
CREATE POLICY "authenticated_users_can_read_funnel_events"
  ON public.funnel_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow service role to insert events (for API tracking)
CREATE POLICY "service_role_can_insert_funnel_events"
  ON public.funnel_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
